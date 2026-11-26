'use strict';
// Reviewer page. Signed-in reviewers see every post waiting for them; a review link opens one post.
// Review is advisory: nothing here can edit, schedule, publish or cancel.
var queueClient = { accounts: [] }; // channels.js reads connected accounts from here.
(function () {
  const main = document.getElementById('main');
  const who = document.getElementById('who');
  const esc = escapeHtml;
  const API = '/api/publishing';
  let linkToken = '';
  try { linkToken = sessionStorage.getItem('sma-review-link') || ''; } catch {}
  let me = { role: null };
  const objectUrls = [];

  async function call(path, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (linkToken) headers['X-SMA-Review-Link'] = linkToken;
    const response = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Something went wrong (' + response.status + ').');
    return data;
  }
  const when = iso => { if (!iso) return 'Not scheduled'; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const reviewPill = review => {
    const map = { pending: ['pending', 'Waiting for you'], approved: ['approved', 'Approved'], changes_requested: ['changes', 'Changes requested'], not_requested: ['', 'Not requested'] };
    const [cls, text] = map[review?.status] || ['', review?.status || ''];
    return '<span class="pill ' + cls + '">' + esc(text) + '</span>';
  };
  const message = (text, error) => '<div class="rv-msg' + (error ? ' err' : '') + '" role="status">' + esc(text) + '</div>';

  function header() {
    if (!me.role) { who.innerHTML = ''; return; }
    who.innerHTML = '<span>' + esc(me.scoped ? 'Review link' : ({ owner: 'Owner', writer: 'Writer', member: 'Member' }[me.role] || 'Reviewer')) + ' · ' + esc(me.name) + '</span>' +
      (me.role && me.role !== 'reviewer' ? '<a class="quiet" href="/">Open workspace</a>' : '') +
      (me.scoped ? '' : '<button class="quiet" id="signout" type="button">Sign out</button>');
    document.getElementById('signout')?.addEventListener('click', async () => { await call('/api/team/signout', 'POST', {}); location.replace('/review'); });
  }

  async function list(note) {
    let posts;
    try { posts = (await call(API + '/posts')).posts; } catch (error) { main.innerHTML = message(error.message, true); return; }
    const rank = p => ({ pending: 0, changes_requested: 1, approved: 2 })[p.review.status] ?? 3;
    posts = posts.filter(p => p.review.status !== 'not_requested').sort((a, b) => rank(a) - rank(b) || String(a.schedule?.at || '').localeCompare(String(b.schedule?.at || '')));
    const waiting = posts.filter(p => p.review.status === 'pending').length;
    main.innerHTML = (note ? message(note) : '') + '<h1>Hi ' + esc(me.name) + '</h1><p class="rv-lede">' + (waiting ? waiting + ' post' + (waiting > 1 ? 's are' : ' is') + ' waiting for your review.' : 'Nothing is waiting for you right now.') + '</p>' +
      (posts.length ? '<div class="rv-list">' + posts.map(p => '<button class="rv-row" type="button" data-id="' + esc(p.id) + '">' + chanBadge(p.kind === 'article' ? 'WordPress' : p.destination?.channel || 'Website', null, 13) +
        '<span class="grow"><strong>' + esc(p.title || 'Untitled') + '</strong><small>' + esc((p.destination?.accountLabel || (p.kind === 'article' ? 'WordPress review copy' : '')) + ' · ' + when(p.schedule?.at)) + (p.review.dueAt ? ' · Review by ' + esc(when(p.review.dueAt)) : '') + '</small></span>' + reviewPill(p.review) + '</button>').join('') + '</div>'
        : '<div class="rv-card"><p class="rv-empty">When the owner asks for your review, posts appear here and you get an email.</p></div>');
    main.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => { location.hash = 'p=' + button.dataset.id; }));
  }

  async function media(post) {
    const items = post.media || [];
    if (!items.length) return '';
    const urls = await Promise.all(items.map(async item => {
      try {
        const headers = linkToken ? { 'X-SMA-Review-Link': linkToken } : {};
        const response = await fetch(API + '/media/' + encodeURIComponent(item.mediaId), { headers, credentials: 'same-origin' });
        if (!response.ok) return null;
        const url = URL.createObjectURL(await response.blob());
        objectUrls.push(url);
        return { url, alt: item.altText || '' };
      } catch { return null; }
    }));
    return '<div class="rv-media">' + urls.filter(Boolean).map(m => '<img src="' + esc(m.url) + '" alt="' + esc(m.alt) + '">').join('') + '</div>';
  }

  async function detail(id, note) {
    let post;
    try { post = (await call(API + '/posts/' + encodeURIComponent(id))).post; } catch (error) { main.innerHTML = message(error.message, true); return; }
    while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
    const article = post.kind === 'article';
    const channel = article ? 'WordPress' : post.destination?.channel || 'Website';
    const text = article ? post.reviewCopy : (post.preview?.postText ?? post.copy?.text ?? '');
    const comment = article ? '' : post.preview?.commentText;
    const commentLabel = post.destination?.commentLabel || 'first comment';
    main.innerHTML = (note ? message(note) : '') + (me.scoped ? '' : '<button class="quiet" type="button" id="back">← All posts</button>') +
      '<h1>' + esc(post.title || 'Untitled') + '</h1><div class="rv-meta">' + chanBadge(channel, null, 13) + '<span>' + esc(channel + (post.destination?.accountLabel ? ' · ' + post.destination.accountLabel : '')) + '</span><span>·</span><span>' + esc(when(article ? post.wordpressSchedule?.at : post.schedule?.at)) + '</span>' + reviewPill(post.review) + '</div>' +
      '<div class="rv-grid" style="margin-top:18px"><section class="rv-card"><h2>' + (article ? 'Article review copy' : 'Post as it will appear') + '</h2><div class="rv-post">' + esc(text || '(No copy yet)') + '</div>' + await media(post) +
      (comment ? '<div class="rv-comment"><b>' + esc(commentLabel.charAt(0).toUpperCase() + commentLabel.slice(1)) + '</b>' + esc(comment) + '</div>' : '') +
      (post.permalink?.url ? '<p class="rv-meta" style="margin-top:12px">Permalink: <a href="' + esc(post.permalink.url) + '" target="_blank" rel="noopener noreferrer">' + esc(post.permalink.url) + '</a></p>' : '') + '</section>' +
      '<section class="rv-card"><h2>Your review</h2>' + (post.review.editedSinceApproval ? '<p class="rv-empty">The owner edited this post after it was approved.</p>' : '') +
      (post.review.dueAt ? '<p class="rv-empty">Requested by ' + esc(when(post.review.dueAt)) + '</p>' : '') +
      (post.review.notes || []).map(n => '<div class="note"><small>' + esc(n.author?.name || 'Note') + ' · ' + esc(when(n.at)) + '</small>' + esc(n.text) + '</div>').join('') +
      '<label for="suggestion">Suggestions for the owner</label><textarea id="suggestion" maxlength="4000" placeholder="Optional with approval. Needed when you request changes."></textarea>' +
      '<div class="actions"><button class="primary" type="button" data-act="approve">Approve and suggest edits</button><button class="secondary" type="button" data-act="request_changes">Request changes</button></div></section></div>';
    document.getElementById('back')?.addEventListener('click', () => { location.hash = ''; });
    main.querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', async () => {
      const note = document.getElementById('suggestion').value.trim();
      if (button.dataset.act === 'request_changes' && !note) { document.getElementById('suggestion').focus(); main.insertAdjacentHTML('afterbegin', message('Say what should change first.', true)); return; }
      main.querySelectorAll('button[data-act]').forEach(b => { b.disabled = true; });
      try {
        await call(API + '/posts/' + encodeURIComponent(post.id) + '/review', 'POST', { action: button.dataset.act, note: note || undefined });
        detail(post.id, button.dataset.act === 'approve' ? 'Approved. The owner can see your suggestions.' : 'Sent. The owner can see what should change.');
      } catch (error) {
        main.insertAdjacentHTML('afterbegin', message(error.message, true));
        main.querySelectorAll('button[data-act]').forEach(b => { b.disabled = false; });
      }
    }));
  }

  function signedOut(text) {
    main.innerHTML = '<div class="rv-card"><h1>Review posts in SMA</h1><p class="rv-lede">' + esc(text || 'Open the invitation or review link from your email to continue. Ask the workspace owner for a new link if yours has expired.') + '</p></div>';
  }

  async function route() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('accept')) {
      const token = params.get('accept');
      history.replaceState(null, '', '/review');
      try {
        const result = await call('/api/team/accept', 'POST', { token });
        if (result.role === 'owner') { location.replace('/'); return; }
      } catch (error) { signedOut(error.message); return; }
    }
    if (params.get('post')) {
      linkToken = params.get('post');
      try { sessionStorage.setItem('sma-review-link', linkToken); } catch {}
      history.replaceState(null, '', '/review');
    }
    try { me = await call('/api/team/me'); } catch { me = { role: null }; }
    if (linkToken && !me.scoped && me.role !== 'reviewer') {
      linkToken = '';
      try { sessionStorage.removeItem('sma-review-link'); } catch {}
      try { me = await call('/api/team/me'); } catch { me = { role: null }; }
      if (!me.role) return header(), signedOut('This review link has expired. Ask the workspace owner for a new one.');
    }
    header();
    if (!me.role) return signedOut();
    if (me.scoped) return detail(me.postId);
    const id = new URLSearchParams(location.hash.slice(1)).get('p');
    return id ? detail(id) : list();
  }
  window.addEventListener('hashchange', route);
  route();
})();
