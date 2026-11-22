import { createHash, randomUUID } from '../node-shim.mjs';
import { join } from '../node-shim.mjs';
import { capabilityProblems, assertAdapter } from './adapters/contract.mjs';
import { createFakeAdapter } from './adapters/fake.mjs';
import { createLinkedInAdapter, linkedinCapabilities } from './adapters/linkedin.mjs';
import { createXAdapter, xCapabilities } from './adapters/x.mjs';
import { createWebhookAdapter, webhookCapabilities } from './adapters/webhook.mjs';
import { envCredentials, loadAccountsFile, normaliseAccounts, SIMULATED_ACCOUNTS } from './accounts.mjs';
import { systemClock } from './clock.mjs';
import { cleanUrl, renderDelivery } from './compose.mjs';
import { ProviderError, PublishingError, asProviderError, conflict, errorRecord, forbidden, invalid, notFound, unsupported } from './errors.mjs';
import { createMediaLibrary, decodeUpload } from './media.mjs';
import { openFileStore } from './store.mjs';
import { parseSchedule } from './time.mjs';

export const ROLES = Object.freeze({ OWNER: 'owner', REVIEWER: 'reviewer' });
const PRE_DELIVERY = new Set(['draft', 'scheduled', 'failed', 'cancelled']);
const COMMENT_OPEN = new Set(['none', 'scheduled', 'failed', 'cancelled']);
const PAST_TOLERANCE_MS = 60000;

/**
 * Build the default adapters for a delivery mode.
 *  - 'simulate': LinkedIn and X capability rules, in-memory delivery, nothing leaves the machine.
 *  - 'live':     real LinkedIn and X HTTP connectors.
 */
export function defaultAdapters(mode, { fetch } = {}) {
  if (mode === 'live') return [createLinkedInAdapter({ fetch }), createXAdapter({ fetch }), createWebhookAdapter({ fetch })];
  if (mode === 'simulate') {
    return [
      createFakeAdapter({ provider: 'linkedin', label: 'LinkedIn', capabilities: linkedinCapabilities, simulated: true }),
      createFakeAdapter({ provider: 'x', label: 'X', capabilities: xCapabilities, commentLabel: 'first reply', simulated: true }),
      createFakeAdapter({ provider: 'webhook', label: 'Website', capabilities: webhookCapabilities, simulated: true })
    ];
  }
  throw new Error('Unknown delivery mode ' + mode + '. Use simulate or live.');
}

