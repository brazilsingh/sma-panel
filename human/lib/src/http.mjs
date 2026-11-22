import { PublishingError, invalid } from './errors.mjs';

const PREFIX = '/api/publishing';
const MAX_BODY = 12 * 1024 * 1024;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/**
 * Returns `handle(request, response) -> Promise<boolean>`. It answers requests under
 * /api/publishing and returns false for anything else, so the workspace server can fall
 * through to its static files.
 *
 * options.resolveActor(request) -> { id, name, role: 'owner' | 'reviewer' } | null
 *   Required. The workspace decides who is calling (session, header from a trusted proxy, …).
 * options.isAllowedHost(host) -> boolean   defaults to localhost only (same rule as server.mjs).
 */
export function createPublishingHandler(service, { resolveActor, isAllowedHost = host => LOCAL_HOST.test(host || '') } = {}) {
  if (typeof resolveActor !== 'function') throw new Error('createPublishingHandler needs resolveActor(request).');

  const routes = [
    ['GET', /^\/accounts$/, () => ({ accounts: service.listAccounts() })],
    ['GET', /^\/posts$/, ({ query }) => ({ posts: service.listPosts(Object.fromEntries(query)) })],
    ['POST', /^\/posts$/, async ({ actor, body, request }) => {
      const result = await service.createPost(actor, body, { idempotencyKey: request.headers['idempotency-key'] });
      return [result.duplicate ? 200 : 201, result];
    }],
    ['GET', /^\/posts\/([\w-]+)$/, ({ params }) => ({ post: service.getPost(params[0]) })],
    ['PATCH', /^\/posts\/([\w-]+)$/, async ({ actor, params, body }) => ({ post: await service.updatePost(actor, params[0], body, { expectedVersion: body.expectedVersion }) })],
    ['POST', /^\/posts\/([\w-]+)\/schedule$/, async ({ actor, params, body }) => ({ post: await service.schedulePost(actor, params[0], body.schedule ?? body, { expectedVersion: body.expectedVersion }) })],
    ['POST', /^\/posts\/([\w-]+)\/publish-now$/, async ({ actor, params, body }) => {
      const result = await service.publishNow(actor, params[0], { expectedVersion: body.expectedVersion });
      return [202, result];
    }],
    ['POST', /^\/posts\/([\w-]+)\/cancel$/, async ({ actor, params }) => ({ post: await service.cancelPost(actor, params[0]) })],
    ['POST', /^\/posts\/([\w-]+)\/review$/, async ({ actor, params, body }) => ({ post: await service.reviewPost(actor, params[0], body) })],
    ['POST', /^\/posts\/([\w-]+)\/comment\/retry$/, async ({ actor, params }) => [202, { post: await service.retryComment(actor, params[0]) }]],
    ['POST', /^\/posts\/([\w-]+)\/comment\/cancel$/, async ({ actor, params }) => ({ post: await service.cancelComment(actor, params[0]) })],
    ['POST', /^\/posts\/([\w-]+)\/resolve$/, async ({ actor, params, body }) => ({ post: await service.resolveUncertain(actor, params[0], body) })],
    ['GET', /^\/media$/, () => ({ media: service.listMedia() })],
    ['POST', /^\/media$/, async ({ actor, body }) => [201, { media: await service.saveMedia(actor, body) }]],
    ['GET', /^\/media\/([\w-]+)$/, async ({ params, response }) => {
      const item = await service.getMedia(params[0]);
      response.writeHead(200, { 'Content-Type': item.mimeType, 'Content-Length': item.bytes.length, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      response.end(item.bytes);
      return null;
    }],
    ['GET', /^\/events$/, ({ query }) => ({ events: service.listEvents({ since: query.get('since') || 0 }) })]
  ];

  return async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return false;
    try {
      if (!isAllowedHost(request.headers.host)) throw new PublishingError('forbidden_host', 'Open the workspace on localhost.', { status: 403 });
      const path = url.pathname.slice(PREFIX.length) || '/';
      const matches = routes.filter(([, pattern]) => pattern.test(path));
      if (!matches.length) throw new PublishingError('not_found', 'Unknown publishing endpoint.', { status: 404 });
      const route = matches.find(([method]) => method === request.method || (method === 'GET' && request.method === 'HEAD'));
      if (!route) throw new PublishingError('method_not_allowed', 'Method not allowed.', { status: 405 });
      const mutating = request.method !== 'GET' && request.method !== 'HEAD';
      if (mutating) guardCrossSite(request);
      const actor = await resolveActor(request);
      if (!actor) throw new PublishingError('unauthenticated', 'Sign in to the workspace first.', { status: 401 });
      const body = mutating ? await readJson(request) : {};
      const result = await route[2]({ request, response, actor, body, params: route[1].exec(path).slice(1), query: url.searchParams });
      if (result === null) return true;
      const [status, payload] = Array.isArray(result) ? result : [200, result];
      send(response, status, payload);
    } catch (error) {
      if (error instanceof PublishingError) send(response, error.status, error.toJSON());
      else {
        console.error('Publishing API error:', error);
        send(response, 500, { error: 'The publishing service hit an unexpected error.', code: 'internal_error' });
      }
    }
    return true;
  };
}

// Browsers cannot send application/json cross-site without a CORS preflight, which this
// handler never approves, so requiring it (plus a same-origin Origin header when present)
// stops other websites from triggering a publish on the local server.
function guardCrossSite(request) {
  const type = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new PublishingError('unsupported_media_type', 'Send JSON with Content-Type: application/json.', { status: 415 });
  const origin = request.headers.origin;
  if (origin && origin !== 'null') {
    let host;
    try { host = new URL(origin).host; } catch { host = ''; }
    if (host !== request.headers.host) throw new PublishingError('forbidden_origin', 'Cross-site requests are not allowed.', { status: 403 });
  } else if (origin === 'null') {
    throw new PublishingError('forbidden_origin', 'Cross-site requests are not allowed.', { status: 403 });
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new PublishingError('payload_too_large', 'The request is larger than 12 MB.', { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw invalid('The request body is not valid JSON.');
  }
}

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(payload));
}
