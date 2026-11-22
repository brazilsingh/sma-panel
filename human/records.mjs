// Hosted panel: @Human records <-> the publishing rules' post shape. Pure functions, no I/O.
//
// sma_post holds the post and its delivery state (the sma_engine workflow writes the delivery fields).
// sma_note holds every review action, so reviewers never need to edit a post.
// sma_event holds the history (the owner's panel and the engine both write it).

const PROVIDER_CHANNEL = { linkedin: 'LinkedIn', x: 'X', webhook: 'Website' };
const NOTE_KIND = { request: 'request', approve: 'approval', request_changes: 'changes', approve_self: 'self_approval', note: 'note' };
const NOTE_ACTION = Object.fromEntries(Object.entries(NOTE_KIND).map(([action, kind]) => [kind, action]));
export const noteKind = action => NOTE_KIND[action];

const text = v => v === undefined || v === null ? '' : String(v);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const iso = v => { const ms = Date.parse(v || ''); return Number.isNaN(ms) ? null : new Date(ms).toISOString(); };
const orNull = v => text(v) === '' ? null : text(v);

/** An sma_account record as a destination account, or null when it is switched off or simulated. */
export function accountFromRecord(record) {
  const v = record.values || {};
  if (v.enabled !== '1' || v.simulated === '1' || !v.provider) return null;
  const channel = text(v.channel).trim();
  return {
    id: 'human-' + record.id, humanId: String(record.id), provider: v.provider,
    label: v.label || v.account_key || 'Account ' + record.id,
    ...(channel && channel.length <= 60 ? { channel } : {}),
    ...(v.author_urn ? { author: v.author_urn } : {}),
    ...(v.handle ? { handle: v.handle } : {}),
    ...(v.api_version ? { apiVersion: v.api_version } : {}),
    ...(v.endpoint ? { endpoint: v.endpoint } : {}),
    ...(/^https?:\/\//.test(v.site || '') ? { site: v.site } : {}),
    ...(/^https?:\/\//.test(v.logo || '') ? { logo: v.logo } : {}),
    supportsComments: v.supports_comments === '1',
    longPosts: v.long_posts === '1'
  };
}

/** Review state from the post's notes, oldest first. */
export function reviewFrom(notes, postValues = {}) {
  const review = { status: 'not_requested', requestedAt: null, dueAt: iso(postValues.review_due), decidedBy: null, decidedAt: null, approvedContentVersion: null, notes: [] };
  for (const note of notes) {
    const v = note.values;
    const at = iso(note.createdAt) || new Date(0).toISOString();
    const author = { id: text(v.author) || 'unknown', name: v.author_name || 'Someone', role: v.author_role === 'reviewer' ? 'reviewer' : 'owner' };
    const version = v.content_version ? num(v.content_version) : null;
    if (v.kind === 'request') Object.assign(review, { status: 'pending', requestedAt: at });
    if (v.kind === 'approval' || v.kind === 'self_approval') Object.assign(review, { status: 'approved', decidedBy: author, decidedAt: at, approvedContentVersion: version });
    if (v.kind === 'changes') Object.assign(review, { status: 'changes_requested', decidedBy: author, decidedAt: at, approvedContentVersion: null });
    if (text(v.text).trim()) review.notes.push({ author, text: text(v.text), at, contentVersion: version });
  }
  return review;
}

/** History entries from sma_event records and review notes, oldest first. */
export function historyFrom(events, notes) {
  const out = [];
  for (const event of events) {
    const v = event.values;
    let detail = {};
    try { detail = v.detail ? JSON.parse(v.detail) : {}; } catch { detail = {}; }
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) detail = {};
    const engine = v.actor_name === 'SMA Scheduler';
    out.push({ ...detail, at: iso(v.at) || iso(event.createdAt), type: text(v.type) || 'event', ...(v.actor_name && !engine ? { actor: { id: text(v.actor) || 'owner', name: v.actor_name, role: 'owner' } } : {}), ...(engine ? { via: '@Human' } : {}) });
  }
  for (const note of notes) {
    const v = note.values;
    const action = NOTE_ACTION[v.kind] || 'note';
    out.push({ at: iso(note.createdAt), type: 'review_' + action, actor: { id: text(v.author) || 'unknown', name: v.author_name || 'Someone', role: v.author_role === 'reviewer' ? 'reviewer' : 'owner' }, ...(text(v.text).trim() ? { note: text(v.text) } : {}) });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function partError(v, prefix) {
  return v[prefix + 'error_code'] ? { code: v[prefix + 'error_code'], message: text(v[prefix + 'error_message']), retry: v[prefix + 'error_retry'] || 'never' } : null;
}

/** One sma_post record as a post the publishing rules understand. */
export function jobFromRecord(record, { notes = [], events = [], mediaAlt = {}, parseSchedule } = {}) {
  const v = record.values;
  const kind = v.kind === 'article' ? 'article' : 'social';
  const media = (record.raw || []).filter(x => x.name === 'media' && x.value).map(x => ({ mediaId: String(x.value), altText: mediaAlt[x.value] || '' }));
  const timing = v.comment_at ? { local: orNull(v.comment_local), timeZone: v.comment_tz || 'UTC', at: iso(v.comment_at) } : { delayMinutes: num(v.comment_delay_minutes) };
  let wordpressSchedule = null;
  if (v.wordpress_local && v.wordpress_tz && parseSchedule) { try { wordpressSchedule = parseSchedule({ local: v.wordpress_local, timeZone: v.wordpress_tz }); } catch { wordpressSchedule = null; } }
  const author = { id: text(record.createdBy) || 'owner', name: v.author_name || 'Owner', role: 'owner' };
  return {
    id: String(record.id), kind,
    version: num(v.version) || 1, contentVersion: num(v.content_version) || 1,
    createdAt: iso(record.createdAt) || new Date().toISOString(), updatedAt: iso(record.updatedAt || record.createdAt) || new Date().toISOString(), createdBy: author,
    title: text(v.title), destination: v.account ? { accountId: 'human-' + v.account } : null,
    copy: { text: text(v.text) }, media,
    permalink: v.permalink_url ? { url: v.permalink_url, placement: v.permalink_placement === 'comment' ? 'comment' : 'post' } : null,
    firstComment: text(v.comment_text) ? { text: text(v.comment_text), media: [], timing } : null,
    reviewCopy: kind === 'article' ? text(v.review_copy) : undefined,
    ...(kind === 'article' ? { wordpressSchedule } : {}),
    schedule: v.schedule_at ? { local: orNull(v.schedule_local), timeZone: v.schedule_tz || 'UTC', at: iso(v.schedule_at) } : null,
    status: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'uncertain', 'cancelled'].includes(v.status) ? v.status : 'draft',
    authorization: v.authorization_mode ? { by: { id: text(v.authorized_by) || author.id, name: v.author_name || 'Owner', role: 'owner' }, at: iso(v.authorized_at), contentVersion: num(v.content_version) || 1, mode: v.authorization_mode } : null,
    review: reviewFrom(notes, v),
    delivery: {
      intendedAt: iso(v.schedule_at), attempts: num(v.attempts), retryCount: num(v.retry_count), nextAttemptAt: iso(v.next_attempt_at),
      startedAt: iso(v.started_at), deliveredAt: iso(v.delivered_at), providerPostId: orNull(v.provider_post_id), providerUrl: orNull(v.provider_url),
      renderedText: orNull(v.rendered_text), error: partError(v, ''), nextReconcileAt: iso(v.next_reconcile_at), reconcileCount: num(v.reconcile_count),
      ...(v.confirmed_by ? { confirmedBy: v.confirmed_by } : {})
    },
    comment: {
      status: ['none', 'scheduled', 'sending', 'sent', 'failed', 'uncertain', 'cancelled'].includes(v.comment_status) ? v.comment_status : 'none',
      intendedAt: iso(v.comment_intended_at), attempts: num(v.comment_attempts), retryCount: num(v.comment_retry_count), nextAttemptAt: iso(v.comment_next_attempt_at),
      startedAt: iso(v.comment_started_at), deliveredAt: iso(v.comment_delivered_at), providerCommentId: orNull(v.provider_comment_id), providerUrl: orNull(v.comment_provider_url),
      renderedText: orNull(v.comment_rendered_text), error: partError(v, 'comment_'), nextReconcileAt: iso(v.comment_next_reconcile_at), reconcileCount: 0
    },
    history: historyFrom(events, notes)
  };
}

/** The sma_post values the panel owns for a post. Empty values are cleared on update. */
export function valuesFromJob(job, account) {
  const fc = job.firstComment;
  const timing = fc?.timing || {};
  const d = job.delivery || {};
  const c = job.comment || {};
  const article = job.kind === 'article';
  return {
    title: text(job.title).trim() || text(job.copy?.text).slice(0, 80) || 'Untitled',
    kind: article ? 'article' : 'social',
    channel: account ? account.channel || PROVIDER_CHANNEL[account.provider] || '' : article ? 'WordPress' : '',
    account: account?.humanId || '',
    text: text(job.copy?.text),
    review_copy: article ? text(job.reviewCopy) : '',
    media: (job.media || []).map(m => m.mediaId),
    permalink_url: job.permalink?.url || '',
    permalink_placement: job.permalink?.placement || 'post',
    comment_text: text(fc?.text),
    comment_delay_minutes: String(fc && timing.delayMinutes !== undefined ? timing.delayMinutes : 0),
    comment_at: fc ? timing.at || '' : '',
    comment_local: fc && timing.at ? timing.local || '' : '',
    comment_tz: fc && timing.at && timing.local ? timing.timeZone || '' : '',
    schedule_at: article ? '' : job.schedule?.at || '',
    schedule_local: article ? '' : job.schedule?.local || '',
    schedule_tz: !article && job.schedule?.local ? job.schedule.timeZone || '' : '',
    wordpress_local: article ? job.wordpressSchedule?.local || '' : '',
    wordpress_tz: article ? job.wordpressSchedule?.timeZone || '' : '',
    status: job.status,
    authorization_mode: job.authorization?.mode || '',
    authorized_at: job.authorization?.at || '',
    authorized_by: /^\d+$/.test(text(job.authorization?.by?.id)) ? job.authorization.by.id : '',
    author_name: job.authorization?.by?.name || job.createdBy?.name || '',
    review_status: job.review?.status || 'not_requested',
    review_due: job.review?.dueAt || '',
    content_version: String(job.contentVersion || 1),
    version: String(job.version || 1),
    // Delivery fields. Written only while the engine leaves the post alone (see engineLock).
    attempts: String(d.attempts || 0), retry_count: String(d.retryCount || 0), next_attempt_at: d.nextAttemptAt || '',
    started_at: d.startedAt || '', delivered_at: d.deliveredAt || '', provider_post_id: d.providerPostId || '', provider_url: d.providerUrl || '',
    rendered_text: d.renderedText || '', confirmed_by: d.confirmedBy || '',
    error_code: d.error?.code || '', error_message: d.error?.message || '', error_retry: d.error?.retry || '',
    next_reconcile_at: d.nextReconcileAt || '', reconcile_count: String(d.reconcileCount || 0),
    comment_status: c.status || 'none', comment_intended_at: c.intendedAt || '', comment_attempts: String(c.attempts || 0),
    comment_retry_count: String(c.retryCount || 0), comment_next_attempt_at: c.nextAttemptAt || '', comment_started_at: c.startedAt || '',
    comment_delivered_at: c.deliveredAt || '', provider_comment_id: c.providerCommentId || '', comment_provider_url: c.providerUrl || '',
    comment_rendered_text: c.renderedText || '', comment_error_code: c.error?.code || '', comment_error_message: c.error?.message || '',
    comment_error_retry: c.error?.retry || '', comment_next_reconcile_at: c.nextReconcileAt || ''
  };
}

/** Keep every value the panel does not own (engine attempt IDs, labels), replace the ones it does. */
export function mergeValues(raw, ours) {
  const owned = new Set(Object.keys(ours));
  const out = {};
  for (const { name, value } of raw || []) if (!owned.has(name)) (out[name] ||= []).push(value);
  return { ...out, ...ours };
}

/**
 * Why the panel may not change this record now, or null. The engine works on a record only while a
 * post or comment is due or being sent, so changes are refused inside that window and the 2 minutes before it.
 */
export function engineLock(values, action, now = Date.now(), lockMs = 120000) {
  const v = values || {};
  if (v.status === 'publishing' || v.comment_status === 'sending') return '@Human is sending it right now';
  const changesPost = ['edit', 'schedule', 'publish_now', 'cancel'].includes(action);
  if (v.status === 'scheduled' && changesPost) {
    if (v.authorization_mode === 'publish_now') return '@Human is publishing it now';
    if (num(v.attempts) > 0 || num(v.retry_count) > 0) return '@Human has already tried to send it and will retry';
    const at = Date.parse(v.schedule_at || '');
    if (Number.isNaN(at) || at - now <= lockMs) return 'it is due within ' + Math.round(lockMs / 60000) + ' minutes';
  }
  if (v.status === 'published' && v.comment_status === 'scheduled' && ['edit', 'cancel_comment', 'retry_comment'].includes(action)) {
    const at = Date.parse(v.comment_next_attempt_at || v.comment_intended_at || '');
    if (Number.isNaN(at) || at - now <= lockMs) return 'its first comment is due within ' + Math.round(lockMs / 60000) + ' minutes';
  }
  return null;
}