export async function createPublishingService(options = {}) {
  const {
    dataDir,
    delivery = 'simulate',
    clock = systemClock,
    timers = { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) },
    getCredentials = envCredentials(process.env),
    deliveryTimeoutMs = 30000,
    retryDelaysMs = [60000, 5 * 60000, 15 * 60000],
    reconcileDelaysMs = [60000, 5 * 60000, 15 * 60000],
    missedGraceMs = 30 * 60000,
    pollIntervalMs = 15000,
    maxEvents = 500,
    logger = console,
    // Optional veto, called inside the transaction with the changed job: ({ action, job, fields }) => void.
    // Throwing a PublishingError refuses the change and nothing is saved (used by @Human mode).
    guard = null,
    // Mark posts left mid-send as uncertain at startup. Off when another system owns delivery (hosted panel).
    recoverOnStart = true
  } = options;
  if (!dataDir) throw new Error('createPublishingService needs a dataDir for the durable queue.');

  const adapters = new Map((options.adapters || defaultAdapters(delivery, options)).map(a => [assertAdapter(a).provider, a]));
  let accountList = options.accounts;
  if (!accountList) accountList = await loadAccountsFile(options.accountsFile || join(dataDir, 'accounts.json'));
  if (!accountList) accountList = delivery === 'simulate' ? SIMULATED_ACCOUNTS : [];
  const accounts = normaliseAccounts(accountList);

  const store = await openFileStore(dataDir);
  const media = createMediaLibrary(dataDir);
  const subscribers = new Set();
  let emittedSeq = store.state.seq;
  let timer = null;
  let started = false;
  let running = null;

  const iso = ms => new Date(ms).toISOString();
  const nowIso = () => iso(clock.now());

  // ---------- helpers ----------
  function requireActor(actor) {
    if (!actor || !Object.values(ROLES).includes(actor.role)) throw forbidden('Sign in to the workspace first.');
    return actor;
  }
  function requireOwner(actor) {
    requireActor(actor);
    if (actor.role !== ROLES.OWNER) throw forbidden('Only the workspace owner can do that. Reviewers can approve, suggest edits, or request changes.');
    return actor;
  }
  const who = actor => ({ id: actor.id || actor.role, name: actor.name || actor.id || actor.role, role: actor.role });

  function jobIn(draft, id) {
    const job = draft.jobs[id];
    if (!job) throw notFound('Post not found.');
    return job;
  }
  function checkVersion(job, expectedVersion) {
    if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== job.version) {
      throw conflict('version_conflict', 'This post changed since you opened it. Reload it and try again.', { currentVersion: job.version });
    }
  }
  function record(draft, job, type, actor, detail = {}) {
    const at = nowIso();
    const entry = { at, type, ...(actor ? { actor: who(actor) } : {}), ...detail };
    job.history.push(entry);
    draft.seq += 1;
    draft.events.push({ seq: draft.seq, jobId: job.id, title: job.title, ...entry });
    if (draft.events.length > maxEvents) draft.events.splice(0, draft.events.length - maxEvents);
  }
  function touch(job) { job.version += 1; job.updatedAt = nowIso(); }
  function check(action, job, fields) { if (guard) guard({ action, job, fields }); }

  async function commit(fn) {
    const result = await store.transact(fn);
    const fresh = store.state.events.filter(e => e.seq > emittedSeq);
    emittedSeq = store.state.seq;
    for (const event of fresh) for (const fn2 of subscribers) { try { fn2(event); } catch (error) { logger.error?.(error); } }
    return result;
  }

  const accountFor = job => accounts.get(job.destination?.accountId);
  const adapterFor = job => adapters.get(accountFor(job)?.provider);

  function resolvedMedia(draft, refs) {
    return (refs || []).map(ref => {
      const meta = draft.media[ref.mediaId];
      if (!meta) throw invalid('Graphic ' + ref.mediaId + ' was not uploaded to SMA.');
      return { ...meta, altText: ref.altText || '' };
    });
  }

  function readiness(draft, job) {
    if (job.kind === 'article') return { ready: false, problems: ['SMA does not publish WordPress articles. Schedule the original in WordPress.'] };
    const problems = [];
    const account = accountFor(job);
    const adapter = adapterFor(job);
    if (!account) problems.push('Choose a destination account.');
    else if (!adapter) problems.push('No connector is installed for ' + account.provider + '.');
    else {
      problems.push(...(adapter.accountProblems?.(account) || []));
      if (adapter.requiresCredentials && !getCredentials(account)) problems.push(account.label + ' is not connected. Add its access token on the server (' + (account.tokenEnv || 'tokenEnv') + ').');
    }
    let rendered;
    try {
      rendered = renderDelivery(job);
    } catch (error) {
      return { ready: false, problems: [...problems, error.message] };
    }
    problems.push(...rendered.problems);
    if (adapter && account) {
      const withMedia = {
        post: { text: rendered.post.text, media: resolvedMedia(draft, rendered.post.media) },
        comment: rendered.comment && { text: rendered.comment.text, media: resolvedMedia(draft, rendered.comment.media) }
      };
      problems.push(...capabilityProblems(adapter, account, withMedia));
    }
    return { ready: problems.length === 0, problems, rendered };
  }

  function view(job, draft = store.state) {
    const out = structuredClone(job);
    const ready = readiness(draft, job);
    const account = accountFor(job);
    const adapter = adapterFor(job);
    out.destination = job.destination && {
      ...job.destination,
      provider: account?.provider || null,
      channel: account ? account.channel || ({ linkedin: 'LinkedIn', x: 'X', webhook: 'Website' })[account.provider] || null : null,
      accountLabel: account?.label || null,
      commentLabel: adapter?.commentLabel || 'first comment',
      simulated: adapter ? !adapter.live : null
    };
    out.readiness = { ready: ready.ready, problems: ready.problems };
    if (ready.rendered) out.preview = { postText: ready.rendered.post.text, commentText: ready.rendered.comment?.text ?? null };
    out.review.editedSinceApproval = job.review.status === 'approved' && job.review.approvedContentVersion !== job.contentVersion;
    const social = job.kind === 'social';
    out.allowedActions = {
      edit: PRE_DELIVERY.has(job.status) || (job.status === 'published' && COMMENT_OPEN.has(job.comment.status)),
      schedule: social && PRE_DELIVERY.has(job.status),
      publishNow: social && PRE_DELIVERY.has(job.status),
      cancel: social && ['draft', 'scheduled', 'failed'].includes(job.status),
      retryComment: job.status === 'published' && ['failed', 'cancelled'].includes(job.comment.status),
      cancelComment: job.status === 'published' && ['scheduled', 'failed'].includes(job.comment.status),
      resolve: job.status === 'uncertain' || job.comment.status === 'uncertain'
    };
    return out;
  }

  // ---------- input ----------
  function normaliseFirstComment(draft, value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') throw invalid('firstComment must be an object.');
    const text = String(value.text ?? '');
    const mediaRefs = normaliseMediaRefs(draft, value.media);
    let timing = { delayMinutes: 0 };
    if (value.timing?.local !== undefined || value.timing?.at !== undefined) {
      timing = parseSchedule(value.timing);
    } else if (value.timing?.delayMinutes !== undefined) {
      const delay = Number(value.timing.delayMinutes);
      if (!Number.isInteger(delay) || delay < 0 || delay > 7 * 24 * 60) throw invalid('Set the comment delay in whole minutes (0 to 10080).');
      timing = { delayMinutes: delay };
    }
    return { text, media: mediaRefs, timing };
  }
  function normaliseMediaRefs(draft, list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) throw invalid('media must be a list.');
    return list.map(item => {
      const ref = typeof item === 'string' ? { mediaId: item } : item;
      if (!ref?.mediaId || !draft.media[ref.mediaId]) throw invalid('Upload graphic ' + (ref?.mediaId || '') + ' to SMA before attaching it.');
      return { mediaId: ref.mediaId, altText: String(ref.altText || '').slice(0, 1000) };
    });
  }
  function applyFields(draft, job, input) {
    let contentChanged = false;
    const set = (key, value) => {
      if (JSON.stringify(job[key]) !== JSON.stringify(value)) { job[key] = value; if (key !== 'title') contentChanged = true; }
    };
    if ('title' in input) set('title', String(input.title ?? '').slice(0, 300));
    if ('accountId' in input || 'destination' in input) {
      const accountId = input.accountId ?? input.destination?.accountId ?? null;
      if (accountId && !accounts.has(accountId)) throw invalid('Unknown destination account ' + accountId + '.');
      set('destination', accountId ? { accountId } : null);
    }
    if ('text' in input || 'copy' in input) set('copy', { text: String(input.text ?? input.copy?.text ?? '') });
    if ('media' in input) set('media', normaliseMediaRefs(draft, input.media));
    if ('permalink' in input) {
      const p = input.permalink;
      const url = cleanUrl(typeof p === 'string' ? p : p?.url);
      const placement = (typeof p === 'object' && p?.placement) || 'post';
      if (!['post', 'comment'].includes(placement)) throw invalid('Put the permalink in the post or the first comment.');
      set('permalink', url ? { url, placement } : null);
    }
    if ('firstComment' in input) set('firstComment', normaliseFirstComment(draft, input.firstComment));
    if ('reviewCopy' in input) set('reviewCopy', String(input.reviewCopy ?? ''));
    if ('wordpressSchedule' in input) set('wordpressSchedule', input.wordpressSchedule ? parseSchedule(input.wordpressSchedule) : null);
    if (contentChanged) job.contentVersion += 1;
    return contentChanged;
  }

  function newJob(kind, actor) {
    const at = nowIso();
    return {
      id: randomUUID(), kind, version: 1, contentVersion: 1, createdAt: at, updatedAt: at, createdBy: who(actor),
      title: '', destination: null, copy: { text: '' }, media: [], permalink: null, firstComment: null,
      reviewCopy: kind === 'article' ? '' : undefined,
      schedule: null, status: 'draft', authorization: null,
      review: { status: 'not_requested', requestedAt: null, dueAt: null, decidedBy: null, decidedAt: null, approvedContentVersion: null, notes: [] },
      delivery: { intendedAt: null, attempts: 0, retryCount: 0, nextAttemptAt: null, startedAt: null, deliveredAt: null, providerPostId: null, providerUrl: null, renderedText: null, error: null, nextReconcileAt: null, reconcileCount: 0 },
      comment: { status: 'none', intendedAt: null, attempts: 0, retryCount: 0, nextAttemptAt: null, startedAt: null, deliveredAt: null, providerCommentId: null, providerUrl: null, renderedText: null, error: null, nextReconcileAt: null, reconcileCount: 0 },
      history: []
    };
  }

  function authorise(draft, job, actor, scheduleInput, mode) {
    if (job.kind === 'article') throw unsupported('SMA does not publish WordPress articles. Schedule the original in WordPress; SMA only keeps the review copy.');
    if (!PRE_DELIVERY.has(job.status)) throw stateConflict(job);
    const t = clock.now();
    const schedule = mode === 'publish_now' ? { local: null, timeZone: 'UTC', at: iso(t) } : parseSchedule(scheduleInput);
    if (mode === 'schedule' && Date.parse(schedule.at) < t - PAST_TOLERANCE_MS) {
      throw invalid('That time has already passed (' + schedule.at + '). Choose a later time or use Publish now.');
    }
    const ready = readiness(draft, job);
    if (!ready.ready) throw unsupported('This post cannot be delivered as submitted.', { problems: ready.problems });
    const wasScheduled = job.status === 'scheduled';
    job.status = 'scheduled';
    job.schedule = schedule;
    job.authorization = { by: who(actor), at: iso(t), contentVersion: job.contentVersion, mode };
    Object.assign(job.delivery, { intendedAt: schedule.at, nextAttemptAt: null, retryCount: 0, error: null });
    if (job.comment.status !== 'none') Object.assign(job.comment, { status: 'none', error: null });
    record(draft, job, mode === 'publish_now' ? 'publish_now_requested' : wasScheduled ? 'rescheduled' : 'scheduled', actor, {
      intendedAt: schedule.at, ...(schedule.local ? { local: schedule.local, timeZone: schedule.timeZone } : {}), ...(schedule.ambiguous ? { ambiguous: true } : {}),
      reviewStatus: job.review.status
    });
  }

  function stateConflict(job) {
    const messages = {
      publishing: ['delivery_in_progress', 'SMA is sending this post right now.'],
      published: ['already_published', 'This post is already published.'],
      uncertain: ['delivery_uncertain', 'SMA cannot tell whether the last attempt reached the provider. Confirm what happened first.']
    };
    const [code, message] = messages[job.status] || ['invalid_state', 'This post cannot change in its current state (' + job.status + ').'];
    return conflict(code, message, { status: job.status });
  }

  function commentIntendedAt(job, deliveredMs) {
    const timing = job.firstComment?.timing || { delayMinutes: 0 };
    if (timing.at) return iso(Math.max(Date.parse(timing.at), deliveredMs));
    return iso(deliveredMs + (timing.delayMinutes || 0) * 60000);
  }

  function markPublished(draft, job, { id, url }, deliveredMs, how) {
    job.status = 'published';
    Object.assign(job.delivery, { deliveredAt: iso(deliveredMs), providerPostId: id, providerUrl: url || null, error: null, nextAttemptAt: null, nextReconcileAt: null, confirmedBy: how });
    const rendered = renderDelivery(job);
    if (rendered.comment) {
      Object.assign(job.comment, { status: 'scheduled', intendedAt: commentIntendedAt(job, deliveredMs), renderedText: rendered.comment.text, nextAttemptAt: null, retryCount: 0, error: null });
    } else {
      job.comment.status = 'none';
    }
    record(draft, job, 'published', null, { providerPostId: id, providerUrl: url || null, deliveredAt: iso(deliveredMs), via: how });
  }

  // ---------- public operations ----------
  async function createPost(actor, input = {}, { idempotencyKey } = {}) {
    requireOwner(actor);
    if (typeof input !== 'object') throw invalid('Send the post as JSON.');
    const key = idempotencyKey || input.idempotencyKey;
    const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, idempotencyKey: undefined })).digest('hex');
    return commit(draft => {
      if (key) {
        const seen = draft.idempotency[key];
        if (seen) {
          if (seen.fingerprint !== fingerprint) throw conflict('idempotency_key_reused', 'This submission key was already used for different content.');
          return { post: view(draft.jobs[seen.jobId], draft), duplicate: true };
        }
      }
      const kind = input.kind === 'article' ? 'article' : 'social';
      const job = newJob(kind, actor);
      applyFields(draft, job, input);
      job.contentVersion = 1;
      draft.jobs[job.id] = job;
      record(draft, job, 'created', actor);
      if (input.publishNow) authorise(draft, job, actor, null, 'publish_now');
      else if (input.schedule) authorise(draft, job, actor, input.schedule, 'schedule');
      if (input.publishNow || input.schedule) check(input.publishNow ? 'publish_now' : 'schedule', job, Object.keys(input));
      if (key) draft.idempotency[key] = { jobId: job.id, fingerprint, at: nowIso() };
      return { post: view(job, draft), duplicate: false };
    }).finally(kick);
  }

  async function updatePost(actor, id, patch = {}, { expectedVersion } = {}) {
    requireOwner(actor);
    return commit(draft => {
      const job = jobIn(draft, id);
      checkVersion(job, expectedVersion ?? patch.expectedVersion);
      const keys = Object.keys(patch).filter(k => !['expectedVersion', 'schedule', 'publishNow'].includes(k));
      if (patch.schedule && patch.publishNow) throw invalid('Choose a schedule or publish now.');
      if ((patch.schedule || patch.publishNow) && !PRE_DELIVERY.has(job.status)) throw stateConflict(job);
      if (job.status === 'published') {
        const allowed = keys.every(k => k === 'title' || k === 'firstComment');
        if (!allowed) throw conflict('already_published', 'This post is already published. Only its title and an unsent first comment can change.');
        if (keys.includes('firstComment') && !COMMENT_OPEN.has(job.comment.status)) throw conflict('comment_' + job.comment.status, 'The first comment is ' + job.comment.status + ' and can no longer change.');
      } else if (!PRE_DELIVERY.has(job.status)) {
        throw stateConflict(job);
      }
      const changed = applyFields(draft, job, Object.fromEntries(keys.map(k => [k, patch[k]])));
      if (patch.publishNow) {
        authorise(draft, job, actor, null, 'publish_now');
      } else if (patch.schedule) {
        authorise(draft, job, actor, patch.schedule, 'schedule');
      } else if (job.status === 'scheduled') {
        const ready = readiness(draft, job);
        if (!ready.ready) throw unsupported('This post is scheduled, and the change would stop it from being delivered.', { problems: ready.problems });
        job.authorization = { ...job.authorization, contentVersion: job.contentVersion };
      }
      if (job.status === 'published' && keys.includes('firstComment')) {
        const rendered = renderDelivery(job);
        if (rendered.comment) {
          const ready = readiness(draft, job);
          if (!ready.ready) throw unsupported('The first comment cannot be delivered as submitted.', { problems: ready.problems });
          Object.assign(job.comment, { renderedText: rendered.comment.text, intendedAt: commentIntendedAt(job, Date.parse(job.delivery.deliveredAt)) });
          if (job.comment.status === 'none') job.comment.status = 'scheduled';
        } else {
          job.comment.status = 'none';
        }
      }
      check(patch.publishNow ? 'publish_now' : patch.schedule ? 'schedule' : 'edit', job, keys);
      touch(job);
      record(draft, job, 'edited', actor, { contentChanged: changed, contentVersion: job.contentVersion, fields: keys });
      return view(job, draft);
    }).finally(kick);
  }

  async function schedulePost(actor, id, schedule, { expectedVersion } = {}) {
    requireOwner(actor);
    return commit(draft => {
      const job = jobIn(draft, id);
      checkVersion(job, expectedVersion);
      authorise(draft, job, actor, schedule, 'schedule');
      check('schedule', job, ['schedule']);
      touch(job);
      return view(job, draft);
    }).finally(kick);
  }

  async function publishNow(actor, id, { expectedVersion } = {}) {
    requireOwner(actor);
    const result = await commit(draft => {
      const job = jobIn(draft, id);
      if (['publishing', 'published', 'uncertain'].includes(job.status)) return { post: view(job, draft), alreadyRequested: true };
      if (job.status === 'scheduled' && job.authorization?.mode === 'publish_now') return { post: view(job, draft), alreadyRequested: true };
      checkVersion(job, expectedVersion);
      authorise(draft, job, actor, null, 'publish_now');
      check('publish_now', job, ['publishNow']);
      touch(job);
      return { post: view(job, draft), alreadyRequested: false };
    });
    kick();
    return result;
  }

  async function cancelPost(actor, id) {
    requireOwner(actor);
    return commit(draft => {
      const job = jobIn(draft, id);
      if (job.status === 'cancelled') return view(job, draft);
      if (job.status === 'published' && ['scheduled', 'failed'].includes(job.comment.status)) {
        throw conflict('already_published', 'The post is already published. Cancel its first comment instead.');
      }
      if (!['draft', 'scheduled', 'failed'].includes(job.status)) throw stateConflict(job);
      check('cancel', job, []);
      job.status = 'cancelled';
      job.delivery.nextAttemptAt = null;
      touch(job);
      record(draft, job, 'cancelled', actor);
      return view(job, draft);
    });
  }

  async function reviewPost(actor, id, { action, note, dueAt } = {}) {
    requireActor(actor);
    const text = String(note ?? '').trim();
    return commit(draft => {
      const job = jobIn(draft, id);
      const review = job.review;
      const at = nowIso();
      const addNote = () => { if (text) review.notes.push({ author: who(actor), text, at, contentVersion: job.contentVersion }); };
      switch (action) {
        case 'request':
          requireOwner(actor);
          review.status = 'pending';
          review.requestedAt = at;
          review.dueAt = dueAt ? parseSchedule(dueAt).at : review.dueAt;
          addNote();
          break;
        case 'approve': // Niall's "Approve and suggest edits"
          if (actor.role !== ROLES.REVIEWER) throw forbidden('Use approve_self to approve as the owner.');
          Object.assign(review, { status: 'approved', decidedBy: who(actor), decidedAt: at, approvedContentVersion: job.contentVersion });
          addNote();
          break;
        case 'request_changes':
          if (actor.role !== ROLES.REVIEWER) throw forbidden('Only the reviewer can request changes.');
          if (!text) throw invalid('Say what should change.');
          Object.assign(review, { status: 'changes_requested', decidedBy: who(actor), decidedAt: at, approvedContentVersion: null });
          addNote();
          break;
        case 'approve_self':
          requireOwner(actor);
          Object.assign(review, { status: 'approved', decidedBy: who(actor), decidedAt: at, approvedContentVersion: job.contentVersion });
          addNote();
          break;
        case 'note':
          if (!text) throw invalid('Write a note first.');
          addNote();
          break;
        default:
          throw invalid('Unknown review action. Use request, approve, request_changes, approve_self, or note.');
      }
      job.version += 1;
      job.updatedAt = at;
      record(draft, job, 'review_' + action, actor, { reviewStatus: review.status, ...(text ? { note: text } : {}), ...(review.dueAt && action === 'request' ? { dueAt: review.dueAt } : {}) });
      return view(job, draft);
    });
  }

  async function retryComment(actor, id) {
    requireOwner(actor);
    const result = await commit(draft => {
      const job = jobIn(draft, id);
      if (job.status !== 'published' || !job.delivery.providerPostId) throw conflict('parent_not_published', 'The parent post has not been published yet, so there is nothing to comment on.');
      if (job.comment.status === 'sent') throw conflict('comment_sent', 'The first comment was already sent.');
      if (job.comment.status === 'uncertain') throw conflict('comment_uncertain', 'Confirm whether the last comment attempt reached the provider first.');
      if (job.comment.status === 'sending' || job.comment.status === 'scheduled') return view(job, draft);
      check('retry_comment', job, []);
      const rendered = renderDelivery(job);
      if (!rendered.comment) throw invalid('There is no first comment to send.');
      Object.assign(job.comment, { status: 'scheduled', intendedAt: nowIso(), nextAttemptAt: null, retryCount: 0, error: null, renderedText: rendered.comment.text });
      touch(job);
      record(draft, job, 'comment_retry_requested', actor);
      return view(job, draft);
    });
    kick();
    return result;
  }

  async function cancelComment(actor, id) {
    requireOwner(actor);
    return commit(draft => {
      const job = jobIn(draft, id);
      if (!['scheduled', 'failed'].includes(job.comment.status) || job.status !== 'published') {
        throw conflict('comment_' + job.comment.status, job.status !== 'published' ? 'Remove the first comment from the draft instead.' : 'The first comment is ' + job.comment.status + '.');
      }
      check('cancel_comment', job, []);
      job.comment.status = 'cancelled';
      touch(job);
      record(draft, job, 'comment_cancelled', actor);
      return view(job, draft);
    });
  }

  /** Owner confirms what happened after an uncertain attempt. */
  async function resolveUncertain(actor, id, { target = 'post', outcome, providerId, url } = {}) {
    requireOwner(actor);
    const result = await commit(draft => {
      const job = jobIn(draft, id);
      const part = target === 'comment' ? job.comment : job.delivery;
      const status = target === 'comment' ? job.comment.status : job.status;
      if (status !== 'uncertain') throw conflict('not_uncertain', 'Nothing to confirm: the ' + target + ' is ' + status + '.');
      check('resolve', job, [target]);
      if (outcome === 'delivered') {
        if (!providerId) throw invalid('Paste the provider ID of the ' + target + ' so SMA can track it' + (target === 'post' ? ' and send the first comment.' : '.'));
        const safeUrl = url ? cleanUrl(url) : null;
        const when = Date.parse(part.startedAt) || clock.now();
        if (target === 'post') markPublished(draft, job, { id: String(providerId), url: safeUrl }, when, 'owner');
        else {
          Object.assign(job.comment, { status: 'sent', deliveredAt: iso(when), providerCommentId: String(providerId), providerUrl: safeUrl, error: null, confirmedBy: 'owner' });
          record(draft, job, 'comment_sent', actor, { providerCommentId: String(providerId), via: 'owner' });
        }
      } else if (outcome === 'not_delivered') {
        const error = { code: 'confirmed_not_delivered', message: 'The owner confirmed the ' + target + ' did not reach the provider. Nothing is resent automatically.', retry: 'never', at: nowIso() };
        if (target === 'post') { job.status = 'failed'; job.delivery.error = error; job.delivery.nextReconcileAt = null; }
        else { job.comment.status = 'failed'; job.comment.error = error; job.comment.nextReconcileAt = null; }
        record(draft, job, target + '_confirmed_not_delivered', actor);
      } else {
        throw invalid('Set outcome to delivered or not_delivered.');
      }
      touch(job);
      return view(job, draft);
    });
    kick();
    return result;
  }

  function getPost(id) {
    const job = store.state.jobs[id];
    if (!job) throw notFound('Post not found.');
    return view(job);
  }

  function listPosts({ status, provider, kind, from, to } = {}) {
    const statuses = status ? String(status).split(',') : null;
    return Object.values(store.state.jobs)
      .filter(job => !statuses || statuses.includes(job.status))
      .filter(job => !kind || job.kind === kind)
      .filter(job => !provider || accountFor(job)?.provider === provider)
      .filter(job => !from || (job.schedule && job.schedule.at >= new Date(from).toISOString()))
      .filter(job => !to || (job.schedule && job.schedule.at <= new Date(to).toISOString()))
      .sort((a, b) => (a.schedule?.at || a.createdAt).localeCompare(b.schedule?.at || b.createdAt))
      .map(job => view(job));
  }

  function listAccounts() {
    return [...accounts.values()].map(account => {
      const adapter = adapters.get(account.provider);
      const caps = adapter?.capabilities(account);
      return {
        id: account.id,
        provider: account.provider,
        channel: account.channel || ({ linkedin: 'LinkedIn', x: 'X', webhook: 'Website' })[account.provider] || null,
        label: account.label || account.id,
        ...(account.site ? { site: account.site } : account.endpoint && /^https:/.test(account.endpoint) ? { site: new URL(account.endpoint).origin } : {}),
        ...(account.logo ? { logo: account.logo } : {}),
        connector: adapter ? adapter.label : null,
        simulated: adapter ? !adapter.live : null,
        connected: Boolean(adapter) && (!adapter.requiresCredentials || Boolean(getCredentials(account))),
        problems: adapter ? adapter.accountProblems?.(account) || [] : ['No connector installed for ' + account.provider + '.'],
        commentLabel: adapter?.commentLabel || null,
        capabilities: caps && {
          text: { maxLength: caps.text.maxLength, unit: caps.text.unit || 'characters' },
          media: caps.media && { maxItems: caps.media.maxItems, mimeTypes: caps.media.mimeTypes, maxBytes: caps.media.maxBytes },
          comment: caps.comment && { supported: caps.comment.supported, maxLength: caps.comment.maxLength, media: Boolean(caps.comment.media) }
        }
      };
    });
  }

  async function saveMedia(actor, { name, dataUrl, base64, mimeType } = {}) {
    requireOwner(actor);
    const decoded = decodeUpload({ dataUrl, base64, mimeType });
    const meta = await media.put({ name, ...decoded });
    meta.uploadedAt = nowIso();
    meta.uploadedBy = who(actor);
    await commit(draft => { draft.media[meta.id] = meta; });
    return publicMedia(meta);
  }
  const publicMedia = meta => ({ id: meta.id, name: meta.name, mimeType: meta.mimeType, size: meta.size, sha256: meta.sha256, uploadedAt: meta.uploadedAt });
  async function getMedia(id) {
    const meta = store.state.media[id];
    if (!meta) throw notFound('Graphic not found.');
    return { ...publicMedia(meta), bytes: await media.read(meta) };
  }
  const listMedia = () => Object.values(store.state.media).map(publicMedia);
  const listEvents = ({ since = 0 } = {}) => store.state.events.filter(e => e.seq > Number(since));

  // ---------- external scheduler (@Human mode) ----------
  const REMOTE_STATUS = new Set(['scheduled', 'publishing', 'published', 'failed', 'uncertain', 'cancelled']);
  const REMOTE_COMMENT = new Set(['none', 'scheduled', 'sending', 'sent', 'failed', 'uncertain', 'cancelled']);

  /**
   * Apply what an external scheduler reports (the values of an @Human sma_post record) to the local
   * post, and record events so the calendar and history show the real result. Returns the post view,
   * or null when nothing changed.
   */
  async function applyRemoteDelivery(id, remote, { via = '@Human' } = {}) {
    return commit(draft => {
      const job = draft.jobs[id];
      if (!job || !REMOTE_STATUS.has(remote.status)) return null;
      const text = key => (remote[key] ?? '') === '' ? null : String(remote[key]);
      const time = key => { const ms = Date.parse(text(key) || ''); return Number.isNaN(ms) ? null : iso(ms); };
      const count = key => { const n = Number(remote[key] || 0); return Number.isFinite(n) ? n : 0; };
      const error = prefix => text(prefix + 'error_code')
        ? { code: text(prefix + 'error_code'), message: text(prefix + 'error_message') || '', retry: text(prefix + 'error_retry') || 'never', via }
        : null;
      const before = JSON.stringify([job.status, job.delivery, job.comment]);
      const prev = { status: job.status, retry: job.delivery.retryCount, comment: job.comment.status, commentRetry: job.comment.retryCount };
      job.status = remote.status;
      Object.assign(job.delivery, {
        attempts: count('attempts'), retryCount: count('retry_count'), nextAttemptAt: time('next_attempt_at'),
        startedAt: time('started_at'), deliveredAt: time('delivered_at'), providerPostId: text('provider_post_id'),
        providerUrl: text('provider_url'), renderedText: text('rendered_text') ?? job.delivery.renderedText,
        error: error(''), confirmedBy: text('confirmed_by') || job.delivery.confirmedBy || null
      });
      const commentStatus = REMOTE_COMMENT.has(remote.comment_status) ? remote.comment_status : 'none';
      Object.assign(job.comment, {
        status: commentStatus, intendedAt: time('comment_intended_at') ?? job.comment.intendedAt,
        attempts: count('comment_attempts'), retryCount: count('comment_retry_count'), nextAttemptAt: time('comment_next_attempt_at'),
        startedAt: time('comment_started_at'), deliveredAt: time('comment_delivered_at'), providerCommentId: text('provider_comment_id'),
        providerUrl: text('comment_provider_url'), renderedText: text('comment_rendered_text') ?? job.comment.renderedText, error: error('comment_')
      });
      if (JSON.stringify([job.status, job.delivery, job.comment]) === before) return null;
      touch(job);
      const d = job.delivery;
      if (job.status !== prev.status || (job.status === 'scheduled' && d.retryCount > prev.retry)) {
        const events = {
          publishing: ['delivery_started', { attempt: d.attempts }],
          published: ['published', { providerPostId: d.providerPostId, providerUrl: d.providerUrl, deliveredAt: d.deliveredAt }],
          failed: ['post_failed', { error: d.error }],
          uncertain: ['post_uncertain', { error: d.error }],
          cancelled: ['cancelled', {}],
          scheduled: d.retryCount > prev.retry ? ['post_retry_scheduled', { error: d.error && { ...d.error, willRetryAt: d.nextAttemptAt } }] : ['remote_status', { status: 'scheduled' }]
        };
        const [type, detail] = events[job.status];
        record(draft, job, type, null, { ...detail, via });
      }
      const c = job.comment;
      if (c.status !== prev.comment || (c.status === 'scheduled' && c.retryCount > prev.commentRetry)) {
        const events = {
          sending: ['comment_sending', { attempt: c.attempts }],
          sent: ['comment_sent', { providerCommentId: c.providerCommentId, providerUrl: c.providerUrl, deliveredAt: c.deliveredAt }],
          failed: ['comment_failed', { error: c.error }],
          uncertain: ['comment_uncertain', { error: c.error }],
          cancelled: ['comment_cancelled', {}],
          scheduled: c.retryCount > prev.commentRetry ? ['comment_retry_scheduled', { error: c.error }] : ['comment_scheduled', { intendedAt: c.intendedAt }]
        };
        if (events[c.status]) { const [type, detail] = events[c.status]; record(draft, job, type, null, { ...detail, via }); }
      }
      return view(job, draft);
    });
  }

  /** Record the outcome of handing a post to an external scheduler. Failures show as the post's error. */
  async function noteRemoteSync(id, { ok, type, message, code, recordId, via = '@Human' } = {}) {
    return commit(draft => {
      const job = draft.jobs[id];
      if (!job) return null;
      if (ok) {
        job.external = { via, recordId: recordId || job.external?.recordId || null, syncedAt: nowIso() };
        if (job.delivery.error?.code?.startsWith('human_')) { job.delivery.error = null; touch(job); }
      } else {
        job.delivery.error = { code: code || 'human_sync_failed', message: message || 'SMA could not reach @Human.', retry: 'never', at: nowIso(), via };
        touch(job);
      }
      record(draft, job, type || (ok ? 'handed_to_scheduler' : 'scheduler_sync_failed'), null, { via, ...(recordId ? { recordId } : {}), ...(message ? { message } : {}) });
      return view(job, draft);
    });
  }

  // ---------- delivery ----------
  async function withTimeout(work) {
    const controller = new AbortController();
    let handle;
    const timeout = new Promise((_, reject) => {
      handle = timers.setTimeout(() => {
        controller.abort();
        reject(new ProviderError('provider_timeout', 'The provider did not answer within ' + Math.round(deliveryTimeoutMs / 1000) + ' seconds. The post may or may not exist.', { retry: 'unsafe' }));
      }, deliveryTimeoutMs);
      handle?.unref?.();
    });
    try {
      return await Promise.race([work(controller.signal), timeout]);
    } finally {
      timers.clearTimeout(handle);
    }
  }

  async function loadMedia(refs) {
    const out = [];
    for (const ref of refs) {
      const meta = store.state.media[ref.mediaId];
      if (!meta) throw new ProviderError('media_missing', 'Graphic ' + ref.mediaId + ' is missing. Nothing was sent.', { retry: 'never' });
      try {
        out.push({ name: meta.name, mimeType: meta.mimeType, sha256: meta.sha256, size: meta.size, altText: ref.altText, bytes: await media.read(meta) });
      } catch (error) {
        throw new ProviderError('media_unreadable', error.message + ' Nothing was sent.', { retry: 'never' });
      }
    }
    return out;
  }

  function dueAt(part, fallback) { return Date.parse(part.nextAttemptAt || fallback); }

  function pickNext(t) {
    let best = null;
    const consider = (at, item) => { if (at <= t && (!best || at < best.at)) best = { at, ...item }; };
    for (const job of Object.values(store.state.jobs)) {
      if (job.kind !== 'social') continue;
      const adapter = adapterFor(job);
      if (job.status === 'scheduled') consider(dueAt(job.delivery, job.schedule.at), { type: 'post', id: job.id });
      if (job.status === 'published' && job.comment.status === 'scheduled') consider(dueAt(job.comment, job.comment.intendedAt), { type: 'comment', id: job.id });
      if (adapter?.reconcile) {
        if (job.status === 'uncertain' && job.delivery.nextReconcileAt) consider(Date.parse(job.delivery.nextReconcileAt), { type: 'reconcile', target: 'post', id: job.id });
        if (job.comment.status === 'uncertain' && job.comment.nextReconcileAt) consider(Date.parse(job.comment.nextReconcileAt), { type: 'reconcile', target: 'comment', id: job.id });
      }
    }
    return best;
  }

  function nextWakeAt() {
    let next = null;
    for (const job of Object.values(store.state.jobs)) {
      const candidates = [];
      if (job.kind === 'social' && job.status === 'scheduled') candidates.push(dueAt(job.delivery, job.schedule.at));
      if (job.status === 'published' && job.comment.status === 'scheduled') candidates.push(dueAt(job.comment, job.comment.intendedAt));
      if (job.delivery.nextReconcileAt) candidates.push(Date.parse(job.delivery.nextReconcileAt));
      if (job.comment.nextReconcileAt) candidates.push(Date.parse(job.comment.nextReconcileAt));
      for (const c of candidates) if (next === null || c < next) next = c;
    }
    return next;
  }

  function applyFailure(draft, job, target, error, t) {
    const part = target === 'post' ? job.delivery : job.comment;
    const e = asProviderError(error);
    const rec = errorRecord(e, t);
    part.error = rec;
    if (e.retry === 'safe' && part.retryCount < retryDelaysMs.length) {
      const wait = Math.max(retryDelaysMs[part.retryCount], e.retryAfterMs || 0);
      part.retryCount += 1;
      part.nextAttemptAt = iso(t + wait);
      rec.willRetryAt = part.nextAttemptAt;
      if (target === 'post') job.status = 'scheduled'; else job.comment.status = 'scheduled';
      record(draft, job, target + '_retry_scheduled', null, { error: rec });
    } else if (e.retry === 'unsafe') {
      if (target === 'post') job.status = 'uncertain'; else job.comment.status = 'uncertain';
      part.nextAttemptAt = null;
      part.reconcileCount = 0;
      part.nextReconcileAt = adapterFor(job)?.reconcile ? iso(t + reconcileDelaysMs[0]) : null;
      record(draft, job, target + '_uncertain', null, { error: rec });
    } else {
      if (target === 'post') job.status = 'failed'; else job.comment.status = 'failed';
      part.nextAttemptAt = null;
      record(draft, job, target + '_failed', null, { error: rec });
    }
    touch(job);
  }

  async function deliver(item) {
    const { id, type: target } = item;
    const snapshot = store.state.jobs[id];
    const account = accountFor(snapshot);
    const adapter = adapterFor(snapshot);
    const credentials = account && adapter?.requiresCredentials ? await getCredentials(account) : null;

    // Claim the attempt durably before calling the provider. After a crash the job is found
    // in `publishing`/`sending` and is treated as uncertain, never re-sent blindly.
    const claim = await commit(draft => {
      const job = draft.jobs[id];
      const t = clock.now();
      const part = target === 'post' ? job.delivery : job.comment;
      const stillDue = target === 'post' ? job.status === 'scheduled' : job.status === 'published' && job.comment.status === 'scheduled';
      if (!stillDue) return null;
      const intended = Date.parse(target === 'post' ? job.schedule.at : job.comment.intendedAt);
      const manual = target === 'post' ? job.authorization?.mode === 'publish_now' : false;
      if (part.retryCount === 0 && !manual && t - intended > missedGraceMs) {
        const rec = { code: 'missed_schedule', message: 'SMA was not running at ' + iso(intended) + ' and the time is more than ' + Math.round(missedGraceMs / 60000) + ' minutes past. Nothing was sent. Reschedule or publish now.', retry: 'never', at: iso(t) };
        part.error = rec;
        if (target === 'post') job.status = 'failed'; else job.comment.status = 'failed';
        touch(job);
        record(draft, job, target + '_missed', null, { error: rec });
        return null;
      }
      const ready = readiness(draft, job);
      if (target === 'post' && !ready.ready) {
        applyFailure(draft, job, target, new ProviderError('not_ready', 'Not sent: ' + ready.problems.join(' '), { retry: 'never' }), t);
        return null;
      }
      const rendered = ready.rendered || renderDelivery(job);
      const content = target === 'post' ? rendered.post : rendered.comment;
      if (!content) {
        job.comment.status = 'none';
        touch(job);
        return null;
      }
      part.attempts += 1;
      part.attemptId = randomUUID();
      part.startedAt = iso(t);
      part.renderedText = content.text;
      if (target === 'post') job.status = 'publishing'; else job.comment.status = 'sending';
      touch(job);
      record(draft, job, target === 'post' ? 'delivery_started' : 'comment_sending', null, { attempt: part.attempts });
      return { attemptId: part.attemptId, content, parent: { id: job.delivery.providerPostId, url: job.delivery.providerUrl }, job: structuredClone(job) };
    });
    if (!claim) return false;

    let result;
    let failure;
    try {
      if (!account || !adapter) throw new ProviderError('not_ready', 'The destination account or connector is missing. Nothing was sent.', { retry: 'never' });
      if (adapter.requiresCredentials && !credentials) throw new ProviderError('not_connected', account.label + ' has no access token on the server. Nothing was sent.', { retry: 'never' });
      const mediaItems = await loadMedia(claim.content.media);
      const args = { account, credentials, text: claim.content.text, media: mediaItems };
      result = await withTimeout(signal => target === 'post'
        ? adapter.publishPost({ ...args, signal })
        : adapter.publishComment({ ...args, parent: claim.parent, signal }));
      if (!result?.id) throw new ProviderError('provider_missing_id', adapter.label + ' reported success without an ID. SMA cannot confirm the ' + target + '.', { retry: 'unsafe' });
    } catch (error) {
      failure = error;
    }

    await commit(draft => {
      const job = draft.jobs[id];
      const part = target === 'post' ? job.delivery : job.comment;
      if (part.attemptId !== claim.attemptId) return; // superseded (should not happen while in flight)
      const t = clock.now();
      if (failure) return applyFailure(draft, job, target, failure, t);
      if (target === 'post') markPublished(draft, job, result, t, 'provider');
      else {
        Object.assign(job.comment, { status: 'sent', deliveredAt: iso(t), providerCommentId: String(result.id), providerUrl: result.url || null, error: null, nextAttemptAt: null });
        record(draft, job, 'comment_sent', null, { providerCommentId: String(result.id), providerUrl: result.url || null, deliveredAt: iso(t) });
      }
      touch(job);
    });
    return true;
  }

  async function reconcile(item) {
    const { id, target } = item;
    const job = store.state.jobs[id];
    const account = accountFor(job);
    const adapter = adapterFor(job);
    const part = target === 'post' ? job.delivery : job.comment;
    let answer;
    try {
      const credentials = adapter.requiresCredentials ? await getCredentials(account) : null;
      answer = await withTimeout(signal => adapter.reconcile({
        account, credentials, target, job: view(job), signal, text: part.renderedText,
        parent: target === 'comment' ? { id: job.delivery.providerPostId, url: job.delivery.providerUrl } : null
      }));
    } catch (error) {
      answer = { status: 'unknown', error: asProviderError(error).message };
    }
    await commit(draft => {
      const current = draft.jobs[id];
      const p = target === 'post' ? current.delivery : current.comment;
      const status = target === 'post' ? current.status : current.comment.status;
      if (status !== 'uncertain') return;
      const t = clock.now();
      if (answer?.status === 'delivered' && answer.id) {
        const when = Date.parse(p.startedAt) || t;
        if (target === 'post') markPublished(draft, current, answer, when, 'reconciled');
        else {
          Object.assign(current.comment, { status: 'sent', deliveredAt: iso(when), providerCommentId: String(answer.id), providerUrl: answer.url || null, nextReconcileAt: null, confirmedBy: 'reconciled' });
          record(draft, current, 'comment_sent', null, { providerCommentId: String(answer.id), via: 'reconciled' });
        }
      } else if (answer?.status === 'not_delivered') {
        p.nextReconcileAt = null;
        p.nextAttemptAt = iso(t);
        if (target === 'post') current.status = 'scheduled'; else current.comment.status = 'scheduled';
        record(draft, current, target + '_reconciled_not_delivered', null, {});
      } else {
        p.reconcileCount += 1;
        p.nextReconcileAt = p.reconcileCount < reconcileDelaysMs.length ? iso(t + reconcileDelaysMs[p.reconcileCount]) : null;
        record(draft, current, target + '_reconcile_inconclusive', null, { ...(answer?.error ? { error: answer.error } : {}), nextCheck: p.nextReconcileAt });
      }
      touch(current);
    });
  }

  /** Send everything that is due now. Safe to call repeatedly; runs one batch at a time. */
  function runDue() {
    if (running) return running.then(() => runDue());
    running = (async () => {
      const summary = { delivered: 0, checked: 0 };
      for (let guard = 0; guard < 10000; guard++) {
        const item = pickNext(clock.now());
        if (!item) break;
        if (item.type === 'reconcile') { await reconcile(item); summary.checked += 1; }
        else if (await deliver(item)) summary.delivered += 1;
      }
      return summary;
    })().finally(() => { running = null; });
    return running;
  }

  function kick() {
    if (!started) return;
    timers.clearTimeout(timer);
    timer = timers.setTimeout(tick, 0);
    timer.unref?.();
  }
  async function tick() {
    timer = null;
    try { await runDue(); } catch (error) { logger.error?.('Publishing queue error:', error); }
    if (!started) return;
    const next = nextWakeAt();
    const delay = next === null ? pollIntervalMs : Math.min(Math.max(0, next - clock.now()), pollIntervalMs);
    timer = timers.setTimeout(tick, delay);
    timer.unref?.();
  }

  // Crash recovery: anything mid-flight when the process stopped is uncertain.
  if (recoverOnStart) await commit(draft => {
    for (const job of Object.values(draft.jobs)) {
      const t = clock.now();
      const interrupted = (target, part) => {
        part.error = { code: 'interrupted', message: 'The server stopped while this ' + target + ' was being sent. SMA cannot tell whether it reached the provider.', retry: 'unsafe', at: iso(t) };
        part.reconcileCount = 0;
        part.nextReconcileAt = adapterFor(job)?.reconcile ? iso(t) : null;
        record(draft, job, target + '_uncertain', null, { error: part.error });
        touch(job);
      };
      if (job.status === 'publishing') { job.status = 'uncertain'; interrupted('post', job.delivery); }
      if (job.comment.status === 'sending') { job.comment.status = 'uncertain'; interrupted('comment', job.comment); }
    }
  });

  return {
    roles: ROLES,
    delivery,
    adapters,
    // posts
    createPost, updatePost, schedulePost, publishNow, cancelPost, reviewPost,
    retryComment, cancelComment, resolveUncertain, getPost, listPosts,
    // media, accounts, events
    saveMedia, getMedia, listMedia, listAccounts, listEvents,
    // external scheduler (@Human mode)
    applyRemoteDelivery, noteRemoteSync,
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    // scheduler
    runDue,
    start() { if (!started) { started = true; kick(); } return this; },
    async stop() { started = false; timers.clearTimeout(timer); timer = null; if (running) await running.catch(() => {}); },
    nextWakeAt: () => { const n = nextWakeAt(); return n === null ? null : iso(n); }
  };
}

export { PublishingError };
