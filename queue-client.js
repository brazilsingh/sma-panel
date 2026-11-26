'use strict';

if (/^https?:$/.test(location.protocol)) connectPublishingQueue();

async function connectPublishingQueue() {
  const label = document.querySelector('.mode');
  const endpoint = '/api/publishing';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const terminalLabels = {
    draft: 'Draft', scheduled: 'Scheduled', publishing: 'Publishing', published: 'Published',
    failed: 'Failed', uncertain: 'Needs confirmation', cancelled: 'Cancelled',
    none: '', sending: 'Sending', sent: 'Published'
  };
  // Shared by refresh(), save() and the poller, which live outside the try block.
  let busy = false;
  let refreshing = false;
  let snapshot = '';
  try {
    const config = await request('/api/workspace');
    if (!config.publishing) throw new Error('The publishing queue is unavailable.');
    queueClient = {
      // @Human mode is live delivery for every screen; only the label says who sends.
      delivery: config.delivery === 'human' ? 'live' : config.delivery, scheduler: config.delivery === 'human' ? '@Human' : 'SMA',
      integrations:config.integrations || {}, items: [], assets: [], events: [], accounts: [],
      save, upload, fields, actions, bulk, addNote, reschedule
    };
    label.textContent = config.delivery === 'human' ? 'Live delivery · @Human scheduler' : config.delivery === 'live' ? 'Live delivery' : 'Server queue · Simulation';
    await refresh();
    suite?.openSharedPost();
    if (editor.open && active && !active.remote) openItem(currentForm());
    setInterval(() => { if (!busy) refresh().catch(() => {}); }, 5000);
  } catch (error) {
    // Opened without the SMA server (a shared preview): run as a browser demo with example data.
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      label.textContent = 'Demo · example data, nothing is sent';
      return;
    }
    label.textContent = 'Queue unavailable';
    show(error.message);
  }

  async function request(path, method = 'GET', data, extra = {}) {
    const headers = method === 'GET' ? extra : { 'Content-Type': 'application/json', ...extra };
    const response = await fetch(path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const problems = result.details?.problems;
      throw new Error([result.error || 'Publishing request failed.', ...(Array.isArray(problems) ? problems : [])].join(' '));
    }
    return result;
  }

  function formDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(+date)) return '';
    return dayKey(date) + 'T' + date.toTimeString().slice(0, 5);
  }

  function asItem(post) {
    const timing = post.firstComment?.timing;
    const schedule = post.kind === 'article' ? post.wordpressSchedule : post.schedule;
    const review = post.review;
    return {
      ...blank(),
      remote: post,
      id: post.id,
      channel: post.kind === 'article' ? 'WordPress' : post.destination?.channel || accountChannel({ provider: post.destination?.provider || 'linkedin' }),
      accountId: post.destination?.accountId || '',
      title: post.title,
      body: post.kind === 'article' ? post.reviewCopy : post.copy.text,
      asset: post.media[0]?.mediaId || '',
      altText: post.media[0]?.altText || '',
      date: schedule?.local || formDate(schedule?.at),
      timeZone: schedule?.local ? schedule.timeZone : zone,
      status: terminalLabels[post.status] + (post.status === 'published' && queueClient.delivery === 'simulate' ? ' (simulation)' : ''),
      review: review.status === 'pending' ? 'Pending' : review.status === 'changes_requested' ? 'Changes requested' : review.status === 'approved' ? review.decidedBy?.name || 'Approved' : '',
      reviewDue: formDate(review.dueAt),
      notes: review.notes.map(note => ({ author: note.author.name, text: note.text })),
      permalink: post.permalink?.url || '',
      linkPlacement: post.permalink?.placement || 'post',
      comment: post.firstComment?.text || '',
      commentAt: timing?.local || formDate(timing?.at),
      commentZone: timing?.timeZone || schedule?.timeZone || zone,
      delay: timing?.delayMinutes || 0,
      commentStatus: terminalLabels[post.comment.status]
    };
  }

  function asAsset(media) {
    // The hosted panel gives each graphic its own signed @Human address.
    return { ...media, src: media.src || endpoint + '/media/' + encodeURIComponent(media.id) };
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const [posts, accounts, media, events] = await Promise.all(
        ['/posts', '/accounts', '/media', '/events'].map(path => request(endpoint + path))
      );
      const latest = JSON.stringify([posts,accounts,media,events]);
      if (latest === snapshot) return;
      snapshot = latest;
      queueClient.items = posts.posts.map(asItem);
      queueClient.accounts = accounts.accounts;
      queueClient.assets = media.media.map(asAsset);
      queueClient.events = events.events.slice().reverse().map(event => ({
        item: event.jobId,
        title: event.title,
        at: event.at,
        kind: event.type.startsWith('review_') ? 'review' : 'publishing',
        label: event.error?.message || event.type.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase())
      }));
      render();
    } finally {
      refreshing = false;
    }
  }

  async function upload(name, dataUrl) {
    try {
      const { media } = await request(endpoint + '/media', 'POST', { name, dataUrl });
      const asset = asAsset(media);
      if (!queueClient.assets.some(existing => existing.id === asset.id)) queueClient.assets.push(asset);
      return asset;
    } catch (error) {
      show(error.message);
      return null;
    }
  }

  function fields(item) {
    const accounts = accountsFor(item.channel);
    const selected = accounts.some(account => account.id === item.accountId) ? item.accountId : accounts.length === 1 ? accounts[0].id : '';
    const options = accounts.map(account => '<option value="' + esc(account.id) + '"' + (account.id === selected ? ' selected' : '') + '>' + esc(account.label) + '</option>').join('');
    return '<label>Schedule time zone<input name="timeZone" value="' + esc(item.timeZone || suite?.defaultTimeZone() || zone) + '" placeholder="Asia/Dhaka"></label>' +
      (item.channel === 'WordPress' ? '' : '<label>Publishing account<select name="accountId"><option value="">' + (accounts.length ? 'Choose an account' : 'No ' + esc(item.channel) + ' account connected') + '</option>' + options + '</select></label>' + (accounts.length ? '' : '<p class="help" style="margin:-8px 0 14px">Connect ' + esc(item.channel) + ' in Integrations to schedule here. You can still draft and get it reviewed.</p>') + '<label>Graphic alt text<input name="altText" maxlength="1000" value="' + esc(item.altText) + '"></label><label>First comment time zone (optional)<input name="commentZone" value="' + esc(item.commentZone) + '" placeholder="Same as the post"></label>');
  }

  function actions(item) {
    const post = item.remote;
    if (!post) return '';
    const allowed = post.allowedActions;
    const buttons = [
      ['cancel', 'Cancel schedule', allowed.cancel && post.status === 'scheduled'],
      ['comment/retry', 'Retry first comment', allowed.retryComment],
      ['comment/cancel', 'Cancel first comment', allowed.cancelComment],
      ['resolve', 'Confirm delivery result', allowed.resolve]
    ].filter(action => action[2]).map(([action, label]) => '<button class="secondary" data-action="' + action + '">' + label + '</button>').join('');
    const error = post.delivery.error?.message || post.comment.error?.message;
    const postUrl = externalUrl(post.delivery.providerUrl || '');
    const link = postUrl ? '<a class="secondary" target="_blank" rel="noopener noreferrer" href="' + esc(postUrl) + '">Open published post</a>' : '';
    return buttons + (error ? '<span class="help danger" role="status">' + esc(error) + '</span>' : '') + link;
  }

  async function inputFor(item) {
    const media = item.remote?.media?.slice(1) || [];
    if (item.asset) {
      let asset = allAssets().find(asset => asset.id === item.asset);
      if (!asset) throw new Error('The selected graphic is unavailable.');
      if (asset.src.startsWith('data:')) asset = await upload(asset.name, asset.src);
      if (!asset) throw new Error('The selected graphic could not be moved to the server.');
      media.unshift({ mediaId: asset.id, altText: item.altText || '' });
    }
    const timeZone = item.timeZone?.trim() || zone;
    const permalink = item.permalink.trim() ? { url: item.permalink.trim(), placement: item.linkPlacement } : null;
    if (item.channel === 'WordPress') {
      return { kind: 'article', title: item.title, reviewCopy: item.body, media, permalink,
        wordpressSchedule: item.date ? { local: item.date, timeZone } : null };
    }
    return {
      kind: 'social', title: item.title, accountId: item.accountId || null,
      text: item.body, media, permalink,
      firstComment: hasComment(item) ? {
        text: item.comment, media: item.remote?.firstComment?.media || [],
        timing: item.commentAt ? { local: item.commentAt, timeZone: item.commentZone?.trim() || timeZone } : { delayMinutes: item.delay }
      } : null
    };
  }

  async function save(item, action, suggestion) {
    if (busy) return;
    const reviewer = action === 'review-approve' || action === 'review-changes';
    if (reviewer && queueClient.delivery !== 'simulate') return show('Niall reviews from his own sign-in. Invite him in Settings › Team.');
    if (reviewer && !item.remote) return show('Save this draft before previewing Niall’s review.');
    if (action === 'review-changes' && !suggestion) return show('Add a suggestion first.');
    const operations = ['cancel', 'comment/retry', 'comment/cancel', 'resolve'];
    const oldId = item.id;
    busy = true;
    try {
      let post = item.remote;
      if (operations.includes(action)) {
        let data = {};
        if (action === 'resolve') {
          const target = post.status === 'uncertain' ? 'post' : 'comment';
          const outcome = window.prompt('Confirm the provider result. Enter delivered or not_delivered.');
          if (!['delivered', 'not_delivered'].includes(outcome)) return;
          const providerId = outcome === 'delivered' ? window.prompt('Enter the provider ID for this ' + target + '.')?.trim() : undefined;
          if (outcome === 'delivered' && !providerId) return;
          data = { target, outcome, providerId };
        }
        ({ post } = await request(endpoint + '/posts/' + post.id + '/' + action, 'POST', data));
      } else {
        const isReview = ['request', 'self', 'review-approve', 'review-changes'].includes(action);
        if (!post || !isReview || (!reviewer && post.allowedActions.edit && post.status !== 'published')) {
          const input = await inputFor(item);
          if (item.channel !== 'WordPress' && action === 'schedule') input.schedule = { local: item.date, timeZone: item.timeZone?.trim() || zone };
          if (action === 'publish') input.publishNow = true;
          if (!post) {
            if (!active.submissionId) active.submissionId = oldId || crypto.randomUUID();
            const prefix = queueClient.delivery + ':';
            ({ post } = await request(endpoint + '/posts', 'POST', input, { 'Idempotency-Key': prefix + active.submissionId }));
          } else {
            let patch = { ...input, expectedVersion: post.version };
            if (post.status === 'published') patch = { title: input.title, firstComment: input.firstComment, expectedVersion: post.version };
            ({ post } = await request(endpoint + '/posts/' + post.id, 'PATCH', patch));
          }
          if (oldId && !item.remote) {
            state.items = state.items.filter(candidate => candidate.id !== oldId);
            persist();
          }
          const saved = asItem(post);
          queueClient.items = [saved, ...queueClient.items.filter(candidate => candidate.id !== saved.id)];
          active = saved;
        }
        if (isReview) {
          const names = { request: 'request', self: 'approve_self', 'review-approve': 'approve', 'review-changes': 'request_changes' };
          const deadline = item.reviewDue || (item.date && (() => {
            const date = new Date(item.date);
            date.setDate(date.getDate() - 1);
            return dayKey(date) + 'T' + item.date.slice(11, 16);
          })());
          ({ post } = await request(endpoint + '/posts/' + post.id + '/review', 'POST', {
            action: names[action], note: reviewer ? suggestion : undefined,
            dueAt: action === 'request' && deadline ? { local: deadline, timeZone: item.timeZone?.trim() || zone } : undefined
          }, reviewer ? { 'X-SMA-Review-Preview': 'niall' } : {}));
        }
      }
      const saved = asItem(post);
      if (!operations.includes(action)) suite?.saveMeta(item, saved.id);
      queueClient.items = [saved, ...queueClient.items.filter(candidate => candidate.id !== saved.id)];
      if (editor.open) openItem(saved);
      if (reviewer) suite?.reviewSaved(saved.id);
      render();
      show(action === 'request' ? 'Review requested. Reviewers get a link by email, or copy it from Settings › Team › Outbox.' : 'Saved to the server queue.');
      await refresh();
    } catch (error) {
      show(error.message);
    } finally {
      busy = false;
    }
  }

  async function bulk(items, action) {
    const actions = {
      approve: ['review', { action: 'approve_self' }],
      review: ['review', { action: 'request' }],
      unschedule: ['cancel', {}],
      publish: ['publish-now', {}]
    };
    const [path, body] = actions[action];
    const remote = items.filter(item => item.remote && (['review', 'approve'].includes(action) || item.channel !== 'WordPress'));
    const errors = [];
    let done = 0;
    for (const item of remote) {
      try {
        await request(endpoint + '/posts/' + item.id + '/' + path, 'POST', body);
        done++;
      } catch (error) { errors.push(item.title + ': ' + error.message); }
    }
    await refresh();
    return { done, errors };
  }

  // Owner drag-and-drop: move a scheduled post to another day, keeping its time and time zone.
  async function reschedule(item, local) {
    const post = item.remote;
    if (!post || post.status !== 'scheduled') throw new Error('Only scheduled posts can be moved.');
    busy = true;
    try {
      const { post: saved } = await request(endpoint + '/posts/' + encodeURIComponent(post.id) + '/schedule', 'POST', {
        schedule: { local, timeZone: post.schedule?.timeZone || zone }, expectedVersion: post.version
      });
      const next = asItem(saved);
      queueClient.items = [next, ...queueClient.items.filter(candidate => candidate.id !== next.id)];
      render();
      return next;
    } finally { busy = false; }
  }

  async function addNote(item, note) {
    const { post } = await request(endpoint + '/posts/' + item.id + '/review','POST',{ action:'note',note });
    const saved = asItem(post);
    queueClient.items = [saved,...queueClient.items.filter(candidate => candidate.id !== saved.id)];
    render();
    return saved;
  }
}
