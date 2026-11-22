import { ProviderError } from '../errors.mjs';

/**
 * In-memory provider for tests and for running the studio without live delivery.
 * Nothing leaves the machine.
 *
 *   const fake = createFakeAdapter({ provider: 'linkedin', capabilities: linkedinCapabilities });
 *   fake.failNext('post', 'unsafe')   // next post call times out after "maybe" creating it
 *   fake.failNext('comment', 'safe')  // next comment call is rate-limited
 *   fake.calls                        // every call with its payload
 *   fake.published                    // what the provider actually holds
 */
export function createFakeAdapter({ provider = 'fake', label, capabilities, commentLabel = 'first comment', simulated = false } = {}) {
  const plan = { post: [], comment: [] };
  const calls = [];
  const published = [];
  let seq = 0;
  const defaultCaps = () => ({
    text: { maxLength: 3000 },
    media: { maxItems: 4, mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] },
    comment: { supported: true, maxLength: 1000, media: null }
  });

  function outcome(kind, payload) {
    const next = plan[kind].shift() || 'ok';
    const record = () => {
      const id = provider + '-' + kind + '-' + (++seq);
      const entry = { id, kind, ...payload };
      published.push(entry);
      return { id, url: 'https://' + provider + '.example/' + (simulated ? 'simulated/' : '') + id };
    };
    if (typeof next === 'function') return next(payload, record);
    switch (next) {
      case 'ok': return record();
      case 'no_id': record(); return { id: '', url: '' };
      case 'safe': throw new ProviderError('provider_rate_limited', label + ' rate limit reached (429). Nothing was sent.', { retry: 'safe', status: 429 });
      case 'never': throw new ProviderError('provider_rejected', label + ' rejected the request (400).', { retry: 'never', status: 400 });
      case 'auth': throw new ProviderError('provider_auth', label + ' rejected the access token (401). Reconnect the account.', { retry: 'never', status: 401 });
      case 'unsafe': throw new ProviderError('provider_timeout', label + ' did not answer in time. The post may or may not exist.', { retry: 'unsafe' });
      case 'unsafe_created': record(); throw new ProviderError('provider_timeout', label + ' did not answer in time. The post may or may not exist.', { retry: 'unsafe' });
      default: throw new Error('Unknown fake outcome ' + next);
    }
  }

  label = label || provider;
  return {
    provider,
    label,
    live: false,
    simulated,
    requiresCredentials: false,
    commentLabel,
    capabilities: capabilities || defaultCaps,
    accountProblems: () => [],
    calls,
    published,
    failNext(kind, ...outcomes) { plan[kind].push(...outcomes); return this; },
    async publishPost({ account, text, media }) {
      const payload = { accountId: account.id, text, media: media.map(m => ({ name: m.name, mimeType: m.mimeType, sha256: m.sha256, altText: m.altText, size: m.bytes.length })) };
      calls.push({ kind: 'post', ...payload });
      return outcome('post', payload);
    },
    async publishComment({ account, parent, text, media }) {
      const payload = { accountId: account.id, parentId: parent.id, text, media: media.map(m => ({ name: m.name, mimeType: m.mimeType, sha256: m.sha256 })) };
      calls.push({ kind: 'comment', ...payload });
      return outcome('comment', payload);
    },
    /** Looks for a matching item the provider holds (used after an uncertain timeout). */
    async reconcile({ target, job, parent, text }) {
      calls.push({ kind: 'reconcile', target, jobId: job.id });
      const hit = published.find(p => p.kind === target && p.text === text && (target === 'post' || p.parentId === parent?.id));
      return hit ? { status: 'delivered', id: hit.id, url: 'https://' + provider + '.example/' + hit.id } : { status: 'not_delivered' };
    }
  };
}
