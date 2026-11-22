// Hosted SMA panel: answers the workspace's /api/* calls in the browser from @Human records.
// The publishing rules are the same code as the SMA server (publishing/src), run in memory on
// the records loaded for each request. Posts, notes and history are written back to @Human,
// and the sma_engine workflow delivers. Nothing here sends to LinkedIn or X.
import { createPublishingService, defaultAdapters, PublishingError } from './lib/index.mjs';
import { parseSchedule } from './lib/src/time.mjs';
import { files } from './lib/node-shim.mjs';
import { accountFromRecord, engineLock, jobFromRecord, mergeValues, noteKind, valuesFromJob } from './records.mjs';

const DATA_DIR = '/sma';
const CACHE_MS = 3000;
const fail = (code, message, status = 400, details) => new PublishingError(code, message, { status, details });

export async function connect({ config, session, fetch, now = () => Date.now() }) {
  const M = config.modules;
  const lockMs = (config.lockMinutes || 2) * 60000;
  const base = config.baseUrl;
  const recordsPath = module => '/compose/namespace/' + config.namespaceId + '/module/' + module + '/record/';

  // ---------- @Human API ----------
  async function call(method, path, body, { raw = false } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await session.token();
      const form = typeof FormData !== 'undefined' && body instanceof FormData;
      const response = await fetch(base + '/api' + path, {
        method, headers: { Authorization: 'Bearer ' + token, ...(body && !form ? { 'Content-Type': 'application/json' } : {}) },
        body: form ? body : body === undefined ? undefined : JSON.stringify(body)
      });
      if (response.status === 401 && attempt === 0) { const s = session.read(); if (s) session.write({ ...s, expiresAt: 0 }); continue; }
      if (raw) return response;
      const data = await response.json().catch(() => ({}));
      // @Human answers most errors with HTTP 200 and an { error } body.
      if (!response.ok || data.error) throw Object.assign(new Error(data.error?.message || '@Human did not answer (' + response.status + ').'), { human: data.error || null, status: response.status });
      return data.response;
    }
    throw new Error('@Human refused the sign-in. Sign in again.');
  }
  const shape = record => ({
    id: String(record.recordID), createdAt: record.createdAt, updatedAt: record.updatedAt, createdBy: record.createdBy,
    values: Object.fromEntries((record.values || []).map(v => [v.name, v.value ?? ''])),
    raw: (record.values || []).map(v => ({ name: v.name, value: v.value ?? '' }))
  });
  const toList = values => Object.entries(values).flatMap(([name, value]) => (Array.isArray(value) ? value : [value])
    .filter(v => v !== undefined && v !== null && v !== '').map(v => ({ name, value: String(v) })));
  const human = {
    async list(module, { query = '', sort = '' } = {}) {
      const out = [];
      let cursor = '';
      for (let page = 0; page < 20; page++) {
        const params = new URLSearchParams({ limit: '500' });
        if (query) params.set('query', query);
        if (sort) params.set('sort', sort);
        if (cursor) params.set('pageCursor', cursor);
        const data = await call('GET', recordsPath(module) + '?' + params);
        out.push(...(data.set || []).map(shape));
        cursor = data.filter?.nextPage || '';
        if (!cursor) break;
      }
      return out;
    },
    get: async (module, id) => shape(await call('GET', recordsPath(module) + encodeURIComponent(id))),
    create: async (module, values) => shape(await call('POST', recordsPath(module), { values: toList(values) })),
    // No PATCH in @Human: POST to the record replaces every value, so callers send the full set.
    replace: async (module, id, values) => shape(await call('POST', recordsPath(module) + encodeURIComponent(id), { values: toList(values) }))
  };

  // ---------- who is signed in ----------
  let mePromise = null;
  function whoAmI() {
    return (mePromise ||= (async () => {
      const token = await session.token();
      let claims = {};
      try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch {}
      const roles = String(claims.roles || '').split(/[\s,]+/).filter(Boolean);
      let info = {};
      try {
        const response = await fetch(base + '/auth/oauth2/userinfo', { headers: { Authorization: 'Bearer ' + token } });
        if (response.ok) info = await response.json();
      } catch {}
      const id = String(claims.sub || info.sub || '');
      if (!info.email && id) { try { const user = await call('GET', '/system/users/' + id); info = { name: user.name, email: user.email, handle: user.handle }; } catch {} }
      const role = roles.includes(config.roles.owner) ? 'owner' : roles.includes(config.roles.reviewer) ? 'reviewer' : null;
      return { id, role, name: info.name || info.preferred_username || info.handle || info.email || 'Signed in', email: info.email || '' };
    })().catch(error => { mePromise = null; throw error; }));
  }

  // ---------- loading ----------
  let cache = null;
  async function load(fresh = false) {
    if (!fresh && cache && now() - cache.at < CACHE_MS) return cache.promise;
    const promise = (async () => {
      const [accountRecords, posts, notes, events, media] = await Promise.all([
        human.list(M.account), human.list(M.post, { sort: 'createdAt' }), human.list(M.note, { sort: 'createdAt' }),
        human.list(M.event, { sort: 'createdAt' }), human.list(M.media)
      ]);
      const by = (list, field) => list.reduce((map, r) => ((map[r.values[field]] ||= []).push(r), map), {});
      const notesByPost = by(notes, 'post');
      const eventsByPost = by(events, 'post');
      const mediaAlt = Object.fromEntries(media.map(m => [m.id, m.values.alt_text || '']));
      const accounts = accountRecords.map(accountFromRecord).filter(Boolean);
      const jobs = posts.map(record => jobFromRecord(record, { notes: notesByPost[record.id] || [], events: eventsByPost[record.id] || [], mediaAlt, parseSchedule }));
      return { accounts, accountById: new Map(accounts.map(a => [a.id, a])), posts: new Map(posts.map(r => [r.id, r])), jobs, media };
    })();
    cache = { at: now(), promise };
    promise.catch(() => { if (cache?.promise === promise) cache = null; });
    return promise;
  }
  const invalidate = () => { cache = null; };

  /** The publishing rules, run in memory on the loaded records. */
  async function rules(ctx) {
    files.clear();
    const jobs = Object.fromEntries(ctx.jobs.map(job => [job.id, structuredClone(job)]));
    const media = Object.fromEntries(ctx.media.map(m => [m.id, { id: m.id, name: m.values.name || 'graphic', mimeType: m.values.mime_type || 'image/png', size: Number(m.values.size || 0), sha256: m.values.sha256 || '', uploadedAt: m.createdAt }]));
    files.set(DATA_DIR + '/queue.json', JSON.stringify({ schemaVersion: 1, jobs, idempotency: {}, media, events: [], seq: 0 }));
    const blocked = async () => { throw new Error('The hosted panel never calls a platform; @Human delivers.'); };
    return createPublishingService({
      dataDir: DATA_DIR, delivery: 'human', accounts: ctx.accounts, adapters: defaultAdapters('live', { fetch: blocked }),
      getCredentials: () => ({ via: 'human' }), recoverOnStart: false, logger: { error() {}, warn() {} },
      clock: { now }, guard: guardFor(ctx)
    });
  }

  const hasGraphics = job => (job.media?.length || 0) + (job.firstComment?.media?.length || 0) > 0;
  function guardFor(ctx) {
    return ({ action, job }) => {
      const record = ctx.posts.get(job.id);
      if (record) {
        const why = engineLock(record.values, action, now(), lockMs);
        if (why) throw fail('delivery_locked', 'SMA can no longer change this post: ' + why + '. ' + (action === 'cancel' ? 'Cancel it in @Human if there is still time.' : '@Human will send the version it has.'), 409);
      }
      if (job.status === 'scheduled' && ['schedule', 'publish_now', 'edit'].includes(action) && hasGraphics(job)) {
        throw fail('graphics_not_supported', '@Human does not deliver graphics to live accounts yet. Remove the graphics to schedule this post, or keep it as a draft. The graphics stay in SMA.', 422);
      }
    };
  }

  const strip = view => { const { readiness, allowedActions, preview, ...rest } = view; return JSON.stringify(rest); };
  const accountOf = (ctx, job) => ctx.accountById.get(job.destination?.accountId) || null;

  async function writeEvents(me, recordId, title, entries) {
    if (me.role !== 'owner') return;
    for (const entry of entries) {
      if (entry.type.startsWith('review_')) continue; // review history lives in sma_note
      const { at, type, actor, ...detail } = entry;
      await human.create(M.event, { post: recordId, post_title: title, type, actor: /^\d+$/.test(me.id) ? me.id : '', actor_name: me.name, at: at || new Date(now()).toISOString(), detail: JSON.stringify(detail) });
    }
  }

  /** Write a changed post back, after reading it once more and checking the engine lock again. */
  async function saveJob(ctx, me, view, action) {
    const values = valuesFromJob(view, accountOf(ctx, view));
    const fresh = await human.get(M.post, view.id);
    const why = engineLock(fresh.values, action, now(), lockMs);
    if (why) throw fail('delivery_locked', 'SMA can no longer change this post: ' + why + '. Nothing was changed.', 409);
    if (String(fresh.values.version || '1') !== String(ctx.posts.get(view.id)?.values.version || '1')) {
      throw fail('version_conflict', 'This post changed in @Human since you opened it. Reload it and try again.', 409);
    }
    await human.replace(M.post, view.id, mergeValues(fresh.raw, values));
  }

  async function mail(to, subject, body, type) {
    try {
      const record = await human.create(M.mail, { to, subject, text: body, type, status: 'queued' });
      return ['sent', 'failed'].includes(record.values.status) ? record.values.status : 'queued';
    } catch { return 'failed'; }
  }
  const site = () => location.origin;

  // ---------- publishing routes ----------
  async function publishing(method, path, body, headers, me, query) {
    const actor = { id: me.id, name: me.name, role: me.role };
    let m;
    if (method === 'GET') {
      const ctx = await load();
      if (path === '/accounts') return { accounts: (await rules(ctx)).listAccounts() };
      if (path === '/posts') return { posts: (await rules(ctx)).listPosts(Object.fromEntries(query)) };
      if ((m = /^\/posts\/([\w-]+)$/.exec(path))) return { post: (await rules(ctx)).getPost(m[1]) };
      if (path === '/events') {
        const since = Number(query.get('since') || 0);
        const events = ctx.jobs.flatMap(job => job.history.map(entry => ({ jobId: job.id, title: job.title, ...entry })))
          .sort((a, b) => String(a.at).localeCompare(String(b.at))).map((event, i) => ({ seq: i + 1, ...event }));
        return { events: events.filter(e => e.seq > since) };
      }
      if (path === '/media') return { media: await Promise.all(ctx.media.map(publicMedia)) };
      if ((m = /^\/media\/([\w-]+)$/.exec(path))) return mediaBytes(ctx, m[1]);
      throw fail('not_found', 'Unknown publishing endpoint.', 404);
    }

    if (me.role !== 'owner' && !/^\/posts\/[\w-]+\/review$/.test(path)) throw fail('forbidden', 'Only the workspace owner can do that. Reviewers can approve, suggest edits, or request changes.', 403);
    if (path === '/media') return [201, { media: await uploadMedia(body) }];

    const ctx = await load(true);
    const svc = await rules(ctx);

    if (path === '/posts') {
      const key = headers.get('idempotency-key') || '';
      if (key) {
        const existing = [...ctx.posts.values()].find(r => r.values.idempotency_key === key);
        if (existing) return { post: svc.getPost(existing.id), duplicate: true };
      }
      const { post } = await svc.createPost(actor, body);
      const values = valuesFromJob(post, accountOf(ctx, post));
      let created;
      try {
        created = await human.create(M.post, { ...values, ...(key ? { idempotency_key: key } : {}) });
      } catch (error) {
        const again = key && (await human.list(M.post, { query: "idempotency_key='" + key.replace(/'/g, '') + "'" }))[0];
        if (!again) throw error;
        invalidate();
        return { post: (await rules(await load(true))).getPost(again.id), duplicate: true };
      }
      await writeEvents(me, created.id, post.title, post.history);
      invalidate();
      return [201, { post: (await rules(await load(true))).getPost(created.id), duplicate: false }];
    }

    if (!(m = /^\/posts\/([\w-]+)(?:\/([\w/-]+))?$/.exec(path))) throw fail('not_found', 'Unknown publishing endpoint.', 404);
    const [, id, op = ''] = m;
    const before = svc.getPost(id);
    let action = 'edit';
    let after;
    let note = null;
    if (method === 'PATCH' && !op) {
      action = body.publishNow ? 'publish_now' : body.schedule ? 'schedule' : 'edit';
      after = await svc.updatePost(actor, id, body, { expectedVersion: body.expectedVersion });
    } else if (op === 'schedule') { action = 'schedule'; after = await svc.schedulePost(actor, id, body.schedule ?? body, { expectedVersion: body.expectedVersion }); }
    else if (op === 'publish-now') { action = 'publish_now'; after = (await svc.publishNow(actor, id, { expectedVersion: body.expectedVersion })).post; }
    else if (op === 'cancel') { action = 'cancel'; after = await svc.cancelPost(actor, id); }
    else if (op === 'comment/retry') { action = 'retry_comment'; after = await svc.retryComment(actor, id); }
    else if (op === 'comment/cancel') { action = 'cancel_comment'; after = await svc.cancelComment(actor, id); }
    else if (op === 'resolve') { action = 'resolve'; after = await svc.resolveUncertain(actor, id, body); }
    else if (op === 'review') {
      after = await svc.reviewPost(actor, id, body);
      note = { action: body.action, text: String(body.note ?? '').trim() };
    } else throw fail('not_found', 'Unknown publishing endpoint.', 404);

    if (note) {
      await human.create(M.note, { post: id, kind: noteKind(note.action), text: note.text, author: /^\d+$/.test(me.id) ? me.id : '', author_name: me.name, author_role: me.role, content_version: String(before.contentVersion) });
      if (me.role === 'owner' && note.action === 'request') {
        // Mirror the review due date onto the post, but never while @Human may be working on it.
        const fresh = await human.get(M.post, id);
        if (!engineLock(fresh.values, 'edit', now(), lockMs)) {
          await human.replace(M.post, id, mergeValues(fresh.raw, { review_status: 'pending', review_due: after.review.dueAt || '' }));
        }
        await requestReviewMail(after);
      }
    } else if (strip(after) !== strip(before)) {
      await saveJob(ctx, me, after, action);
      await writeEvents(me, id, after.title, after.history.slice(before.history.length));
    }
    invalidate();
    const post = (await rules(await load(true))).getPost(id);
    return op === 'publish-now' ? [202, { post, alreadyRequested: false }] : op === 'comment/retry' ? [202, { post }] : { post };
  }

  async function requestReviewMail(post) {
    const invites = (await human.list(M.invite)).filter(r => ['pending', 'accepted'].includes(r.values.status));
    for (const invite of invites) {
      const name = invite.values.invitee_name || 'there';
      const due = post.review.dueAt ? '\nPlease review by ' + new Date(post.review.dueAt).toUTCString() + '.' : '';
      await mail(invite.values.email, 'Review requested: ' + (post.title || 'a Planet Crust post'),
        'Hi ' + name + ',\n\nThe Planet Crust team asked for your review of "' + (post.title || 'Untitled') + '".' + due + '\n\nOpen it here and sign in with your @Human account:\n' + site() + '/review#p=' + post.id +
        '\n\nYour review is advisory: approve and suggest edits, or request changes.', 'review_request');
    }
  }

  // ---------- graphics (sma_media) ----------
  const attachmentUrls = new Map();
  async function attachmentUrl(attachmentId) {
    if (!attachmentId) return null;
    if (!attachmentUrls.has(attachmentId)) {
      attachmentUrls.set(attachmentId, call('GET', '/compose/namespace/' + config.namespaceId + '/attachment/record/' + encodeURIComponent(attachmentId))
        .then(a => a?.url ? (a.url.startsWith('http') ? a.url : base + (a.url.startsWith('/api') ? '' : '/api') + a.url) : null)
        .catch(() => { attachmentUrls.delete(attachmentId); return null; }));
    }
    return attachmentUrls.get(attachmentId);
  }
  async function publicMedia(m) {
    return { id: m.id, name: m.values.name || 'graphic', mimeType: m.values.mime_type || '', size: Number(m.values.size || 0), sha256: m.values.sha256 || '', uploadedAt: m.createdAt, src: await attachmentUrl(m.values.file) };
  }
  async function mediaBytes(ctx, id) {
    const m = ctx.media.find(x => x.id === id);
    const url = m && await attachmentUrl(m.values.file);
    if (!url) throw fail('not_found', 'Graphic not found.', 404);
    const response = await fetch(url);
    if (!response.ok) throw fail('not_found', 'Graphic not found.', 404);
    return new Response(await response.blob(), { status: 200, headers: { 'Content-Type': m.values.mime_type || response.headers.get('Content-Type') || 'application/octet-stream' } });
  }
  const SNIFF = {
    'image/png': b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
    'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/gif': b => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
    'image/webp': b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  };
  async function uploadMedia({ name, dataUrl } = {}) {
    const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
    if (!match) throw fail('invalid_request', 'Send the graphic as a base64 data URL.');
    const [, type, payload] = match;
    if (!SNIFF[type]) throw fail('invalid_request', 'Use a PNG, JPEG, GIF, or WebP graphic.');
    const bytes = Uint8Array.from(atob(payload.replace(/\s/g, '')), c => c.charCodeAt(0));
    if (!bytes.length) throw fail('invalid_request', 'The graphic is empty.');
    if (bytes.length > 8 * 1024 * 1024) throw fail('invalid_request', 'Choose a graphic under 8 MB.');
    if (!SNIFF[type](bytes)) throw fail('invalid_request', 'The file content does not match ' + type + '.');
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const fileName = String(name || 'graphic').slice(0, 200);
    const form = new FormData();
    form.append('fieldName', 'file');
    form.append('upload', new Blob([bytes], { type }), fileName);
    const attachment = await call('POST', '/compose/namespace/' + config.namespaceId + '/module/' + M.media + '/record/attachment', form);
    const record = await human.create(M.media, { name: fileName, file: attachment.attachmentID, mime_type: type, size: String(bytes.length), sha256 });
    invalidate();
    return publicMedia(record);
  }

  // ---------- team ----------
  async function team(method, route, body, me) {
    if (method === 'GET' && route === '/me') return { role: me.role, name: me.name, email: me.email || null, scoped: false, postId: null };
    if (route === '/signout') { session.signOut(); return { ok: true }; }
    if (route === '/accept') return { role: me.role, name: me.name };
    if (me.role !== 'owner') throw fail('forbidden', 'Only an owner can manage the team.', 403);
    const memberOf = r => ({ id: r.id, name: r.values.invitee_name || r.values.email, email: r.values.email, humanEmail: null,
      status: r.values.status === 'accepted' ? 'active' : 'invited', invitedAt: r.values.sent_at || r.createdAt, acceptedAt: r.values.accepted_at || null });
    if (method === 'GET' && route === '/') {
      const [invites, mails] = await Promise.all([human.list(M.invite, { sort: 'createdAt' }), human.list(M.mail, { sort: 'createdAt DESC' })]);
      return {
        owners: [{ id: me.id, name: me.name, email: me.email }],
        members: invites.filter(r => !['removed', 'cancelled'].includes(r.values.status)).map(memberOf),
        outbox: mails.slice(0, 50).map(r => ({ subject: r.values.subject, to: r.values.to, at: r.values.sent_at || r.createdAt, status: r.values.status || 'queued', link: null })),
        mail: { via: '@Human', live: true, configured: true }
      };
    }
    if (method !== 'POST') throw fail('method_not_allowed', 'Method not allowed.', 405);
    const inviteText = name => 'Hi ' + (name || 'there') + ',\n\nYou are invited to review Planet Crust posts in SMA.\n\nOpen ' + site() + '/review and sign in with your @Human account (' + base.replace(/^https:\/\//, '') +
      '). If it says you have no access yet, reply to this email and the owner will add you to the SMA reviewers group.\n\nYour review is advisory: approve and suggest edits, or request changes.';
    let m;
    if (route === '/owners' || /^\/owners\/[\w-]+\/remove$/.test(route)) throw fail('human_mode', 'Owners are managed in @Human: add or remove them in the SMA owners group.', 409);
    if (route === '/reviewers') {
      const email = String(body.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('invalid_request', 'Enter a valid email address.');
      const name = String(body.name || '').trim();
      const record = await human.create(M.invite, { email, invitee_name: name, role: 'reviewer', status: 'pending', invited_by: /^\d+$/.test(me.id) ? me.id : '', sent_at: new Date(now()).toISOString(), send_count: '1' });
      const status = await mail(email, 'You are invited to review Planet Crust posts in SMA', inviteText(name), 'invite');
      return [201, { member: memberOf(record), status }];
    }
    if ((m = /^\/reviewers\/([\w-]+)\/(resend|update|remove)$/.exec(route))) {
      const record = await human.get(M.invite, m[1]);
      if (m[2] === 'update') return { member: memberOf(record) };
      if (m[2] === 'remove') { await human.replace(M.invite, record.id, mergeValues(record.raw, { status: 'removed' })); return { ok: true }; }
      const saved = await human.replace(M.invite, record.id, mergeValues(record.raw, { sent_at: new Date(now()).toISOString(), send_count: String(Number(record.values.send_count || 0) + 1) }));
      return { member: memberOf(saved), status: await mail(record.values.email, 'You are invited to review Planet Crust posts in SMA', inviteText(record.values.invitee_name), 'invite') };
    }
    if (route === '/test-email') {
      if (!me.email) throw fail('invalid_request', 'Your @Human account has no email address.');
      return { to: me.email, status: await mail(me.email, 'SMA test email', 'This is a test email from the SMA panel at ' + site() + '.', 'test') };
    }
    if (route === '/review-link') return [201, { url: site() + '/review#p=' + encodeURIComponent(String(body.postId || '')) }];
    throw fail('not_found', 'Unknown team endpoint.', 404);
  }

  // ---------- entry point ----------
  const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  async function handle(url, { method = 'GET', headers = new Headers(), body } = {}) {
    try {
      const me = await whoAmI();
      if (!me.role) throw fail('forbidden', 'Your @Human account is not in the SMA owners or SMA reviewers group.', 403);
      let input = {};
      if (body !== undefined && body !== null && body !== '') {
        try { input = JSON.parse(body); } catch { throw fail('invalid_request', 'The request body is not valid JSON.'); }
      }
      const path = url.pathname;
      let result;
      if (path === '/api/workspace') result = { publishing: true, delivery: 'human', team: true, requireSignIn: true, integrations: { Email: true } };
      else if (path === '/api/publishing' || path.startsWith('/api/publishing/')) result = await publishing(method, path.slice('/api/publishing'.length) || '/', input, headers, me, url.searchParams);
      else if (path === '/api/team' || path.startsWith('/api/team/')) result = await team(method, path.slice('/api/team'.length) || '/', input, me);
      else if (path === '/api/inbox/reply') throw fail('not_configured', 'Inbox replies need the inbox webhook, which the hosted panel does not have yet. Reply on the platform for now.', 503);
      else throw fail('not_found', 'Unknown endpoint.', 404);
      if (result instanceof Response) return result;
      const [status, payload] = Array.isArray(result) ? result : [200, result];
      return json(status, payload);
    } catch (error) {
      if (error instanceof PublishingError) return json(error.status, error.toJSON());
      console.error('SMA panel:', error);
      return json(502, { error: error.message || 'SMA could not reach @Human.', code: 'human_unavailable' });
    }
  }
  handle.me = whoAmI;
  return handle;
}
