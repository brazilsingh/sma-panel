'use strict';
// Settings › Team: owners, reviewer invitations (any email, plus the email they use on @Human) and the mail outbox.
// Invitations and review links come from this portal; the server emails them, or keeps them here in simulation.
(function () {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = iso => iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const toast = text => { try { show(text); } catch { alert(text); } };
  let busy = false;

  async function api(path, method = 'GET', body) {
    const response = await fetch('/api/team' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The team service did not answer (' + response.status + ').');
    return data;
  }

  const pill = (text, cls) => '<span class="status ' + cls + '">' + e(text) + '</span>';
  const btn = (act, label, id = '', primary = false) => '<button type="button" class="' + (primary ? 'primary' : 'secondary') + '" data-team="' + act + '" data-id="' + e(id) + '">' + e(label) + '</button>';

  function paint(panel, team) {
    const mail = team.mail.via === '@Human' ? 'Invites and review requests are emailed through @Human. They arrive from the @Human instance’s mail address, and replies go to the owner.'
      : team.mail.live ? 'Invites and review requests are emailed through your mail relay.'
      : team.mail.configured ? 'A mail relay is set, but this workspace is in simulation, so nothing is emailed. Copy links from the outbox below.'
      : 'No mail relay is set (SMA_MAIL_WEBHOOK), so nothing is emailed. Copy each link from the outbox below and send it yourself.';
    panel.innerHTML =
      '<section class="panel suite-form"><h2>Owners</h2><p class="help">Owners write, schedule and publish. Sign-in is required when SMA runs on a public address.</p>' +
      '<div class="team-list">' + team.owners.map(o => '<div class="suite-line"><div><strong>' + e(o.name) + '</strong><p class="help">' + e(o.email) + '</p></div><div class="row">' + pill('Owner', 's-published') +
        (team.owners.length > 1 ? btn('remove-owner', 'Remove', o.id) : '') + '</div></div>').join('') + '</div>' +
      '<form class="team-form" data-team-form="owner"><div class="split"><label>Name<input name="name" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label></div><button class="secondary">Add owner</button></form></section>' +

      '<section class="panel suite-form"><h2>Reviewers</h2><p class="help">Reviewers can read posts and approve, suggest edits or request changes. Their review is advisory and never holds the schedule.</p>' +
      (team.members.length ? '<div class="team-list">' + team.members.map(m => '<div class="suite-line"><div><strong>' + e(m.name) + '</strong><p class="help">Invite: ' + e(m.email) +
          (m.humanEmail ? ' · @Human: ' + e(m.humanEmail) : '') + ' · ' + (m.status === 'active' ? 'Joined ' + e(date(m.acceptedAt)) : 'Invited ' + e(date(m.invitedAt))) + '</p></div><div class="row">' +
          pill(m.status === 'active' ? 'Active' : 'Invited', m.status === 'active' ? 's-approved' : 's-review') + btn('resend', m.status === 'active' ? 'Send new link' : 'Resend invite', m.id) + btn('human-email', 'Set @Human email', m.id) + btn('remove-reviewer', 'Remove', m.id) + '</div></div>').join('') + '</div>'
        : '<p class="empty">No reviewers yet. Invite Niall below.</p>') +
      '<form class="team-form" data-team-form="invite"><h2>Invite a reviewer</h2><div class="split"><label>Name<input name="name" placeholder="Niall"></label><label>Invite email<input name="email" type="email" required placeholder="Any address they read"></label></div>' +
      '<label>@Human sign-in email (optional)<input name="humanEmail" type="email" placeholder="If they use another email on @Human or QC"></label>' +
      '<p class="help">The invite goes to the invite email. The @Human email links them to their @Human account when it differs.</p><button class="primary">Send invite</button></form></section>' +

      '<section class="panel suite-form"><h2>Outbox</h2><p class="help">' + e(mail) + '</p>' + (team.mail.live ? '<p>' + btn('test-email', 'Send test email to me') + '</p>' : '') +
      (team.outbox.length ? '<div class="team-list">' + team.outbox.map(o => '<div class="suite-line"><div><strong>' + e(o.subject) + '</strong><p class="help">To ' + e(o.to) + ' · ' + e(date(o.at)) + '</p></div><div class="row">' +
          pill({ sent: 'Sent', queued: 'Queued', kept: 'Not emailed', failed: 'Send failed', used: 'Used' }[o.status] || o.status, o.status === 'sent' || o.status === 'used' ? 's-published' : o.status === 'failed' ? 's-attention' : 's-draft') +
          (o.link ? btn('copy-link', 'Copy link', o.link) : '') + '</div></div>').join('') + '</div>' : '<p class="empty">Invitations and review requests appear here.</p>') + '</section>';
  }

  async function load() {
    const panel = document.getElementById('team-panel');
    if (!panel) return;
    try { paint(panel, await api('/')); }
    catch (error) { panel.innerHTML = '<section class="panel suite-form"><p class="help">' + e(error.message) + '</p></section>'; }
  }

  async function act(run, done) {
    if (busy) return;
    busy = true;
    try { const result = await run(); if (done) toast(typeof done === 'function' ? done(result) : done); await load(); }
    catch (error) { toast(error.message); }
    finally { busy = false; }
  }
  const outcome = result => result.status === 'sent' ? 'Invite emailed to ' + result.member.email + '.' : 'Invite ready. Copy the link from the outbox and send it to ' + result.member.email + '.';

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-team]');
    if (!target || !document.getElementById('team-panel')?.contains(target)) return;
    const id = target.dataset.id;
    switch (target.dataset.team) {
      case 'copy-link':
        navigator.clipboard.writeText(id).then(() => toast('Link copied. It works once for invites and for 14 days for review links.'), () => toast('Copy failed. Select the link manually: ' + id));
        break;
      case 'test-email': act(() => api('/test-email', 'POST', {}), result => result.status === 'sent' ? 'Test email sent to ' + result.to + '. Check the inbox and the spam folder.' : 'The test email could not be sent. See the outbox.'); break;
      case 'resend': act(() => api('/reviewers/' + id + '/resend', 'POST', {}), outcome); break;
      case 'remove-reviewer':
        if (confirm('Remove this reviewer? Their sign-in and review links stop working.')) act(() => api('/reviewers/' + id + '/remove', 'POST', {}), 'Reviewer removed.');
        break;
      case 'remove-owner':
        if (confirm('Remove this owner?')) act(() => api('/owners/' + id + '/remove', 'POST', {}), 'Owner removed.');
        break;
      case 'human-email': {
        const value = prompt('Email this reviewer uses on @Human (leave empty to clear):', '');
        if (value !== null) act(() => api('/reviewers/' + id + '/update', 'POST', { humanEmail: value.trim() }), 'Saved.');
        break;
      }
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-team-form]');
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (form.dataset.teamForm === 'owner') act(() => api('/owners', 'POST', values), 'Owner added.');
    if (form.dataset.teamForm === 'invite') act(() => api('/reviewers', 'POST', values), outcome);
  });
  window.addEventListener('sma:render', () => { if (document.getElementById('team-panel')?.querySelector('.help:only-child')) load(); });
})();
