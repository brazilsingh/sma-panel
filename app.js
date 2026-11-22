'use strict';

// [icon, heading, subtitle, nav group, nav label]
const pages = {
  Overview: ['overview', 'Good to see you', 'What is scheduled, waiting for review, and delivered across your channels.', '', 'Overview'],
  Calendar: ['calendar', 'Editorial calendar', 'Plan articles, social posts, and follow-up comments in one place.', '', 'Calendar'],
  Content: ['content', 'Content', 'Manage WordPress review copies and social drafts.', '', 'Content'],
  Campaigns: ['campaigns', 'Campaigns', 'Group articles, social posts, and milestones for each launch.', '', 'Campaigns'],
  Approvals: ['approvals', 'Approvals', 'Review content and leave feedback for the publisher.', '', 'Approvals'],
  Inbox: ['inbox', 'Social inbox', 'Work through comments and direct messages.', 'Engage', 'Social inbox'],
  Listening: ['listening', 'Social listening', 'Track topics and triage matching mentions.', 'Engage', 'Listening'],
  Analytics: ['analytics', 'Analytics', 'Measure publishing activity and imported performance.', 'Insights', 'Analytics'],
  Competitors: ['competitors', 'Competitors', 'Compare engagement by account and content format.', 'Insights', 'Competitors'],
  SEO: ['search', 'SEO and AI visibility', 'Keyword rankings from SE Ranking and how AI assistants mention and cite Planet Crust.', 'Insights', 'SEO & AI visibility'],
  Guide: ['globe', 'Platform guide', 'What gets reach on each platform, with exact image, GIF, video and text sizes.', 'Library', 'Platform guide'],
  Media: ['media', 'Media library', 'Reuse uploaded graphics in your drafts.', 'Library', 'Media'],
  History: ['history', 'Publishing history', 'See the scheduled and delivered publishing activity.', 'Library', 'History'],
  Notifications: ['bell', 'Notifications', 'See review requests and feedback in this workspace.', 'hidden', 'Notifications'],
  Connections: ['integrations', 'Integrations', 'Manage publishing accounts and workspace tools.', 'Workspace', 'Integrations'],
  Settings: ['settings', 'Settings', 'Set your profile, notification preferences, and device details.', 'Workspace', 'Settings']
};
// Status text → pill colour class
function stateClass(text) {
  const value = String(text || '').toLowerCase();
  if (value.startsWith('published') || value.startsWith('sent')) return 's-published';
  if (value.startsWith('scheduled') || value.startsWith('publishing') || value.startsWith('sending')) return 's-scheduled';
  if (value.startsWith('failed') || value.startsWith('cancelled')) return 's-failed';
  if (value.startsWith('needs') || value.startsWith('not queued') || value.startsWith('add a')) return 's-attention';
  return 's-draft';
}
const statusPill = text => '<span class="status ' + stateClass(text) + '">' + esc(text) + '</span>';
const key = 'pc-publishing-studio-v1';
const dayKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const today = new Date();
const dateAt = (offset, time) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return dayKey(date) + 'T' + time;
};
const blank = (date = '') => ({
  id: '', channel: 'LinkedIn', title: '', body: '', asset: '', date, status: 'Draft',
  review: '', reviewDue: '', notes: [], comment: '', delay: 0, commentAt: '',
  commentStatus: '', permalink: '', linkPlacement: 'post', processedAt: ''
});
const seed = () => ({ assets: [], events: [], items: [
  { ...blank(dateAt(1, '09:00')), id: 'article-demo', channel: 'WordPress', title: 'A practical guide to sovereign AI', body: 'Give teams a clear way to decide where data lives, how models are used, and who is accountable for each release.', status: 'Scheduled', review: 'Niall' },
  { ...blank(dateAt(1, '09:30')), id: 'linkedin-demo', title: 'Sovereign AI for editorial teams', body: 'What would it take for your team to run AI on its own terms? Our latest guide starts with three practical decisions.', permalink: 'https://example.com/sovereign-ai/', linkPlacement: 'comment', comment: 'Read the guide', delay: 5, status: 'Scheduled', review: 'Pending' },
  { ...blank(dateAt(2, '10:00')), id: 'x-demo', channel: 'X', title: 'Sovereign AI checklist', body: 'Three decisions to make before you roll out AI in your team.', permalink: 'https://example.com/sovereign-ai/', status: 'Scheduled' },
  { ...blank(dateAt(3, '11:00')), id: 'human-demo', title: '@Human workflow spotlight', body: 'This week we’re looking at how teams document their AI decisions and prepare releases for review.' }
] });
let state;
try { state = JSON.parse(localStorage.getItem(key)) || seed(); } catch { state = seed(); }
for (const item of state.items) {
  if (Object.hasOwn(item, 'permalink')) continue;
  const oldArticle = state.items.find(candidate => candidate.id === item.article);
  item.permalink = item.liveUrl || oldArticle?.liveUrl || '';
  item.linkPlacement = item.comment.includes('{{article_url}}') ? 'comment' : 'post';
}
let page = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'Overview';
let mode = 'Month';
let cursor = new Date(today);
let channelFilter = '';
let active = null;
let mobile = false;
let queueClient = null;
let suite = null;
const allItems = () => queueClient ? [...queueClient.items, ...state.items] : state.items;
const allAssets = () => queueClient ? [...queueClient.assets, ...state.assets] : state.assets;
const view = document.querySelector('#view');
const editor = document.querySelector('#editor');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const printDate = date => date ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unscheduled';
const externalUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value.trim() : ''; } catch { return ''; }
};
function postText(item, placement) {
  const text = placement === 'post' ? item.body : item.comment;
  const url = externalUrl(item.permalink);
  if (/\{\{(?:article_url|permalink)\}\}/.test(text)) return text.replaceAll(/\{\{(?:article_url|permalink)\}\}/g, url || '[Add a permalink]');
  if (!url || item.linkPlacement !== placement || text.includes(url) || item.channel === 'WordPress') return text;
  return text ? text + '\n\n' + url : url;
}
const hasComment = item => Boolean(item.comment.trim() || (item.linkPlacement === 'comment' && externalUrl(item.permalink)));
const show = message => {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(show.timer);
  show.timer = setTimeout(() => { toast.hidden = true; }, 4000);
};
const persist = () => {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { show('Browser storage is full. Remove a large image before saving more content.'); return false; }
};
function record(item, label, kind = 'publishing') {
  state.events.unshift({ item: item.id, title: item.title, label, kind, at: new Date().toISOString() });
}
function hasRequiredPermalink(item) {
  const legacyPlaceholder = /\{\{(?:article_url|permalink)\}\}/.test(item.body + '\n' + item.comment);
  return !legacyPlaceholder || Boolean(externalUrl(item.permalink));
}
function processQueue() {
  if (queueClient || (typeof location !== 'undefined' && /^https?:$/.test(location.protocol))) return false;
  let changed = false;
  const now = Date.now();
  for (const item of state.items) {
    if (item.channel === 'WordPress') continue;
    if (item.status === 'Scheduled' && item.date && Date.parse(item.date) <= now && hasRequiredPermalink(item)) {
      item.status = 'Published (demo)';
      item.processedAt = new Date(now).toISOString();
      item.commentStatus = hasComment(item) ? 'Scheduled' : '';
      record(item, 'Simulated social publish');
      changed = true;
    }
    const commentTime = item.commentAt ? Date.parse(item.commentAt) : Date.parse(item.processedAt) + Number(item.delay) * 60000;
    if (item.commentStatus === 'Scheduled' && commentTime <= now) {
      item.commentStatus = 'Published (demo)';
      record(item, 'Simulated first comment publish');
      changed = true;
    }
  }
  if (changed) persist();
  return changed;
}
function status(item) {
  // With the server queue connected, browser-only items are never delivered until they are saved to the queue.
  if (queueClient && !item.remote && item.channel !== 'WordPress' && item.status === 'Scheduled') return 'Not queued';
  if (item.status === 'Scheduled' && item.channel !== 'WordPress' && !hasRequiredPermalink(item)) return 'Add a permalink';
  return item.status;
}
// Owner can move a post by dragging it when its time can still change.
const canDrag = item => Boolean(item.date) && (item.remote ? item.remote.status === 'scheduled' : !/^Published/.test(item.status));
function entry(item) {
  const asset = allAssets().find(asset => asset.id === item.asset);
  const label = status(item);
  return '<div class="calendar-item" data-item="' + esc(item.id) + '"' + (canDrag(item) ? ' draggable="true"' : '') + '>' + (suite?.selector(item) || '') +
    '<button type="button" class="card-more" data-menu="' + esc(item.id) + '" aria-label="Actions for ' + esc(item.title) + '">' + icon('more', 16) + '</button>' +
    '<button class="entry" style="--channel:' + channels[item.channel].color + '" data-open="' + esc(item.id) + '"><span class="entry-top">' + chanBadge(item.channel, item.accountId) + '<span>' + item.channel + '</span><time>' + esc(item.date.slice(11, 16)) + '</time></span>' +
    (asset ? '<img class="calendar-thumb" src="' + esc(asset.src) + '" alt="" loading="lazy">' : '') + '<strong>' + esc(item.title) + '</strong>' + statusPill(label) +
    (item.channel !== 'WordPress' && hasComment(item) ? '<span class="comment-flag">' + icon('message', 11) + (item.channel === 'X' ? 'Reply' : 'Comment') + '</span>' : '') + (suite?.cardMeta(item) || '') + '</button></div>';
}
function renderList(items, empty) {
  return items.length ? items.map(item => '<div class="list-row"><div>' + (suite?.selector(item) || '') + '<strong>' + esc(item.title) + '</strong><p>' + chanBadge(item.channel, item.accountId) + item.channel + (item.review ? ' · Review: ' + esc(item.review) : '') + '</p>' + (suite?.cardMeta(item) || '') + '</div><div>' + esc(printDate(item.date)) + '</div><div>' + statusPill(status(item)) + '</div><div class="row"><button class="secondary" data-open="' + esc(item.id) + '">Open</button><button type="button" class="icon-btn" data-menu="' + esc(item.id) + '" aria-label="Actions for ' + esc(item.title) + '">' + icon('more', 18) + '</button></div></div>').join('') : '<p class="empty">' + esc(empty) + '</p>';
}
function renderCalendar() {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), mode === 'Week' ? cursor.getDate() : 1);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - (first.getDay() + 6) % 7);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const spans = ((first.getDay() + 6) % 7) + monthEnd.getDate();
  const count = mode === 'Week' ? 7 : Math.ceil(spans / 7) * 7;
  const channelItems = allItems().filter(item => !channelFilter || item.channel === channelFilter);
  const items = suite ? suite.filtered(channelItems) : channelItems;
  const dates = Array.from({ length: count }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const now = dayKey(new Date());
  const weekNumber = (() => { const d = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); })();
  const views = { Month: 'grid', Week: 'week', List: 'list' };
  view.innerHTML = (suite?.planningToolbar() || '') + '<div class="panel"><div class="cal-head"><div class="row"><span class="nav-arrows"><button type="button" data-offset="-1" aria-label="Previous period">' + icon('left', 16) + '</button><button type="button" data-offset="1" aria-label="Next period">' + icon('right', 16) + '</button></span><button class="secondary" id="today" type="button">Today</button><h2>' + cursor.toLocaleDateString([], { month: 'long' }) + ' <span>' + cursor.getFullYear() + (mode === 'Week' ? ' · W' + weekNumber : '') + '</span></h2></div><div class="row"><select id="channel-filter" aria-label="Filter by channel" style="width:auto;border-radius:999px">' + channelOptions(channelFilter, { includeAll: true }) + '</select><span class="seg" role="group" aria-label="Calendar view">' + ['Month', 'Week', 'List'].map(item => '<button type="button" class="' + (mode === item ? 'on' : '') + '" aria-pressed="' + (mode === item) + '" data-mode="' + item + '">' + icon(views[item], 15) + item + '</button>').join('') + '</span></div></div>' +
    (mode === 'List' ? renderList(items, 'No content matches your filters.') : '<div class="scroll"><div class="calendar">' +
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => '<div class="weekday">' + day + '</div>').join('') +
      dates.map(date => '<div class="day ' + (date.getMonth() !== cursor.getMonth() && mode !== 'Week' ? 'out ' : '') + (mode === 'Week' ? 'week' : '') + '" data-drop="' + dayKey(date) + '"><button class="date ' + (dayKey(date) === now ? 'today' : '') + '" data-day="' + dayKey(date) + '" aria-label="Add content on ' + dayKey(date) + '">' + date.getDate() + '</button><span class="add-hint" aria-hidden="true">' + icon('plus', 14) + '</span>' + (suite?.dayItems(dayKey(date)) || '') + items.filter(item => item.date.slice(0, 10) === dayKey(date)).sort((a, b) => a.date.localeCompare(b.date)).map(entry).join('') + '</div>').join('') +
      '</div></div>') + '<div class="legend">' + [...new Set(channelItems.map(item => item.channel))].sort().map(name => '<span>' + chanBadge(name) + name + '</span>').join('') + '<span style="margin-left:auto">' + icon('clock', 13) + 'Drag a scheduled post to another day to reschedule it.</span></div></div>' + (suite?.bulkBar() || '');
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
function renderNav() {
  const pending = allItems().filter(item => item.review === 'Pending').length;
  const unread = suite?.unreadCount?.() || 0;
  const bell = document.querySelector('#bell-count');
  if (bell) { bell.hidden = !unread; bell.textContent = unread > 9 ? '9+' : unread; }
  let group = null;
  const nav = document.querySelector('#nav');
  nav.innerHTML = '<span class="nav-pill" aria-hidden="true"></span>' + Object.entries(pages).filter(([, details]) => details[3] !== 'hidden').map(([name, details]) => {
    let heading = '';
    if (details[3] !== group) { group = details[3]; if (group) heading = '<div class="nav-group">' + group + '</div>'; }
    const badge = name === 'Approvals' && pending ? pending : name === 'Inbox' ? (suite?.inboxUnread?.() || 0) : 0;
    return heading + '<button type="button" data-page="' + name + '" class="' + (name === page ? 'active' : '') + '"' + (name === page ? ' aria-current="page"' : '') + ' title="' + details[4] + '"' + (badge ? ' data-badge="' + badge + '"' : '') + '>' + icon(details[0], 19) + '<span class="nav-label">' + details[4] + '</span>' + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</button>';
  }).join('');
  window.dispatchEvent(new CustomEvent('sma:nav'));
}
function overviewStats() {
  const items = allItems();
  const now = Date.now();
  const inDays = days => item => item.date && Date.parse(item.date) >= now - 6e4 && Date.parse(item.date) <= now + days * 864e5;
  const scheduled = items.filter(item => /^Scheduled/.test(status(item)));
  const remote = items.filter(item => item.remote);
  const delivered = remote.filter(item => item.remote.status === 'published');
  const failed = remote.filter(item => item.remote.status === 'failed' || item.remote.status === 'uncertain' || ['failed', 'uncertain'].includes(item.remote.comment.status));
  const notQueued = items.filter(item => /^Not queued/.test(status(item)));
  return {
    items, scheduled, nextWeek: scheduled.filter(inDays(7)), delivered, failed, notQueued,
    published30: delivered.filter(item => Date.parse(item.remote.delivery.deliveredAt) >= now - 30 * 864e5).length + items.filter(item => item.status === 'Published (demo)').length,
    pending: items.filter(item => item.review === 'Pending')
  };
}
function renderOverview() {
  const s = overviewStats();
  const kpis = [
    ['Scheduled · next 7 days', s.nextWeek.length, 'calendar', s.scheduled.length + ' scheduled in total'],
    ['Awaiting review', s.pending.length, 'approvals', 'Review never blocks your schedule'],
    ['Published · 30 days', s.published30, 'send', queueClient?.delivery === 'live' ? 'Live delivery' : 'Simulation delivery'],
    ['Needs attention', s.failed.length + s.notQueued.length, 'alert', s.failed.length ? s.failed.length + ' delivery issue(s)' : s.notQueued.length ? s.notQueued.length + ' not queued' : 'All clear']
  ];
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() + index); return d; });
  const counts = days.map(d => s.items.filter(item => item.date.slice(0, 10) === dayKey(d)).length);
  const peak = Math.max(1, ...counts);
  const upcoming = s.items.filter(item => item.date && Date.parse(item.date) >= Date.now() - 6e4 && !/^Published/.test(status(item))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const finished = s.delivered.length + s.failed.length;
  const health = finished ? Math.round(100 * s.delivered.length / finished) : null;
  const ticks = 28;
  const gauge = '<svg viewBox="0 0 240 132" role="img" aria-label="Delivery success ' + (health ?? 0) + ' percent">' + Array.from({ length: ticks }, (_, i) => {
    const angle = Math.PI - (i / (ticks - 1)) * Math.PI;
    const x1 = 120 + Math.cos(angle) * 92, y1 = 120 - Math.sin(angle) * 92, x2 = 120 + Math.cos(angle) * 110, y2 = 120 - Math.sin(angle) * 110;
    return '<line class="tick' + (health !== null && i / (ticks - 1) <= health / 100 ? ' on' : '') + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" style="animation:fade-in 300ms ' + (i * 25) + 'ms both"/>';
  }).join('') + '</svg>';
  const events = [...(queueClient?.events || []), ...state.events].slice(0, 6);
  const row = item => '<button type="button" class="ov-row" data-open="' + esc(item.id) + '">' + chanBadge(item.channel, item.accountId, 16) + '<div><strong>' + esc(item.title) + '</strong><small>' + esc(printDate(item.date)) + ' · ' + item.channel + '</small></div>' + statusPill(status(item)) + '</button>';
  view.innerHTML = '<div class="overview">' +
    '<div class="stat-grid">' + kpis.map(([label, value, name, note], index) => '<article class="panel stat rise" style="--i:' + index + '"><span>' + label + '</span><strong data-count="' + value + '">' + value + '</strong><small class="help">' + esc(note) + '</small><span class="stat-icon">' + icon(name, 17) + '</span></article>').join('') + '</div>' +
    '<section class="panel ov-card ov-span-8 rise" style="--i:4"><div class="toolbar"><h2>Publishing this week</h2><button class="secondary" type="button" data-goto="Calendar">' + icon('calendar', 15) + 'Open calendar</button></div><div class="ov-week">' +
      counts.map((count, index) => '<div><b class="' + (count === peak && count ? 'peak' : '') + '" style="height:' + Math.max(8, (count / peak) * 140) + 'px;--i:' + index + '">' + (count ? '<span>' + count + '</span>' : '') + '</b><small class="' + (index === 0 ? 'today' : '') + '">' + (index === 0 ? 'Today' : days[index].toLocaleDateString([], { weekday: 'short' })) + '</small></div>').join('') + '</div></section>' +
    '<section class="panel ov-card ov-span-4 rise" style="--i:5"><div class="toolbar"><h2>Delivery success</h2><span class="help">All time</span></div><div class="gauge">' + gauge + '<strong>' + (health === null ? '—' : '<span data-count="' + health + '">' + health + '</span>%') + '</strong><small>' + (health === null ? 'No deliveries yet' : s.delivered.length + ' delivered · ' + s.failed.length + ' need attention') + '</small></div></section>' +
    '<section class="panel ov-card ov-span-6 rise" style="--i:6"><div class="toolbar"><h2>Up next</h2><button class="quiet" type="button" data-goto="Content">View all</button></div><div class="ov-list">' + (upcoming.length ? upcoming.map(row).join('') : '<p class="empty">Nothing scheduled yet. Create content to fill your calendar.</p>') + '</div></section>' +
    '<section class="panel ov-card ov-span-6 rise" style="--i:7"><div class="toolbar"><h2>Waiting for Niall</h2><button class="quiet" type="button" data-goto="Approvals">Open approvals</button></div><div class="ov-list">' + (s.pending.length ? s.pending.slice(0, 6).map(row).join('') : '<p class="empty">No posts are waiting for review.</p>') + '</div></section>' +
    '<section class="panel ov-card ov-span-12 rise" style="--i:8"><div class="toolbar"><h2>Recent activity</h2><button class="quiet" type="button" data-goto="History">Publishing history</button></div>' + (events.length ? events.map(event => '<div class="suite-line"><div><strong>' + esc(event.label) + '</strong><p class="help">' + esc(event.title) + ' · ' + esc(printDate(event.at)) + '</p></div><button class="secondary" type="button" data-open="' + esc(event.item) + '">Open</button></div>').join('') : '<p class="empty">Activity appears here as you schedule, review, and publish.</p>') + '</section>' +
    '</div>';
}
function render() {
  const details = pages[page];
  document.querySelector('#heading').textContent = page === 'Overview' ? greeting() : details[1];
  document.querySelector('#subtitle').textContent = details[2];
  document.querySelector('#crumb').innerHTML = 'SMA <b>/</b> <strong>' + esc(details[4]) + '</strong>';
  document.title = details[4] + ' · SMA by Planet Crust @Human';
  renderNav();
  if (page === 'Overview') return renderOverview();
  if (page === 'Calendar') return renderCalendar();
  if (suite?.renderPage(page)) return;
  if (typeof extraPages !== 'undefined' && extraPages[page]) { view.innerHTML = extraPages[page](); return; }
  if (page === 'Content' || page === 'Approvals') {
    const items = page === 'Content' ? allItems() : allItems().filter(item => item.review);
    view.innerHTML = '<div class="panel">' + renderList(items, 'There are no review items yet.') + '</div>';
  } else if (page === 'Media') {
    view.innerHTML = '<div class="panel"><div class="toolbar"><h2>Uploaded graphics</h2><label>Upload graphic<input id="media-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>' + (allAssets().length ? '<div class="gallery">' + allAssets().map(asset => '<div class="asset"><img src="' + esc(asset.src) + '" alt=""><p>' + esc(asset.name) + '</p></div>').join('') + '</div>' : '<p class="empty">Upload a graphic here or attach one while composing.</p>') + '</div>';
  } else if (page === 'Connections') {
    const descriptions = { 'Claude MCP': 'Add drafts and set schedules from Claude.', LinkedIn: 'Publish posts and first comments.', X: 'Publish posts and use replies where the account supports them.', Email: 'Send Niall a review link.' };
    view.innerHTML = '<div class="panel">' + Object.entries(descriptions).map(([name, description]) => {
      const accounts = queueClient?.accounts.filter(account => account.provider === name.toLowerCase()) || [];
      const status = accounts.map(account => account.label + (account.simulated ? ' · Simulation' : account.connected ? ' · Connected' : ' · Setup required')).join(', ') || 'Not connected';
      return '<div class="list-row"><strong>' + name + '</strong><div>' + description + '</div><div><span class="status">' + esc(status) + '</span></div></div>';
    }).join('') + '</div>';
  } else {
    const events = [...(queueClient?.events || []), ...state.events].filter(event => event.kind === (page === 'Notifications' ? 'review' : 'publishing'));
    view.innerHTML = '<div class="panel">' + (events.length ? events.map(event => '<div class="list-row"><div><strong>' + esc(event.label) + '</strong><p>' + esc(event.title) + '</p></div><div>' + esc(printDate(event.at)) + '</div><div></div><button class="secondary" data-open="' + esc(event.item) + '">Open</button></div>').join('') : '<p class="empty">No activity yet.</p>') + '</div>';
  }
}
function preview(item) {
  const asset = allAssets().find(candidate => candidate.id === item.asset);
  const wordpress = item.channel === 'WordPress';
  const style = wordpress ? 'wordpress' : item.channel === 'X' ? 'x' : 'linkedin';
  const avatar = wordpress ? '' : chanBadge(item.channel, item.accountId, 18);
  const when = item.date ? new Date(item.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not scheduled';
  const accountName = queueClient?.accounts.find(account => account.id === item.accountId)?.label;
  return '<article class="preview ' + style + (mobile ? ' mobile' : '') + '"><header>' + avatar + '<strong>' + esc(wordpress ? item.title || 'Article title' : accountName || (item.channel === 'X' ? 'Planet Crust · @PlanetCrust' : 'Planet Crust')) + (wordpress ? '' : '<small>' + esc(when) + ' · ' + (item.channel === 'X' ? 'Everyone' : 'Public') + '</small>') + '</strong></header><p>' + esc(postText(item, 'post') || 'Write something to preview it here.') + '</p>' +
    (asset ? '<img src="' + esc(asset.src) + '" alt="' + esc(asset.name) + '">' : '') +
    (!wordpress && hasComment(item) ? '<hr><p class="help"><strong>' + (item.channel === 'X' ? 'First reply' : 'First comment') + '</strong> · ' + (item.commentAt ? esc(printDate(item.commentAt)) : Number(item.delay) ? Number(item.delay) + ' min after publishing' : 'Immediately after publishing') + (item.commentStatus ? ' · ' + esc(item.commentStatus) : '') + '</p><p>' + esc(postText(item, 'comment')) + '</p>' : '') + '</article>';
}
function currentForm() {
  const fields = new FormData(editor.querySelector('form'));
  return { ...active, ...Object.fromEntries(fields), delay: Number(fields.get('delay') || 0) };
}
function paintPreview() {
  editor.querySelector('#post-preview').innerHTML = preview(currentForm());
}
function openItem(item) {
  active = { ...item };
  const wp = active.channel === 'WordPress';
  const allowed = active.remote?.allowedActions;
  const buttonDisabled = action => allowed && !allowed[action] ? ' disabled' : '';
  const reviewerPreview = queueClient?.delivery !== 'live';
  editor.innerHTML = '<div class="dialog-head"><h2>' + (active.id ? 'Edit content' : 'New content') + '</h2><div class="actions">' + (suite?.editorActions(active) || '') + '<button class="quiet" id="close" aria-label="Close editor">✕</button></div></div><div class="dialog-body"><form class="form"><div class="split"><label>Destination<select name="channel">' + channelOptions(active.channel, { used: [active.channel] }) + '</select></label><label>Calendar time<input type="datetime-local" name="date" value="' + esc(active.date) + '"></label></div><label>Title<input name="title" required value="' + esc(active.title) + '"></label>' + (suite?.editorFields(active) || '') + '<label>' + (wp ? 'Article review copy' : 'Post copy') + '<textarea name="body" rows="5">' + esc(active.body) + '</textarea></label>' +
    (queueClient ? queueClient.fields(active) : '') +
    '<label>Graphic<select name="asset"><option value="">No graphic</option>' + allAssets().map(asset => '<option value="' + esc(asset.id) + '"' + (active.asset === asset.id ? ' selected' : '') + '>' + esc(asset.name) + '</option>').join('') + '</select></label><label>Upload a new graphic<input id="editor-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>' +
    (wp ? '<label>Reference permalink (optional)<input name="permalink" type="url" value="' + esc(active.permalink) + '"></label><p class="help">Paste the article here for review and schedule the original in WordPress.</p>' :
    '<div class="split"><label>Permalink (optional)<input name="permalink" type="url" placeholder="https://…" value="' + esc(active.permalink) + '"></label><label>Add permalink to<select name="linkPlacement"><option value="post"' + (active.linkPlacement !== 'comment' ? ' selected' : '') + '>Post</option><option value="comment"' + (active.linkPlacement === 'comment' ? ' selected' : '') + '>' + (active.channel === 'X' ? 'First reply' : 'First comment') + '</option></select></label></div><label>' + (active.channel === 'X' ? 'First reply' : 'First comment') + '<textarea name="comment" rows="2">' + esc(active.comment) + '</textarea></label><div class="split"><label>Minutes after parent post<input name="delay" type="number" min="0" step="1" value="' + Number(active.delay) + '"></label><label>Or set a comment time<input name="commentAt" type="datetime-local" value="' + esc(active.commentAt) + '"></label></div>') + '<label>Review deadline<input name="reviewDue" type="datetime-local" value="' + esc(active.reviewDue) + '"></label></form>' +
    '<section class="preview-area"><div class="row"><h2>' + active.channel + ' preview</h2><button class="' + (mobile ? 'secondary' : 'primary') + '" data-device="desktop">Desktop</button><button class="' + (mobile ? 'primary' : 'secondary') + '" data-device="mobile">Mobile</button></div><div id="post-preview"></div><h2>Niall’s review</h2><p class="help">' + (active.review === 'Pending' ? 'Awaiting review' : active.review === 'Changes requested' ? 'Changes requested' : active.review ? 'Approved by ' + esc(active.review) : 'Review optional') + '</p><div id="review-notes">' + active.notes.map(note => '<div class="note"><small>' + esc(note.author) + '</small>' + esc(note.text) + '</div>').join('') + '</div>' +
    (reviewerPreview ? '<label>Reviewer preview<textarea id="suggestion" rows="2" placeholder="Leave feedback for the publisher"></textarea></label><div class="actions"><button class="primary" data-action="review-approve">Approve and suggest edits</button><button class="secondary" data-action="review-changes">Request changes</button></div>' : '') + '</section></div>' +
    '<div class="dialog-footer"><div class="actions"><button class="secondary" data-action="request">Request Niall’s review</button><button class="secondary" data-action="self">Approve myself</button></div><div class="actions"><button class="secondary" data-action="save"' + buttonDisabled('edit') + '>Save changes</button><button class="secondary" data-action="schedule"' + buttonDisabled(wp ? 'edit' : 'schedule') + '>' + (wp ? 'Record schedule' : 'Schedule') + '</button>' + (wp ? '' : '<button class="primary" data-action="publish"' + buttonDisabled('publishNow') + '>' + (queueClient?.delivery === 'live' ? 'Publish now' : 'Simulate publish now') + '</button>') + (queueClient ? queueClient.actions(active) : '') + '</div></div>';
  if (!editor.open) editor.showModal();
  paintPreview();
}
function save(action) {
  const form = editor.querySelector('form');
  if (!form.reportValidity()) return;
  const item = currentForm();
  if (!item.title.trim()) return show('Enter a title.');
  const suggestion = editor.querySelector('#suggestion')?.value.trim() || '';
  const previous = structuredClone(state);
  if (action === 'review-changes' && !suggestion) return show('Add a suggestion first.');
  if (action === 'schedule' && !item.date) return show('Set a calendar time first.');
  if (item.permalink && !externalUrl(item.permalink)) return show('Enter a valid HTTP or HTTPS permalink.');
  if (item.channel !== 'WordPress' && ['schedule', 'publish'].includes(action)) {
    if (!hasRequiredPermalink(item)) return show('Add the permalink or remove the placeholder from your copy.');
    if (!postText(item, 'post').trim() && !item.asset) return show('Add post copy or a graphic.');
  }
  if (queueClient) return queueClient.save(item, action, suggestion);
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) return show('The publishing queue is unavailable. Start or reconnect the local server.');
  if (!item.id) item.id = crypto.randomUUID();
  suite?.saveMeta(item, item.id);
  switch (action) {
    case 'request':
      if (!item.review || item.review === 'Changes requested') item.review = 'Pending';
      if (!item.reviewDue && item.date) {
        const deadline = new Date(item.date);
        deadline.setDate(deadline.getDate() - 1);
        item.reviewDue = dayKey(deadline) + 'T' + item.date.slice(11, 16);
      }
      record(item, 'Local review notification for Niall' + (item.reviewDue ? ' · Due ' + printDate(item.reviewDue) : ''), 'review');
      break;
    case 'review-approve':
      item.review = 'Niall';
      if (suggestion) item.notes = [...item.notes, { author: 'Niall', text: suggestion }];
      record(item, 'Niall approved' + (suggestion ? ' and suggested edits' : ''), 'review');
      break;
    case 'review-changes':
      item.review = 'Changes requested';
      item.notes = [...item.notes, { author: 'Niall', text: suggestion }];
      record(item, 'Niall requested changes', 'review');
      break;
    case 'self':
      item.review = 'You';
      record(item, 'Approved by you', 'review');
      break;
    case 'schedule':
      if (item.status === 'Published (demo)') return show('This demo post is already published.');
      item.status = 'Scheduled';
      record(item, item.channel === 'WordPress' ? 'WordPress schedule recorded locally' : 'Social schedule saved');
      break;
    case 'publish':
      if (item.status === 'Published (demo)') return show('This demo post is already published.');
      item.status = 'Scheduled';
      item.date = dayKey(new Date()) + 'T' + new Date().toTimeString().slice(0, 5);
      record(item, 'Simulated publish requested');
      break;
  }
  const index = state.items.findIndex(other => other.id === item.id);
  if (index < 0) state.items.push(item);
  else state.items[index] = item;
  if (!persist()) { state = previous; return; }
  processQueue();
  render();
  openItem(item);
  if (action === 'review-approve' || action === 'review-changes') suite?.reviewSaved(item.id);
  show(action === 'request' ? 'Review recorded in local notifications.' : action === 'publish' ? status(item) : 'Saved.');
}
async function upload(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    show('Choose a PNG, JPEG, WebP, or GIF.');
    return null;
  }
  if (file.size > 1500000) { show('Choose a graphic under 1.5 MB for this local build.'); return null; }
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }).catch(() => null);
  if (!src) { show('Could not read the graphic.'); return null; }
  if (queueClient) return queueClient.upload(file.name, src);
  const asset = { id: crypto.randomUUID(), name: file.name, src };
  state.assets.push(asset);
  if (!persist()) { state.assets.pop(); return null; }
  return asset;
}
document.querySelector('#compose').onclick = () => openItem(blank());
document.querySelector('#nav').onclick = event => {
  const button = event.target.closest('[data-page]');
  if (!button) return;
  page = button.dataset.page;
  render();
};
view.onclick = event => {
  if (suite?.click(event)) return;
  const button = event.target.closest('button');
  if (!button) return;
  const { open, day, mode: nextMode, offset } = button.dataset;
  if (open) {
    const item = allItems().find(candidate => candidate.id === open);
    if (item) openItem(item);
  } else if (day) openItem(blank(day + 'T09:00'));
  // Only calendar controls redraw the calendar; other buttons (form submits, page actions) are left alone.
  else if (nextMode || offset || button.id === 'today') {
    if (nextMode) mode = nextMode;
    if (button.id === 'today') cursor = new Date();
    if (offset) {
      if (mode === 'Week') cursor.setDate(cursor.getDate() + Number(offset) * 7);
      else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + Number(offset), 1);
    }
    renderCalendar();
  }
};
view.onchange = async event => {
  if (suite?.change(event)) return;
  if (event.target.id === 'channel-filter') { channelFilter = event.target.value; renderCalendar(); }
  if (event.target.id === 'media-upload' && await upload(event.target.files[0])) render();
};
editor.onclick = event => {
  if (suite?.editorClick(event)) return;
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'close') editor.close();
  if (button.dataset.action) save(button.dataset.action);
  if (button.dataset.device) {
    const item = currentForm();
    const suggestion = editor.querySelector('#suggestion')?.value || '';
    mobile = button.dataset.device === 'mobile';
    openItem(item);
    const suggestionField = editor.querySelector('#suggestion');
    if (suggestionField) suggestionField.value = suggestion;
  }
};
editor.oninput = event => { if (event.target.closest('form')) paintPreview(); };
editor.onsubmit = event => event.preventDefault();
editor.onchange = async event => {
  if (event.target.name === 'channel') openItem(currentForm());
  if (event.target.id !== 'editor-upload') return;
  const file = event.target.files[0];
  const asset = file && await upload(file);
  if (asset && editor.open) openItem({ ...currentForm(), asset: asset.id });
};
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (Object.hasOwn(pages, next) && next !== page) { page = next; render(); }
});
processQueue();
render();
setInterval(() => { if (processQueue()) render(); }, 10000);


