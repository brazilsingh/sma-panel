'use strict';

suite = (() => {
  const storageKey = 'pc-workspace-tools-v1';
  const emptyState = {
    campaigns: [], milestones: [], metadata: {}, templates: [], inbox: [], metrics: [],
    competitors: [], mentions: [], topics: [], read: [], calendars: [],
    profile: { name: 'Planet Crust', email: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    preferences: { approvals: true, feedback: true, inbox: true, listening: true, updates: true },
    device: { label: 'This browser' }
  };
  let data;
  try { data = { ...emptyState, ...JSON.parse(localStorage.getItem(storageKey)) }; }
  catch { data = structuredClone(emptyState); }
  const dialog = document.querySelector('#workspace-dialog');
  const selection = new Set();
  let filters = {};
  let filterOpen = false;
  let selectionMode = false;
  let reviewOrder = [];
  let reviewTotal = 0;
  let notificationTab = 'All';
  let unreadOnly = false;
  let inboxKind = 'comment';
  let inboxState = 'open';
  let inboxSource = 'all';
  let inboxSelected = '';
  let replying = false;
  let reportDays = '30';
  let reportChannel = '';
  let reportMetric = 'impressions';
  let reportInterval = 'daily';
  let reportBreakdown = 'total';
  let settingsTab = 'Profile';
  let topicFilter = '';
  let listeningState = 'open';
  let contentTab = 'Posts';
  let bulkBusy = false;
  const isPlanning = () => ['Calendar', 'Content', 'Approvals'].includes(page);
  const id = () => crypto.randomUUID();
  const persistTools = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); }
    catch { show('Workspace storage is full. Export or remove older imports.'); }
  };
  const refresh = () => { persistTools(); render(); };
  const meta = item => data.metadata[item.id] || {};
  const button = (action, label, value = '', primary = false) => '<button type="button" class="' + (primary ? 'primary' : 'secondary') + '" data-suite="' + action + '" data-value="' + esc(value) + '">' + esc(label) + '</button>';
  const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (String(value) === String(selected ?? '') ? ' selected' : '') + '>' + esc(label) + '</option>';
  const choose = (name, label, options, selected) => '<label>' + esc(label) + '<select name="' + name + '">' + options.map(([value, text]) => option(value, text, selected)).join('') + '</select></label>';
  const field = (name, label, value = '', type = 'text', mandatory = false) => '<label>' + esc(label) + '<input name="' + name + '" value="' + esc(value) + '" type="' + type + '"' + (mandatory ? ' required' : '') + '></label>';
  const area = (name, label, value = '', mandatory = false) => '<label>' + esc(label) + '<textarea name="' + name + '" rows="3"' + (mandatory ? ' required' : '') + '>' + esc(value) + '</textarea></label>';
  const iconButton = (action, label, name, extra = '') => '<button type="button" class="secondary' + extra + '" data-suite="' + action + '">' + icon(name, 16) + esc(label) + '</button>';
  const tabs = (action, options, current) => '<div class="suite-tabs">' + options.map(([key, text]) => button(action, text, key, key === current)).join('') + '</div>';
  const blankPanel = (message) => '<p class="empty">' + esc(message) + '</p>';

  function openDialog(title, html, onSubmit) {
    dialog.classList.remove('drawer');
    dialog.innerHTML = '<div class="dialog-head"><h2>' + esc(title) + '</h2><button type="button" id="suite-close" class="quiet" aria-label="Close">✕</button></div>' +
      (onSubmit ? '<form class="suite-form" id="suite-form">' + html + '<button class="primary" type="submit">Save</button></form>' : '<div class="suite-form">' + html + '</div>');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#suite-close').onclick = () => dialog.close();
    if (onSubmit) dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      try { if (await onSubmit(new FormData(event.currentTarget)) !== false) dialog.close(); }
      catch (error) { show(error.message); }
    };
  }

  function itemFields(item) {
    const values = { ...meta(item), ...item };
    for (const key of ['campaign', 'labels', 'group', 'author', 'format', 'audience']) {
      if (item[key] === undefined) values[key] = meta(item)[key] || '';
    }
    return '<details class="suite-details"><summary>Campaign, labels, and audience</summary><div class="split">' +
      choose('campaign', 'Campaign', [['', 'No campaign'], ...data.campaigns.map(campaign => [campaign.id, campaign.name])], values.campaign) +
      field('labels', 'Labels (comma-separated)', values.labels) + field('group', 'Post group', values.group) + field('author', 'Author', values.author || data.profile.name) +
      choose('format', 'Content format', [['', 'Auto'], ['Text', 'Text'], ['Image', 'Image'], ['Video', 'Video / Reel'], ['Article', 'Article']], values.format) +
      choose('audience', 'Planning audience', [['', 'Default'], ['Public', 'Public'], ['Team', 'Team'], ['Client', 'Client']], values.audience) +
      '</div></details>';
  }

  function formatOf(item) { return meta(item).format || (item.channel === 'WordPress' ? 'Article' : item.asset ? 'Image' : 'Text'); }
  function reviewGroup(item) { return item.review === 'Pending' ? 'Pending' : item.review === 'Changes requested' ? 'Feedback' : item.review ? 'Approved' : 'Unrequested'; }
  function isArchived(item) { return !!meta(item).archived; }
  function filtered(items) {
    const query = (filters.query || '').trim().toLowerCase();
    const label = (filters.label || '').trim().toLowerCase();
    const author = (filters.author || '').trim().toLowerCase();
    return items.filter(item => {
      const values = meta(item);
      const date = item.date.slice(0, 10);
      return (filters.archived === 'yes' ? isArchived(item) : !isArchived(item)) &&
        (!query || [item.title, item.body, values.labels, values.group, item.channel].some(text => String(text || '').toLowerCase().includes(query))) &&
        (!filters.review || reviewGroup(item) === filters.review) &&
        (!filters.status || status(item).toLowerCase().startsWith(filters.status.toLowerCase())) &&
        (!filters.campaign || values.campaign === filters.campaign) &&
        (!label || (values.labels || '').toLowerCase().includes(label)) &&
        (!author || (values.author || data.profile.name).toLowerCase().includes(author)) &&
        (!filters.format || formatOf(item) === filters.format) &&
        (!filters.account || item.accountId === filters.account) &&
        (!filters.feedback || (filters.feedback === 'with') === Boolean(item.notes.length)) &&
        (!filters.from || date && date >= filters.from) && (!filters.to || date && date <= filters.to);
    }).sort((a, b) => {
      if (filters.sort === 'desc') return b.date.localeCompare(a.date);
      if (filters.sort === 'name') return a.title.localeCompare(b.title);
      if (filters.sort === 'created') return (b.remote?.createdAt || b.date).localeCompare(a.remote?.createdAt || a.date);
      return (a.date || '9999').localeCompare(b.date || '9999');
    });
  }
  function selector(item) {
    if (!selectionMode || !isPlanning()) return '';
    return '<input type="checkbox" class="item-check" aria-label="Select ' + esc(item.title) + '" data-select-item="' + esc(item.id) + '"' + (selection.has(item.id) ? ' checked' : '') + '>';
  }
  function cardMeta(item) {
    const values = meta(item);
    const campaign = data.campaigns.find(record => record.id === values.campaign);
    const names = [campaign?.name, values.group, ...(values.labels || '').split(',').map(label => label.trim()).filter(Boolean), values.hidden ? 'Internal' : ''].filter(Boolean);
    return names.length ? '<span class="item-tags">' + names.slice(0, 4).map(name => '<span>' + esc(name) + '</span>').join('') + '</span>' : '';
  }
  function planningToolbar() {
    return '<div class="suite-tools"><form id="search-posts" class="row"><input name="query" aria-label="Search posts" placeholder="Search posts" value="' + esc(filters.query) + '"><button class="secondary">Search</button></form><div class="row">' +
      iconButton('filters', filterOpen ? 'Close filters' : 'Filter & sort', 'filter', Object.keys(filters).some(key => filters[key] && key !== 'query') ? ' on' : '') + iconButton('select-mode', selectionMode ? 'Done selecting' : 'Select posts', 'select') +
      (selectionMode ? button('select-all', 'Select filtered posts') : '') + (page === 'Calendar' ? iconButton('new-milestone', 'Add event', 'plus') + iconButton('saved-calendars','Saved views','bookmark') : '') + '</div></div>' +
      (filterOpen ? '<form id="filters-form" class="filter-grid panel">' +
        choose('sort', 'Sort', [['','Earliest schedule'],['desc','Latest schedule'],['created','Last created'],['name','Title']], filters.sort) +
        choose('review', 'Approval status', [['','Any'],['Pending','Awaiting approval'],['Feedback','Feedback left'],['Approved','Approved'],['Unrequested','Unrequested']], filters.review) +
        choose('status', 'Post status', [['','Any'],...['Draft','Scheduled','Publishing','Published','Failed','Cancelled'].map(value => [value,value])], filters.status) +
        choose('feedback', 'Feedback', [['','Any'],['with','With notes'],['without','Without notes']], filters.feedback) +
        choose('campaign', 'Campaign', [['','All campaigns'],...data.campaigns.map(campaign => [campaign.id,campaign.name])], filters.campaign) +
        field('label','Label',filters.label) + field('author','Author',filters.author) +
        choose('format', 'Post type', [['','All formats'],...['Text','Image','Video','Article'].map(value => [value,value])], filters.format) +
        choose('account', 'Account', [['','All accounts'],...(queueClient?.accounts || []).map(account => [account.id, account.label])], filters.account) +
        field('from','From',filters.from,'date') + field('to','To',filters.to,'date') +
        choose('archived','Visibility',[['','Active content'],['yes','Archived content']],filters.archived) +
        '<div class="row"><button class="primary">Apply filters</button>' + button('clear-filters','Clear') + '</div></form>' : '');
  }
  function bulkBar() {
    if (!selectionMode || !selection.size) return '';
    return '<div class="bulk-bar"><strong>' + selection.size + ' selected</strong>' +
      button('bulk','Request review','review',true) + button('bulk','Approve myself','approve') +
      button('bulk','Unschedule','unschedule') + button('bulk','Publish now','publish') +
      button('bulk-campaign','Add to campaign') + button('bulk','Group','group') +
      button('bulk','Ungroup','ungroup') + button('bulk','Archive','archive') + button('clear-selection','Clear') + '</div>';
  }
  function dayItems(date) {
    const campaigns = data.campaigns.filter(item => (!filters.campaign || filters.campaign === item.id) && item.start && date >= item.start && date <= (item.end || item.start));
    return campaigns.map(item => '<button type="button" class="calendar-event campaign-event" data-suite="edit-campaign" data-value="' + esc(item.id) + '">' + esc(item.name) + '</button>').join('') +
      data.milestones.filter(item => item.date.slice(0, 10) === date && (!filters.campaign || filters.campaign === item.campaign)).map(item =>
        '<button type="button" class="calendar-event" data-suite="edit-milestone" data-value="' + esc(item.id) + '"><small>' + esc(item.date.slice(11)) + '</small> ' + esc(item.title) + '</button>').join('');
  }
  function editCampaign(key) {
    const record = data.campaigns.find(item => item.id === key) || { id: id(), name: '', owner: data.profile.name, start: '', end: '', summary: '' };
    openDialog(key ? 'Edit campaign' : 'New campaign', field('name','Campaign name',record.name,'text',true) +
      field('owner','Owner',record.owner) + '<div class="split">' + field('start','Starts',record.start,'date') + field('end','Ends',record.end,'date') + '</div>' +
      area('summary','Campaign brief',record.summary) + (key ? button('delete-campaign','Remove campaign',key) : ''), form => {
      const values = Object.fromEntries(form);
      if (!values.name.trim()) throw Error('Enter a campaign name.');
      if (values.start && values.end && values.end < values.start) throw Error('Choose an end date on or after the start date.');
      data.campaigns = [...data.campaigns.filter(item => item.id !== record.id), { ...record, ...values }];
      refresh();
    });
  }
  function editMilestone(key) {
    const record = data.milestones.find(item => item.id === key) || { id: id(), title: '', date: dateAt(0, '09:00'), campaign: '', note: '' };
    openDialog(key ? 'Edit calendar event' : 'Add calendar event', field('title','Event title',record.title,'text',true) +
      field('date','Date and time',record.date,'datetime-local',true) +
      choose('campaign','Campaign',[['','No campaign'],...data.campaigns.map(item => [item.id,item.name])],record.campaign) +
      area('note','Details',record.note) + (key ? button('delete-milestone','Remove event',key) : ''), form => {
      data.milestones = [...data.milestones.filter(item => item.id !== record.id), { ...record, ...Object.fromEntries(form) }];
      refresh();
    });
  }
  function campaigns() {
    return '<div class="suite-tools"><div class="row">' + button('new-campaign','New campaign','',true) + button('new-milestone','Add event') + '</div></div><div class="tile-grid">' +
      data.campaigns.map(campaign => {
        const items = allItems().filter(item => meta(item).campaign === campaign.id && !isArchived(item));
        return '<article class="panel suite-tile"><span class="status">' + items.length + ' posts</span><h2>' + esc(campaign.name) + '</h2><p class="help">' + esc([campaign.owner,campaign.start,campaign.end].filter(Boolean).join(' · ')) + '</p>' +
          (campaign.summary ? '<p>' + esc(campaign.summary) + '</p>' : '') + '<div class="row">' + button('campaign-calendar','View calendar',campaign.id,true) + button('edit-campaign','Edit',campaign.id) + '</div></article>';
      }).join('') + '</div>' + (data.campaigns.length ? '' : '<div class="panel">' + blankPanel('Create a campaign to group posts and calendar events.') + '</div>') +
      '<section class="panel"><div class="toolbar"><h2>Calendar events</h2></div>' + (data.milestones.length ? data.milestones.slice().sort((a,b) => a.date.localeCompare(b.date)).map(item =>
        '<div class="suite-line"><div><strong>' + esc(item.title) + '</strong><p class="help">' + esc(printDate(item.date)) + '</p></div>' + button('edit-milestone','Edit',item.id) + '</div>').join('') : blankPanel('No events scheduled.')) + '</section>';
  }
  function approvals() {
    const items = filtered(allItems()).filter(item => reviewGroup(item) !== 'Unrequested');
    const pending = items.filter(item => reviewGroup(item) === 'Pending');
    return planningToolbar() + '<div class="suite-tools"><p class="help">Niall’s review is advisory. You can schedule or publish at any review stage.</p><div class="row">' + button('approve-pending','Approve all pending') + button('run-review','Review ' + pending.length + ' posts','',true) + '</div></div><div class="approval-board">' +
      [['Pending','Awaiting approval'],['Feedback','Feedback left'],['Approved','Approved']].map(([group, title]) => {
        const cards = items.filter(item => reviewGroup(item) === group);
        return '<section class="panel review-column"><div class="toolbar"><h2>' + icon(group === 'Pending' ? 'clock' : group === 'Feedback' ? 'message' : 'done', 17) + title + '</h2><span class="status ' + (group === 'Pending' ? 's-review' : group === 'Feedback' ? 's-attention' : 's-approved') + '">' + cards.length + '</span></div>' +
          (cards.length ? cards.map(item => {
            const asset = allAssets().find(asset => asset.id === item.asset);
            return '<div class="review-card rise" data-item="' + esc(item.id) + '">' + selector(item) + '<button type="button" class="card-more" data-menu="' + esc(item.id) + '" aria-label="Actions for ' + esc(item.title) + '">' + icon('more',16) + '</button><button class="review-open" data-open="' + esc(item.id) + '"><span class="entry-top">' + chanBadge(item.channel, item.accountId) + '<span>' + esc(item.channel) + '</span><time>' + esc(item.date ? printDate(item.date) : 'No date') + '</time></span>' +
              (asset ? '<img src="' + esc(asset.src) + '" alt="">' : '') + '<strong>' + esc(item.title) + '</strong><p>' + esc(item.body.slice(0, 110)) + '</p>' +
              '<span class="row">' + statusPill(status(item)) + (item.notes.length ? '<small>' + item.notes.length + ' note' + (item.notes.length > 1 ? 's' : '') + '</small>' : '') + '</span>' + (item.reviewDue ? '<small>Due ' + esc(printDate(item.reviewDue)) + '</small>' : '') + cardMeta(item) + '</button></div>';
          }).join('') : blankPanel('No items.')) + '</section>';
      }).join('') + '</div>' + bulkBar();
  }
  function content() {
    return tabs('content-tab',[['Posts','Posts'],['Templates','Templates']],contentTab) + (contentTab === 'Templates'
      ? '<div class="tile-grid">' + data.templates.map(template => '<article class="panel suite-tile"><h2>' + esc(template.name) + '</h2><p class="help">' + esc(template.channel) + '</p><div class="row">' + button('use-template','Use template',template.id,true) + button('delete-template','Remove',template.id) + '</div></article>').join('') +
        '</div>' + (data.templates.length ? '' : '<div class="panel">' + blankPanel('Save a draft as a template from its editor.') + '</div>')
      : planningToolbar() + '<div class="panel">' + renderList(filtered(allItems()),'No content matches these filters.') + '</div>' + bulkBar());
  }

  function notificationRows() {
    const events = [...(queueClient?.events || []), ...state.events].map(event => ({ ...event, category: event.kind === 'review' ? (/requested|request/i.test(event.label) ? 'Approvals' : 'Feedback') : 'Updates' }));
    data.inbox.filter(item => !item.read).forEach(item => events.push({ item: item.id, title: item.person, label: item.kind === 'comment' ? 'Imported comment' : 'Imported direct message', at: item.at, category: 'Social inbox' }));
    data.mentions.filter(item => !item.done).forEach(item => events.push({ item: item.id, title: item.account, label: 'Tracked mention', at: item.at, category: 'Listening' }));
    const eventKey = event => [event.category,event.item,event.label,event.at].join('|');
    const preferences = { Approvals:'approvals', Feedback:'feedback', 'Social inbox':'inbox', Listening:'listening', Updates:'updates' };
    return { events, eventKey, preferences };
  }
  function unreadCount() {
    const { events, eventKey, preferences } = notificationRows();
    return events.filter(event => data.preferences[preferences[event.category]] && !data.read.includes(eventKey(event))).length;
  }
  function notifications() {
    const { events, eventKey, preferences } = notificationRows();
    const rows = events.filter(event => (notificationTab === 'All' ? data.preferences[preferences[event.category]] : notificationTab === event.category) && (!unreadOnly || !data.read.includes(eventKey(event))))
      .sort((a,b) => String(b.at).localeCompare(String(a.at)));
    return tabs('notification-tab',['All','Approvals','Feedback','Social inbox','Listening','Updates'].map(value => [value,value]),notificationTab) +
      '<div class="suite-tools"><div class="row">' + button('notification-unread',unreadOnly ? 'Show all' : 'Unread only') + button('notification-clear','Mark visible as read',JSON.stringify(rows.map(eventKey))) + '</div></div><div class="panel">' +
      (rows.length ? rows.map(event => '<div class="suite-line' + (data.read.includes(eventKey(event)) ? '' : ' unread') + '"><div><small class="help">' + esc(event.category) + (data.read.includes(eventKey(event)) ? '' : ' · Unread') + '</small><strong>' + esc(event.label) + '</strong><p class="help">' + esc(event.title) + ' · ' + esc(printDate(event.at)) + '</p></div>' +
        button('notification-open','Open',JSON.stringify([event.category,event.item,eventKey(event)])) + '</div>').join('') : blankPanel('No notifications in this view.')) + '</div>';
  }

  function inbox() {
    const items = data.inbox.filter(item => item.kind === inboxKind && (inboxKind !== 'comment' || inboxSource === 'all' || (item.source || 'organic') === inboxSource) &&
      (inboxState === 'all' || (inboxState === 'unanswered' ? !item.sent : Boolean(item.done) === (inboxState === 'done'))))
      .sort((a,b) => String(b.at).localeCompare(String(a.at)));
    const item = items.find(item => item.id === inboxSelected) || items[0];
    return tabs('inbox-kind',[['comment','Comments'],['dm','Direct messages']],inboxKind) + '<div class="suite-tools"><div class="row">' +
      choose('inboxState','Show',[['open','Open'],['unanswered','Unanswered'],['done','Done'],['all','All']],inboxState) +
      (inboxKind === 'comment' ? choose('inboxSource','Comment source',[['all','All comments'],['organic','Organic posts'],['ad','Ads and boosted posts']],inboxSource) : '') +
      button('import','Import inbox','inbox') + exampleChip('inbox') + '</div></div><div class="panel inbox-grid"><aside>' +
      (items.length ? items.map(chat => '<button class="inbox-thread ' + (chat.id === item?.id ? 'selected' : '') + '" data-suite="inbox-open" data-value="' + esc(chat.id) + '"><strong>' + esc(chat.person) + '</strong><small>' + esc(chat.channel) + (chat.read ? '' : ' · Unread') + (chat.saved ? ' · Saved' : '') + '</small><span>' + esc(chat.text) + '</span></button>').join('') : blankPanel('No conversations in this view.')) + '</aside><section>' +
      (item ? '<div class="suite-line"><div><h2>' + esc(item.person) + '</h2><p class="help">' + esc(item.channel) + ' · ' + esc(printDate(item.at)) + '</p></div><div class="row">' + button('inbox-pin',item.saved ? 'Unsave' : 'Save',item.id) + button('inbox-done',item.done ? 'Reopen' : 'Mark as done',item.id) + '</div></div><div class="thread-body">' +
        (item.post ? '<p class="thread-context">' + esc(item.post) + '</p>' : '') + '<p class="bubble">' + esc(item.text) + '</p>' + (item.sent ? '<p class="bubble mine">' + esc(item.sent.text) + ' <small>(' + (item.sent.simulated ? 'simulated' : 'sent') + ')</small></p>' : '') +
        '<form id="inbox-reply"><input type="hidden" name="id" value="' + esc(item.id) + '">' + area('reply','Reply draft',item.reply) + '<div class="row"><button class="primary">Save reply draft</button>' +
        (queueClient?.delivery === 'simulate' ? button('inbox-send','Simulate reply',item.id) : queueClient?.integrations?.Inbox ? button('inbox-send','Send reply',item.id) : '') +
        (item.reply ? button('copy','Copy reply',item.reply) : '') + safeLink(item.url,'Open on platform') + '</div></form></div>' : exampleOffer('inbox', 'Import a comments or direct messages export to triage conversations.')) + '</section></div>';
  }
  async function sendInboxReply(itemId) {
    if (replying) return;
    const item = data.inbox.find(record => record.id === itemId);
    const text = view.querySelector('#inbox-reply textarea')?.value.trim();
    if (!item || !text) return show('Write a reply first.');
    if (queueClient.delivery === 'live' && !item.externalId) return show('This imported conversation needs its original provider thread ID.');
    if (item.replyAttempt?.text === text && item.replyAttempt.uncertain && !window.confirm('Check the original conversation first. Attempt this reply again?')) return;
    const replyKey = item.replyAttempt?.text === text ? item.replyAttempt.key : id();
    item.replyAttempt = { text,key:replyKey,uncertain:true };
    item.reply = text;
    persistTools();
    replying = true;
    try {
      const response = await fetch('/api/inbox/reply',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({
        threadId:item.externalId || item.id,channel:item.channel,kind:item.kind,text,replyKey
      }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      item.sent = { text,id:result.id,simulated:result.simulated === true };
      item.read = true;
      item.reply = '';
      delete item.replyAttempt;
      refresh();
      show(result.simulated ? 'Reply simulated.' : 'Reply sent.');
    } catch (error) { show(error.message); }
    finally { replying = false; }
  }
  function safeLink(url,label) {
    const valid = externalUrl(url || '');
    return valid ? '<a class="secondary" target="_blank" rel="noopener noreferrer" href="' + esc(valid) + '">' + esc(label) + '</a>' : '';
  }
  const timeCut = () => Date.now() - Number(reportDays) * 86400000;
  const inReport = record => Date.parse(record.at) >= timeCut() && (!reportChannel || record.channel === reportChannel);
  const formats = ['Video','Image','Text','Article'];
  const metricNames = { followers: 'Followers', posts: 'Posts', impressions: 'Impressions', engagements: 'Engagements' };
  const formatNumber = value => Number(value.toFixed(1)).toLocaleString();
  function reportToolbar(kind) {
    const records = kind === 'metrics' ? data.metrics : data.competitors;
    const channels = [...new Set(records.map(item => item.channel).filter(Boolean))];
    return '<div class="suite-tools"><div class="row">' +
      choose('reportDays','Period',[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['365','Last year']],reportDays) +
      choose('reportChannel','Channel',[['','All channels'],...channels.map(item => [item,item])],reportChannel) +
      '</div><div class="row">' + button('import',kind === 'metrics' ? 'Import metrics' : 'Import competitor data',kind) + button('export-report','Create CSV report',kind,true) + '</div></div>';
  }
  function metricsSummary(rows) {
    const totals = { followers: 0, posts: 0, impressions: 0, engagements: 0 };
    const latest = new Map();
    for (const row of rows) {
      for (const key of ['posts','impressions','engagements']) totals[key] += row[key];
      const account = row.channel + '|' + row.account;
      if (!latest.has(account) || latest.get(account).at < row.at) latest.set(account,row);
    }
    for (const row of latest.values()) totals.followers += row.followers;
    return totals;
  }
  const compact = value => value >= 1000 ? Intl.NumberFormat([], { notation: 'compact', maximumFractionDigits: 1 }).format(value) : Math.round(value).toLocaleString();
  const seriesColours = { LinkedIn: '#0A66C2', X: '#162425', Website: '#1F5C55', WordPress: '#21759B' };
  // SVG line/area chart. Hover behaviour lives in motion.js (reads data-chart).
  function lineChart(labels, series, { unit = '' } = {}) {
    if (!labels.length) return '';
    const W = 800, H = 280, L = 48, R = 16, T = 18, B = 34;
    const raw = Math.max(1, ...series.flatMap(line => line.values));
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const max = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(v => v >= raw);
    const x = index => L + (labels.length === 1 ? (W - L - R) / 2 : index * (W - L - R) / (labels.length - 1));
    const y = value => T + (1 - value / max) * (H - T - B);
    const grid = [0, .25, .5, .75, 1].map(f => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(max * f).toFixed(1) + '" y2="' + y(max * f).toFixed(1) + '"/>').join('');
    const yLabels = [0, .5, 1].map(f => '<text x="' + (L - 10) + '" y="' + (y(max * f) + 4).toFixed(1) + '" text-anchor="end">' + compact(max * f) + '</text>').join('');
    const every = Math.max(1, Math.ceil(labels.length / 6));
    const xLabels = labels.map((label, index) => index % every === 0 ? '<text x="' + x(index).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(label.short) + '</text>' : '').join('');
    const paths = series.map((line, index) => {
      const d = line.values.map((value, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(value).toFixed(1)).join(' ');
      const area = series.length === 1 ? '<path class="area" d="' + d + ' L' + x(line.values.length - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z"/>' : '';
      return area + '<path class="line draw" pathLength="1000" style="--len:1000;stroke:' + line.colour + ';animation-delay:' + (index * 120) + 'ms" d="' + d + '"/>';
    }).join('');
    const dots = series.map(line => '<circle class="hot" r="5" style="stroke:' + line.colour + '"/>').join('');
    const payload = { labels: labels.map(label => label.long), series: series.map(line => ({ name: line.name, colour: line.colour, values: line.values })), unit, geometry: { W, H, L, R, T, B, max } };
    return '<div class="chart-wrap" data-chart="' + esc(JSON.stringify(payload)) + '"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(series.map(line => line.name).join(', ')) + ' over time"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E56B5B" stop-opacity=".22"/><stop offset="1" stop-color="#E56B5B" stop-opacity="0"/></linearGradient></defs><g class="grid">' + grid + '</g><g class="axis">' + yLabels + xLabels + '</g>' + paths + '<line class="cross" y1="' + T + '" y2="' + (H - B) + '"/>' + dots + '</svg><div class="chart-tip" role="status"></div></div>' +
      (series.length > 1 ? '<div class="format-key" style="padding:0 16px 12px">' + series.map(line => '<span><i style="background:' + line.colour + '"></i>' + esc(line.name) + '</span>').join('') + '</div>' : '');
  }
  function exampleChip(kind) {
    return data[kind].some(item => item.example) ? '<span class="example-chip">' + icon('eye', 13) + 'Example data</span> ' + button('clear-examples', 'Clear example data', kind) : '';
  }
  function exampleOffer(kind, text) {
    return '<div class="empty">' + esc(text) + (queueClient?.delivery !== 'live' ? '<div class="row">' + button('import', 'Import JSON', kind) + button('load-examples', 'Try with example data', kind, true) + '</div>' : '') + '</div>';
  }
  function analytics() {
    const rows = data.metrics.filter(inReport);
    const span = Number(reportDays) * 864e5;
    const previous = data.metrics.filter(row => Date.parse(row.at) < timeCut() && Date.parse(row.at) >= timeCut() - span && (!reportChannel || row.channel === reportChannel));
    const totals = metricsSummary(rows);
    const before = metricsSummary(previous);
    const delivered = allItems().filter(item => item.remote?.status === 'published' && Date.parse(item.remote.delivery.deliveredAt) >= timeCut()).length;
    const planned = allItems().filter(item => item.remote?.status === 'scheduled').length;
    const rate = totals.impressions ? 100 * totals.engagements / totals.impressions : null;
    const rateBefore = before.impressions ? 100 * before.engagements / before.impressions : null;
    const delta = (now, then) => {
      if (!previous.length || then === null || now === null || !then) return '';
      const diff = (now - then) / then * 100;
      return '<span class="delta' + (diff < 0 ? ' down' : '') + '">' + (diff < 0 ? '↓ ' : '↑ ') + Math.abs(diff).toFixed(Math.abs(diff) < 10 ? 1 : 0) + '%</span>';
    };
    const icons = { followers: 'users', posts: 'media', impressions: 'eye', engagements: 'zap' };
    const cards = Object.entries(metricNames).map(([key, label]) => '<button type="button" class="panel stat' + (key === reportMetric ? ' active-metric' : '') + '" data-suite="report-metric" data-value="' + key + '" aria-pressed="' + (key === reportMetric) + '"><span>' + label + '</span><strong' + (rows.length ? ' data-count="' + totals[key] + '"' : '') + '>' + (rows.length ? formatNumber(totals[key]) : '—') + '</strong>' + (rows.length ? delta(totals[key], before[key]) : '') + '<span class="stat-icon">' + icon(icons[key], 17) + '</span></button>').join('') +
      '<article class="panel stat"><span>Engagement rate</span><strong>' + (rate === null ? '—' : rate.toFixed(1) + '%') + '</strong>' + delta(rate, rateBefore) + '<span class="stat-icon">' + icon('trend', 17) + '</span></article>';
    const keyOf = row => { const date = new Date(row.at); if (reportInterval === 'weekly') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); };
    const days = [...new Set(rows.map(keyOf))].sort();
    const labels = days.map(day => { const d = new Date(day + 'T12:00:00Z'); return { short: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), long: (reportInterval === 'weekly' ? 'Week of ' : '') + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }; });
    const groups = reportBreakdown === 'channel' ? [...new Set(rows.map(row => row.channel))] : ['Total'];
    const series = groups.map((name, index) => ({ name: name === 'Total' ? metricNames[reportMetric] : name, colour: name === 'Total' ? '#B9473A' : seriesColours[name] || ['#B9473A', '#1F5C55', '#7E9AB5', '#9A7BC0'][index % 4],
      values: days.map(day => metricsSummary(rows.filter(row => keyOf(row) === day && (name === 'Total' || row.channel === name)))[reportMetric]) }));
    const accounts = [...new Set(rows.map(row => row.channel + '|' + row.account))];
    const followerRows = accounts.map(key => {
      const records = rows.filter(row => row.channel + '|' + row.account === key).sort((a, b) => a.at.localeCompare(b.at));
      const first = records[0].followers, last = records.at(-1).followers;
      return [records[0].channel, records[0].account, last, last - first, first ? (last - first) / first * 100 : 0];
    });
    const sign = value => '<span class="delta-inline' + (value < 0 ? ' down' : '') + '">' + (value < 0 ? '↓ ' : '↑ ');
    return reportToolbar('metrics') + '<div class="stat-grid">' + cards + '</div>' +
      '<p class="suite-note">Server queue · ' + planned + ' scheduled · ' + delivered + ' delivered in this period (' + (queueClient?.delivery === 'live' ? 'live' : 'simulation') + ') ' + exampleChip('metrics') + '</p><section class="panel suite-section"><div class="toolbar"><h2>' + metricNames[reportMetric] + ' over time</h2><div class="row">' +
      choose('reportInterval','Interval',[['daily','Daily'],['weekly','Weekly']],reportInterval) +
      choose('reportBreakdown','Breakdown',[['total','Total'],['channel','By platform']],reportBreakdown) + '</div></div>' +
      (days.length ? lineChart(labels, series) + '<details class="chart-table"><summary>Show data table</summary><div class="plot-bars">' + days.map((day, index) => '<div><span>' + esc(labels[index].long) + '</span><span></span><strong>' + series.map(line => (series.length > 1 ? line.name + ' ' : '') + formatNumber(line.values[index])).join(' · ') + '</strong></div>').join('') + '</div></details>' : exampleOffer('metrics', 'Import account metrics to populate the report.')) + '</section>' +
      (followerRows.length ? '<section class="panel"><div class="toolbar"><h2>Followers by channel</h2></div><div class="scroll"><table class="suite-table"><thead><tr><th>Social channel</th><th>Followers</th><th>Change</th><th>Growth rate</th></tr></thead><tbody>' +
        followerRows.map(([channel, account, last, change, growth]) => '<tr><td><span class="row">' + (channels[channel] ? chanBadge(channel) : '') + '<strong>' + esc(account) + '</strong><small>' + esc(channel) + '</small></span></td><td><strong>' + formatNumber(last) + '</strong></td><td>' + sign(change) + formatNumber(Math.abs(change)) + '</span></td><td>' + sign(growth) + Math.abs(growth).toFixed(1) + '%</span></td></tr>').join('') + '</tbody></table></div></section>' : '');
  }
  function sumByFormat(rows) {
    return formats.map(format => {
      const records = rows.filter(item => item.format === format);
      const sum = records.reduce((value,item) => value + item.engagement,0);
      return { format, count: records.length, sum, average: records.length ? sum / records.length : 0 };
    });
  }
  const formatColours = { Video: 'var(--pine)', Image: 'var(--coral)', Text: '#7E9AB5', Article: '#9A7BC0' };
  function competitorAnalytics() {
    const rows = data.competitors.filter(inReport);
    const own = sumByFormat(rows.filter(item => item.own));
    const competitors = sumByFormat(rows.filter(item => !item.own));
    const max = Math.max(1,...[...own,...competitors].map(item => item.average));
    const accounts = [...new Set(rows.map(item => item.account))];
    const formatRows = own.map((item,index) => [item,competitors[index]]).filter(([mine, others]) => mine.count || others.count).sort((a,b) => b[1].average - a[1].average);
    const ahead = formatRows.filter(([mine, others]) => mine.count && mine.average >= others.average).map(([mine]) => mine.format === 'Video' ? 'video' : mine.format.toLowerCase() + 's');
    const behind = formatRows.filter(([mine, others]) => mine.count && mine.average < others.average).map(([mine]) => mine.format === 'Video' ? 'video' : mine.format.toLowerCase() + 's');
    const unused = formatRows.filter(([mine, others]) => !mine.count && others.count).map(([mine]) => mine.format.toLowerCase());
    const insight = !rows.length ? '' : (ahead.length ? 'You out-earn competitors on <strong>' + ahead.join(' and ') + '</strong>. ' : '') + (behind.length ? 'Competitors lead on <strong>' + behind.join(' and ') + '</strong>. ' : ahead.length ? 'Nothing you post trails theirs. ' : '') + (unused.length ? 'You have not posted ' + unused.join(' or ') + ' in this period.' : '');
    return reportToolbar('competitors') + '<div class="panel suite-section"><div class="toolbar"><h2>What works by format</h2><span class="help">Ranked by average engagement per post ' + exampleChip('competitors') + '</span></div>' +
      (rows.length ? '<p class="works-insight">' + insight + '</p><div class="works"><div class="works-head"><span>Format</span><span>Competitors · your average marked</span><span>Competitors</span><span>You</span></div>' + formatRows.map(([mine,others], index) =>
        '<div class="works-row"><span><i style="background:' + formatColours[mine.format] + '"></i>' + (mine.format === 'Video' ? 'Video / Reels' : mine.format + 's') + '</span><span class="works-track"><b style="width:' + (others.average / max * 100).toFixed(1) + '%;background:' + formatColours[mine.format] + ';animation-delay:' + index * 80 + 'ms"></b>' + (mine.count ? '<em style="left:' + (mine.average / max * 100).toFixed(1) + '%" title="You: ' + formatNumber(mine.average) + '"></em>' : '') + '</span><span><strong>' + (others.count ? compact(others.average) : '—') + '</strong><small>' + others.count + ' posts</small></span><span><strong>' + (mine.count ? compact(mine.average) : '—') + '</strong><small>' + mine.count + ' posts</small></span></div>').join('') + '</div>' : exampleOffer('competitors', 'Import post-level data for your accounts and competitors.')) + '</div>' +
      (accounts.length ? '<div class="panel suite-section"><div class="toolbar"><h2>Format performance by account</h2><span class="format-key">' + formats.map(format => '<span><i style="background:' + formatColours[format] + '"></i>' + format + '</span>').join('') + '</span></div><div class="scroll"><table class="suite-table"><thead><tr><th>Account</th><th>Posts</th><th>Engagement by format</th><th>Best format</th><th>Avg. eng. / post</th></tr></thead><tbody>' +
      accounts.map(account => {
        const posts = rows.filter(item => item.account === account);
        const byFormat = sumByFormat(posts);
        const sum = posts.reduce((value,item) => value + item.engagement,0);
        const best = byFormat.filter(item => item.count).sort((a,b) => b.average - a.average)[0];
        return '<tr><td><strong>' + esc(account) + '</strong>' + (posts.some(item => item.own) ? ' <span class="status s-approved">You</span>' : '') + '</td><td>' + posts.length + '</td><td><div class="format-stack">' +
          byFormat.filter(item => item.sum).map(item => '<span class="format-' + item.format.toLowerCase() + '" style="flex-grow:' + item.sum + '" title="' + item.format + ': ' + item.sum + '"></span>').join('') + '</div>' +
          '<small>' + byFormat.filter(item => item.count).map(item => item.format + ' ' + compact(item.sum)).join(' · ') + '</small></td><td>' + (best ? '<span class="row"><i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:' + formatColours[best.format] + '"></i>' + best.format + '</span>' : '—') + '</td><td><strong>' + formatNumber(sum / posts.length) + '</strong></td></tr>';
      }).join('') + '</tbody></table></div></div>' : '') + (rows.length ? '<h2 class="section-title">Top posts in this period</h2>' : '') + '<div class="tile-grid">' +
      rows.slice().sort((a,b) => b.engagement - a.engagement).slice(0,12).map((item, index) => '<article class="panel suite-tile rise" style="--i:' + index + '"><small class="help">' + esc(item.account) + ' · ' + esc(item.format) + ' · ' + esc(printDate(item.at)) + '</small><p>' + esc(item.text) + '</p><div class="row"><span class="status ' + (item.own ? 's-approved' : 's-draft') + '">' + formatNumber(item.engagement) + ' engagements</span>' + safeLink(item.url,'Open post') + '</div></article>').join('') + '</div>';
  }

  function listening() {
    const topics = data.topics.map(item => [item.id, item.name]);
    const topic = data.topics.find(item => item.id === topicFilter);
    const matches = mention => !topic || topic.terms.split(',').some(term => term.trim() && mention.text.toLowerCase().includes(term.trim().toLowerCase()));
    const rows = data.mentions.filter(item => matches(item) && (listeningState === 'all' || Boolean(item.done) === (listeningState === 'done')));
    return '<div class="suite-tools"><div class="row">' + choose('topicFilter','Topic',[['','All mentions'],...topics],topicFilter) +
      choose('listeningState','Status',[['open','Open'],['done','Done'],['all','All']],listeningState) +
      '</div><div class="row">' + exampleChip('mentions') + button('import','Import mentions','mentions') + button('new-topic','Track a topic','',true) + '</div></div><div class="tile-grid">' +
      data.topics.map(item => '<article class="panel suite-tile"><h2>' + esc(item.name) + '</h2><p>' + esc(item.terms) + '</p><div class="row">' +
        button('edit-topic','Edit topic',item.id) + button('topic-select','Show mentions',item.id) + '</div></article>').join('') +
      '</div><section class="panel"><div class="toolbar"><h2>Mentions</h2><span class="status">' + rows.length + '</span></div>' +
      (rows.length ? rows.map(item => '<div class="suite-line"><div><strong>' + esc(item.account) + '</strong><p class="help">' + esc(item.channel) + ' · ' + esc(printDate(item.at)) + '</p><p>' + esc(item.text) + '</p></div><div class="row">' +
        safeLink(item.url,'Open source') + button('mention-done',item.done ? 'Reopen' : 'Mark done',item.id) + '</div></div>').join('') : exampleOffer('mentions', 'Import mentions to search and track them here.')) + '</section>';
  }
  function editTopic(key) {
    const record = data.topics.find(item => item.id === key) || { id: id(), name: '', terms: '' };
    openDialog(key ? 'Edit topic' : 'Track a topic', field('name','Topic name',record.name,'text',true) + field('terms','Keywords (comma-separated)',record.terms,'text',true) +
      (key ? button('delete-topic','Remove topic',record.id) : ''), form => {
      const values = Object.fromEntries(form);
      if (!values.terms.split(',').some(term => term.trim())) throw Error('Enter at least one keyword.');
      data.topics = [...data.topics.filter(item => item.id !== record.id), { ...record, ...values }];
      topicFilter = record.id;
      refresh();
    });
  }
  const integrationDetails = {
    'Claude MCP': ['Local connector', 'Use the local MCP bridge to list accounts, create drafts, and schedule supplied content from Claude Code. See the workspace setup guide.'],
    Slack: ['Webhook setup', 'Send review activity and delivery failures to a configured Slack incoming webhook.'],
    Canva: ['Manual export', 'Export graphics from Canva and upload them to Media or attach them to a draft.'],
    'Public API': ['Local API', 'The workspace publishing API is available only on this computer. It covers accounts, draft editing, scheduling, review, media, and activity. See the publishing queue integration guide.'],
    Zapier: ['Webhook setup', 'Forward workspace publishing and review events to a configured Zapier catch hook.'],
    viaSocket: ['Webhook setup', 'Forward workspace publishing and review events to a configured viaSocket endpoint.'],
    Email: ['Webhook setup', 'Email reviewer invitations and review links through your mail relay. Without one, links wait in Settings › Team › Outbox.'],
    'SE Ranking': ['Import', 'Keyword rankings, site audits and AI search visibility. Import exports on the SEO & AI visibility page.'],
    'AI visibility': ['Import', 'Track whether ChatGPT, Gemini, Perplexity and Google AI Overviews mention and cite Planet Crust.']
  };
  const integrationMeta = {
    'Claude MCP': ['zap', 'Recommended', 'From the project folder, while the workspace server runs: claude mcp add --transport stdio sma -- node mcp.mjs'],
    Slack: ['message', '', 'Set SMA_SLACK_WEBHOOK on the server to a Slack incoming webhook URL. Alerts send in live mode only.'],
    Canva: ['media', '', 'In Canva, choose Share, then Download (PNG or JPG). Upload the file in Media or in the post editor.'],
    'Public API': ['link', '', 'GET /api/publishing/accounts, /posts and /events on the local origin. Write routes and account setup are in publishing/README.md.'],
    Zapier: ['zap', '', 'Set SMA_ZAPIER_WEBHOOK on the server to a Zapier catch hook URL. Events send in live mode only.'],
    viaSocket: ['integrations', '', 'Set SMA_VIASOCKET_WEBHOOK on the server to your viaSocket endpoint. Events send in live mode only.'],
    Email: ['send', '', 'Set SMA_MAIL_WEBHOOK on the server to an HTTPS mail relay. SMA posts { to, subject, text, link } for each invite and review request, in live mode only.'],
    'SE Ranking': ['search', '', 'Open SEO & AI visibility › Keyword rankings and import the Rank Tracker CSV export.'],
    'AI visibility': ['eye', '', 'Open SEO & AI visibility › AI visibility and import AI search results.']
  };
  function integrations() {
    for (const account of queueClient?.accounts || []) channelInfo(accountChannel(account));
    const groups = [...new Set(CHANNEL_LIST.map(entry => entry.cat))];
    const connectedCount = CHANNEL_LIST.filter(entry => accountsFor(entry.name).length).length;
    return '<div class="suite-tools"><p class="help">' + connectedCount + ' of ' + CHANNEL_LIST.length + ' destinations have an account' + (queueClient?.delivery === 'simulate' ? ' (simulation)' : '') + '. LinkedIn and X publish directly. Every other platform publishes through your own automation endpoint (n8n, Zapier or Make).</p><div class="row">' + button('connect-platform', 'Connect another platform', '', true) + '</div></div>' +
      groups.map(group => '<h2 class="section-title">' + esc(group) + '</h2><div class="channel-grid">' + CHANNEL_LIST.filter(entry => entry.cat === group).map(entry => {
        const accounts = accountsFor(entry.name);
        const state = entry.name === 'WordPress' ? ['Review copies', 's-draft'] : !accounts.length ? ['Not connected', 's-draft'] : accounts.some(account => account.simulated) ? ['Simulation', 's-scheduled'] : accounts.every(account => account.connected) ? ['Connected', 's-published'] : ['Setup required', 's-attention'];
        return '<button type="button" class="channel-tile" data-suite="connect-platform" data-value="' + esc(entry.name) + '">' + chanBadge(entry.name, accounts[0]?.id, 18) + '<span><strong>' + esc(entry.name) + '</strong><small>' + esc(accounts.map(account => account.label).join(', ') || (entry.name === 'WordPress' ? 'Paste review copies; publish in WordPress' : 'Connect an account')) + '</small></span><span class="status ' + state[1] + '">' + state[0] + '</span></button>';
      }).join('') + '</div>').join('') + '<h2 class="section-title">Workspace integrations</h2><div class="tile-grid">' +
      Object.entries(integrationDetails).map(([name,[status, detail]], index) => {
        const [glyph, badge] = integrationMeta[name] || ['integrations', ''];
        const configured = queueClient?.integrations?.[name];
        return '<article class="panel suite-tile integration-tile rise" style="--i:' + (index + 4) + '"><span class="int-logo">' + icon(glyph, 20) + '</span><h2>' + esc(name) + (badge ? '<span class="recommended">' + badge + '</span>' : '') + '</h2><p>' + esc(detail) + '</p><div class="row"><span class="status ' + (configured ? 's-published' : 's-draft') + '">' + (configured ? 'Configured' : status) + '</span>' + button('integration-details','Set up',name) + '</div></article>';
      }).join('') + '</div>';
  }
  function connectDialog(name) {
    const channel = name || '';
    const direct = { LinkedIn: ['linkedin', '"author": "urn:li:organization:123456"'], X: ['x', '"handle": "YourHandle"'] }[channel];
    const id = (channel || 'my-platform').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const snippet = direct
      ? '{ "id": "' + id + '", "provider": "' + direct[0] + '", "label": "Your ' + channel + ' account", ' + direct[1] + ', "tokenEnv": "SMA_' + id.toUpperCase().replace(/-/g, '_') + '_TOKEN" }'
      : '{ "id": "' + id + '", "provider": "webhook", "channel": "' + (channel || 'Your platform name') + '", "label": "Your ' + (channel || 'platform') + '", "endpoint": "https://your-automation.example.com/publish", "tokenEnv": "SMA_' + id.toUpperCase().replace(/-/g, '_') + '_TOKEN", "site": "https://your-site.example.com", "logo": "https://your-site.example.com/logo.png" }';
    const accounts = channel ? accountsFor(channel) : [];
    openDialog(channel ? 'Connect ' + channel : 'Connect another platform',
      (accounts.length ? '<p><strong>Accounts:</strong> ' + esc(accounts.map(account => account.label + (account.simulated ? ' (simulation)' : account.connected ? ' (connected)' : ' (setup required)')).join(', ')) + '</p>' : '') +
      (channel === 'WordPress' ? '<p>SMA keeps WordPress review copies only. Schedule the original article in WordPress.</p>' :
      '<p>' + (direct ? channel + ' publishes directly through its official API.' : 'Add the account to the server\u2019s live account file. SMA sends the final copy, graphics and first comment to your endpoint (for example an n8n, Zapier or Make workflow that posts to ' + esc(channel || 'the platform') + '). The endpoint must reply with the published item\u2019s ID and URL.') + '</p>' +
      '<pre>' + esc(snippet) + '</pre><p class="help">Put the token in the named environment variable on the server, never in the file. ' + (direct ? '' : '"site" shows that website\u2019s icon in SMA; "logo" overrides it with any image URL. Any platform name works for "channel".') + ' See publishing/README.md for the full setup.</p>'));
  }
  function settings() {
    const header = tabs('settings-tab',['Profile','Team','Notifications','Integrations','Devices'].map(value => [value,value]),settingsTab);
    if (settingsTab === 'Integrations') return header + integrations();
    // Filled in by team.js (owners, reviewer invites, outbox).
    if (settingsTab === 'Team') return header + '<div id="team-panel" class="team-panel"><p class="help">Loading the team…</p></div>';
    if (settingsTab === 'Notifications') {
      return header + '<form id="notification-settings" class="panel suite-form"><h2>In-app preferences</h2>' +
        Object.entries({ approvals:'Approval requests',feedback:'Review feedback',inbox:'Social inbox',listening:'Tracked mentions',updates:'Publishing updates' }).map(([key,text]) =>
          '<label class="inline"><input type="checkbox" name="' + key + '"' + (data.preferences[key] ? ' checked' : '') + '>' + text + '</label>').join('') +
        '<button class="primary">Save preferences</button></form>';
    }
    if (settingsTab === 'Devices') return header + '<form id="device-settings" class="panel suite-form"><h2>Current device</h2>' +
      '<p class="help">This workspace stores its planning and import settings in this browser.</p>' + field('label','Device label',data.device.label,'text',true) +
      '<button class="primary">Save device label</button></form>';
    return header + '<form id="profile-settings" class="panel suite-form"><h2>Workspace profile</h2>' +
      field('name','Display name',data.profile.name,'text',true) + field('email','Email',data.profile.email,'email') +
      field('timeZone','Default publishing time zone',data.profile.timeZone,'text',true) + '<button class="primary">Save profile</button></form>';
  }

  const samples = {
    inbox: { id:'thread-1', kind:'comment', person:'Example reader', channel:'LinkedIn', source:'organic', text:'Where can I read more?', post:'Example post', url:'https://example.com/post' },
    metrics: { account:'Planet Crust', channel:'LinkedIn', followers:1200, posts:2, impressions:5000, engagements:160 },
    competitors: { id:'post-1', account:'Example account', channel:'LinkedIn', own:false, format:'Image', engagement:120, text:'Example caption', url:'https://example.com/post' },
    mentions: { id:'mention-1', account:'Example reader', channel:'LinkedIn', text:'A mention about sovereign AI', url:'https://example.com/post' }
  };
  function importDialog(kind) {
    if (!Object.hasOwn(samples,kind)) return;
    const sample = JSON.stringify([{ ...samples[kind], at: new Date().toISOString() }], null, 2);
    openDialog('Import ' + ({ inbox:'comments or direct messages', metrics:'performance metrics', competitors:'competitor posts', mentions:'mentions' })[kind],
      '<p class="help">Upload a JSON array or paste it below. Use the example for the field names.</p><label>JSON file<input type="file" id="suite-import-file" accept=".json,application/json"></label>' +
      area('json','JSON records') + '<details class="suite-details"><summary>Example record</summary><pre>' + esc(sample) + '</pre></details>', async form => {
      const file = dialog.querySelector('#suite-import-file').files[0];
      if (file && file.size > 3000000) throw Error('Choose a JSON file under 3 MB.');
      let items;
      try { items = JSON.parse(file ? await file.text() : form.get('json')); } catch { throw Error('Enter a valid JSON array.'); }
      if (!Array.isArray(items) || !items.length || items.length > 3000) throw Error('Import between 1 and 3,000 records at a time.');
      const records = items.map((item,index) => normalise(kind,item,index));
      const merged = new Map(data[kind].map(item => [item.id,item]));
      for (const record of records) {
        const previous = merged.get(record.id);
        merged.set(record.id, { ...record, ...Object.fromEntries(['done','saved','read','reply','sent','replyAttempt'].filter(field => previous && Object.hasOwn(previous,field)).map(field => [field,previous[field]])) });
      }
      data[kind] = [...merged.values()];
      refresh();
      show(records.length + ' records imported.');
    });
  }
  function normalise(kind, item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Record ' + (index + 1) + ' must be an object.');
    const at = new Date(item.at ?? item.date ?? '');
    if (Number.isNaN(+at)) throw Error('Record ' + (index + 1) + ' needs a valid date.');
    const short = value => (typeof value === 'string' ? value.trim().slice(0,250) : '');
    const text = typeof item.text === 'string' ? item.text.trim().slice(0,10000) : '';
    const channel = short(item.channel) || 'Other';
    const account = short(item.account) || data.profile.name;
    const common = { id: short(item.id) || id(), at: at.toISOString(), channel, account, text, url: externalUrl(typeof item.url === 'string' ? item.url : '') };
    const number = key => {
      if (item[key] === undefined || item[key] === '') return 0;
      const value = Number(item[key]);
      if (!Number.isFinite(value) || value < 0 || value > 1e12) throw Error('Record ' + (index + 1) + ' has an invalid ' + key + ' value.');
      return value;
    };
    if (kind === 'metrics') return { ...common, id: [channel,account,common.at].join('|'),
      followers:number('followers'), posts:number('posts'), impressions:number('impressions'), engagements:number('engagements') };
    if (kind === 'competitors') {
      const format = { reel:'Video',video:'Video',image:'Image',text:'Text',article:'Article' }[String(item.format).toLowerCase()];
      if (!format) throw Error('Record ' + (index + 1) + ' needs a format: Video, Image, Text, or Article.');
      return { ...common, format, own:item.own === true, engagement:number('engagement') };
    }
    if (!text) throw Error('Record ' + (index + 1) + ' needs text.');
    if (kind === 'inbox') {
      if (!['comment','dm'].includes(item.kind)) throw Error('Record ' + (index + 1) + ' needs kind comment or dm.');
      return { ...common, externalId:short(item.externalId) || short(item.id), kind:item.kind, source:item.source === 'ad' ? 'ad' : 'organic', person:short(item.person) || account, post:short(item.post), reply:'', read:false, done:false, saved:false };
    }
    return { ...common, done:false };
  }
  function exportReport(kind) {
    const keys = kind === 'metrics' ? ['at','channel','account','followers','posts','impressions','engagements'] : ['at','channel','account','own','format','engagement','text','url'];
    const cells = value => {
      const raw = String(value ?? '');
      const plain = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
      return '"' + plain.replaceAll('"','""') + '"';
    };
    const rows = data[kind].filter(inReport);
    const csv = [keys.join(','), ...rows.map(item => keys.map(key => cells(item[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{ type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'planet-crust-' + kind + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  // Clearly labelled example records so empty reporting screens can be explored in simulation.
  function loadExamples(kind) {
    if (!Object.hasOwn(samples, kind) || data[kind].some(item => item.example)) return;
    const day = 864e5, now = Date.now();
    let seed = 42;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const at = offset => new Date(now - offset * day - Math.floor(rand() * 8) * 36e5).toISOString();
    if (kind === 'metrics') {
      const base = { LinkedIn: [4180, 1.9, 4.2], X: [1760, 1.2, 1.6] };
      for (const [channel, [start, scale, growth]] of Object.entries(base)) for (let i = 179; i >= 0; i--) {
        const impressions = Math.round((900 + rand() * 1900) * scale * (1 + (179 - i) / 320));
        data.metrics.push({ id: 'example|' + channel + '|' + i, example: true, at: new Date(now - i * day).toISOString(), channel, account: 'Planet Crust', text: '', url: '',
          followers: Math.round(start + (179 - i) * growth + rand() * 6), posts: rand() > .55 ? 1 : 0, impressions, engagements: Math.round(impressions * (.025 + rand() * .03)) });
      }
    }
    if (kind === 'competitors') {
      const accounts = [['Planet Crust', true], ['Example competitor A', false], ['Example competitor B', false], ['Example competitor C', false]];
      const captions = ['Three questions to ask before you deploy an AI agent.', 'How we document every AI decision for audit.', 'A five-minute walkthrough of our governance dashboard.', 'What the EU AI Act means for your team this year.', 'Customer story: shipping automations with sign-off built in.', 'Behind the scenes of our release review.'];
      accounts.forEach(([account, own], a) => { for (let i = 0; i < 6; i++) {
        const format = ['Video', 'Image', 'Text', 'Image', 'Video', 'Article'][(i + a) % 6];
        if (own && format === 'Text') continue;
        data.competitors.push({ id: 'example-comp-' + a + '-' + i, example: true, at: at(2 + i * 4), channel: i % 2 ? 'X' : 'LinkedIn', account, own, format, text: captions[(i + a) % captions.length], url: '',
          engagement: Math.round({ Video: 900, Image: 640, Text: 320, Article: 410 }[format] * (own ? 1.12 : 1) * (.7 + rand() * .6)) });
      } });
    }
    if (kind === 'inbox') {
      const threads = [['comment', 'LinkedIn', 'Example reader', 'Where can I find the governance checklist you mentioned?'], ['comment', 'X', 'Example reader 2', 'Does this work with our existing approval process?'], ['dm', 'LinkedIn', 'Example prospect', 'Could we book a walkthrough for our compliance team?'], ['comment', 'LinkedIn', 'Example partner', 'Great breakdown of the AI Act timeline.'], ['dm', 'X', 'Example journalist', 'Can I quote this post in an article next week?']];
      threads.forEach(([threadKind, channel, person, text], i) => data.inbox.push({ id: 'example-thread-' + i, example: true, externalId: '', kind: threadKind, source: 'organic', channel, account: 'Planet Crust', person, text, post: 'Example post: What would it take for your team to run AI on its own terms?', url: '', at: at(i * .4), reply: '', read: false, done: false, saved: false }));
    }
    if (kind === 'mentions') {
      data.topics.push({ id: 'example-topic', example: true, name: 'Sovereign AI', terms: 'sovereign AI, AI governance' });
      ['Teams keep asking how sovereign AI differs from on-premise hosting.', 'Good thread on AI governance and who signs off on agents.', 'Is anyone using an AI governance platform with an audit trail?', 'Sovereign AI is turning into a procurement requirement here.'].forEach((text, i) =>
        data.mentions.push({ id: 'example-mention-' + i, example: true, account: 'Example account ' + (i + 1), channel: i % 2 ? 'X' : 'LinkedIn', text, url: '', at: at(i), done: false }));
    }
    refresh();
    show('Example data added. It is labelled and can be cleared at any time.');
  }
  function saveMeta(item, key) {
    const previous = data.metadata[item.id] || data.metadata[key] || {};
    const next = { ...previous };
    for (const name of ['campaign','labels','group','author','format','audience']) {
      if (typeof item[name] === 'string') next[name] = item[name].trim();
    }
    data.metadata[key] = next;
    if (item.id && item.id !== key) delete data.metadata[item.id];
    persistTools();
  }
  function archive(items) {
    const blocked = items.filter(item => item.status === 'Scheduled' || item.status === 'Publishing');
    const allowed = items.filter(item => !blocked.includes(item));
    allowed.forEach(item => { data.metadata[item.id] = { ...meta(item), archived:true }; });
    selection.clear();
    refresh();
    show(allowed.length + ' archived.' + (blocked.length ? ' Unschedule the other posts first.' : ''));
  }
  function bulkAssign(type, items) {
    const inputs = type === 'campaign' ? choose('value','Campaign',[['','Remove from campaign'],...data.campaigns.map(item => [item.id,item.name])]) : field('value','Group name','','text',true);
    openDialog(type === 'campaign' ? 'Assign campaign' : 'Group posts',inputs,form => {
      items.forEach(item => { data.metadata[item.id] = { ...meta(item), [type]:String(form.get('value')) }; });
      refresh();
    });
  }
  function reviewNext() {
    while (reviewOrder.length) {
      const item = allItems().find(candidate => candidate.id === reviewOrder[0]);
      if (item) { openItem(item); return; }
      reviewOrder.shift();
    }
    if (editor.open) editor.close();
  }
  async function runBulk(action, items = allItems().filter(item => selection.has(item.id))) {
    if (bulkBusy) return;
    if (!items.length) return show('Select at least one post.');
    if (action === 'archive') return archive(items);
    if (action === 'group') return bulkAssign('group',items);
    if (action === 'ungroup') {
      items.forEach(item => { data.metadata[item.id] = { ...meta(item), group:'' }; });
      return refresh();
    }
    if (action === 'publish' && !window.confirm('Publish the selected server-queued social posts now?')) return;
    bulkBusy = true;
    try {
      const { done,errors } = queueClient ? await queueClient.bulk(items,action) : { done:0,errors:[] };
      const local = items.filter(item => !item.remote && action !== 'publish' && (action !== 'unschedule' || item.status === 'Scheduled'));
      for (const item of local) {
        if (action === 'approve') { item.review = 'You'; record(item,'Approved by you','review'); }
        if (action === 'review') { item.review = 'Pending'; record(item,'Local review requested','review'); }
        if (action === 'unschedule') { item.status = 'Draft'; item.date = ''; record(item,'Unschedule'); }
      }
      persist();
      selection.clear();
      refresh();
      if (errors.length) openDialog('Bulk action results', '<p>' + (done + local.length) + ' completed.</p><ul>' + errors.map(error => '<li>' + esc(error) + '</li>').join('') + '</ul>');
      else show((done + local.length) + ' updated.' + (items.length > done + local.length ? ' Some posts were ineligible or not queued on the server.' : ''));
    } catch (error) { show(error.message); }
    finally { bulkBusy = false; }
  }
  function editorActions(item) {
    const extra = reviewOrder.length ? '<span class="status s-review">' + (reviewTotal - reviewOrder.length + 1) + ' of ' + reviewTotal + '</span>' + button('review-skip','Skip') : '';
    return extra + '<details class="editor-menu"><summary>Post actions</summary><div class="editor-menu-body">' +
      button('duplicate','Duplicate as draft') + button('copy-channel','Copy to another channel') + button('save-template','Save as template') + button('claude-brief','Copy edit brief for Claude') +
      (item.id ? button('share','Copy workspace link') + button('activity','Activity') + button('add-note','Add internal note') + (meta(item).group ? button('variants','View grouped variants') : '') + button('hide',meta(item).hidden ? 'Mark client-visible' : 'Mark internal') +
      button(isArchived(item) ? 'unarchive' : 'archive',isArchived(item) ? 'Restore' : 'Archive') : '') + '</div></details>';
  }
  function duplicate(item, channel = item.channel) {
    const { body,title,asset,permalink,linkPlacement,comment,delay,campaign,labels,group,format,author,audience } = item;
    openItem({ ...blank(), channel, body,title,asset,permalink,linkPlacement,comment,delay,campaign,labels,group,format,author,audience });
  }
  function editorClick(event) {
    const target = event.target.closest('[data-suite]');
    if (!target) return false;
    const item = currentForm();
    const action = target.dataset.suite;
    switch (action) {
      case 'review-skip': reviewOrder.shift(); reviewNext(); break;
      case 'duplicate': duplicate(item); break;
      case 'copy-channel':
        openDialog('Copy post to a channel','<label>Destination<select name="channel">' + channelOptions(item.channel) + '</select></label>',form => duplicate(item,form.get('channel')));
        break;
      case 'save-template':
        openDialog('Save template',field('name','Template name',item.title,'text',true),form => {
          const { title,body,channel,permalink,linkPlacement,comment,delay } = item;
          data.templates.push({ id:id(), name:form.get('name'), title,body,channel,permalink,linkPlacement,comment,delay });
          refresh();
          show('Template saved.');
        });
        break;
      case 'share': copyText(location.href.split('#')[0] + '#post=' + encodeURIComponent(item.id)); break;
      case 'claude-brief':
        copyText(['Revise my draft for ' + item.channel + ' using the feedback below. Keep the intended meaning, permalink, and publishing schedule. Return revised copy for my review.',
          item.title,item.body,item.notes.map(note => note.author + ': ' + note.text).join('\n'),item.permalink, item.comment && 'First comment: ' + item.comment].filter(Boolean).join('\n\n'));
        break;
      case 'activity': {
        const history = item.remote?.history?.slice().reverse() || state.events.filter(event => event.item === item.id);
        openDialog('Post activity',history.length ? history.map(event => '<p class="note"><small>' + esc(printDate(event.at)) + '</small>' + esc(event.label || event.type.replaceAll('_',' ')) + '</p>').join('') : blankPanel('No activity recorded.'));
        break;
      }
      case 'add-note':
        openDialog('Add internal note',area('note','Note','',true),async form => {
          const note = form.get('note').trim();
          if (!note) throw Error('Write a note first.');
          if (item.remote) {
            const saved = await queueClient.addNote(item,note);
            openItem({ ...item, remote:saved.remote, notes:saved.notes });
          } else {
            const original = state.items.find(candidate => candidate.id === item.id);
            if (!original) throw Error('Save this item first.');
            original.notes.push({ author:data.profile.name,text:note });
            record(original,'Internal note added','review');
            persist();
            render();
            openItem({ ...item, notes:original.notes });
          }
        });
        break;
      case 'variants': {
        const group = meta(item).group;
        const variants = allItems().filter(variant => !isArchived(variant) && meta(variant).group === group);
        openDialog(group,variants.map(variant => '<div class="suite-line"><div><strong>' + esc(variant.title) + '</strong><p class="help">' + esc(variant.channel) + '</p></div>' + button('open-variant','Open variant',variant.id) + '</div>').join(''));
        break;
      }
      case 'hide':
        data.metadata[item.id] = { ...meta(item), hidden:!meta(item).hidden };
        refresh(); openItem(item); break;
      case 'archive':
        archive([item]);
        if (isArchived(item)) editor.close();
        break;
      case 'unarchive':
        data.metadata[item.id] = { ...meta(item), archived:false };
        refresh(); openItem(item); break;
      default: return false;
    }
    return true;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); show('Copied.'); }
    catch { openDialog('Copy text',area('copy','Select and copy',text)); }
  }
  function openItemById(key) {
    const item = allItems().find(candidate => candidate.id === key);
    if (item) openItem(item);
    else show('This item is not available in this workspace.');
  }
  function handle(action, value) {
    switch (action) {
      case 'saved-calendars':
        openDialog('Saved calendar views', field('name','Name this view','','text',true) +
          data.calendars.map(view => '<div class="suite-line"><strong>' + esc(view.name) + '</strong><div class="row">' + button('calendar-view','Open',view.id) +
            button('remove-calendar-view','Remove',view.id) + '</div></div>').join(''), form => {
          data.calendars.push({ id:id(),name:form.get('name'),filters:{ ...filters },mode,channelFilter });
          persistTools(); show('Calendar view saved.');
        });
        break;
      case 'calendar-view': {
        const saved = data.calendars.find(item => item.id === value);
        if (saved) {
          filters = { ...saved.filters }; mode = saved.mode; channelFilter = saved.channelFilter; render(); dialog.close();
        }
        break;
      }
      case 'remove-calendar-view':
        data.calendars = data.calendars.filter(item => item.id !== value);
        persistTools(); handle('saved-calendars'); break;
      case 'open-variant': dialog.close(); openItemById(value); break;
      case 'filters': filterOpen = !filterOpen; render(); break;
      case 'clear-filters': filters = {}; channelFilter = ''; render(); break;
      case 'select-mode': selectionMode = !selectionMode; selection.clear(); render(); break;
      case 'clear-selection': selection.clear(); render(); break;
      case 'select-all': filtered(allItems().filter(item => !channelFilter || item.channel === channelFilter)).forEach(item => selection.add(item.id)); render(); break;
      case 'bulk': runBulk(value); break;
      case 'bulk-campaign': bulkAssign('campaign',allItems().filter(item => selection.has(item.id))); break;
      case 'new-campaign': case 'edit-campaign': editCampaign(value); break;
      case 'new-milestone': case 'edit-milestone': editMilestone(value); break;
      case 'delete-campaign':
        if (!window.confirm('Remove this campaign and detach its posts and events?')) break;
        data.campaigns = data.campaigns.filter(item => item.id !== value);
        for (const info of Object.values(data.metadata)) if (info.campaign === value) info.campaign = '';
        data.milestones.forEach(item => { if (item.campaign === value) item.campaign = ''; });
        dialog.close(); refresh(); break;
      case 'delete-milestone': data.milestones = data.milestones.filter(item => item.id !== value); dialog.close(); refresh(); break;
      case 'campaign-calendar': page = 'Calendar'; filters = { campaign:value }; filterOpen = true; render(); break;
      case 'run-review':
        reviewOrder = filtered(allItems()).filter(item => reviewGroup(item) === 'Pending').map(item => item.id);
        reviewTotal = reviewOrder.length;
        if (reviewOrder.length) reviewNext(); else show('No items are awaiting review.');
        break;
      case 'approve-pending': runBulk('approve',filtered(allItems()).filter(item => reviewGroup(item) === 'Pending')); break;
      case 'content-tab': contentTab = value; render(); break;
      case 'use-template': {
        const template = data.templates.find(item => item.id === value);
        if (template) duplicate({ ...blank(), ...template });
        break;
      }
      case 'delete-template': data.templates = data.templates.filter(item => item.id !== value); refresh(); break;
      case 'notification-tab': notificationTab = value; redrawNotifications(); break;
      case 'notification-unread': unreadOnly = !unreadOnly; redrawNotifications(); break;
      case 'notification-clear': data.read = [...new Set([...data.read,...JSON.parse(value)])]; persistTools(); redrawNotifications(); break;
      case 'notification-open': {
        const [category,key,readKey] = JSON.parse(value);
        data.read.push(readKey);
        persistTools();
        if (dialog.open) dialog.close();
        if (category === 'Social inbox') {
          const item = data.inbox.find(candidate => candidate.id === key);
          if (!item) break;
          item.read = true; inboxKind = item.kind; inboxSelected = key; page = 'Inbox'; refresh();
        } else if (category === 'Listening') { page = 'Listening'; render(); }
        else openItemById(key);
        break;
      }
      case 'inbox-kind': inboxKind = value; inboxSelected = ''; render(); break;
      case 'inbox-open': case 'inbox-pin': case 'inbox-done': {
        const item = data.inbox.find(item => item.id === value);
        if (!item) break;
        inboxSelected = item.id;
        if (action === 'inbox-open') item.read = true;
        if (action === 'inbox-pin') item.saved = !item.saved;
        if (action === 'inbox-done') item.done = !item.done;
        refresh(); break;
      }
      case 'copy': copyText(value); break;
      case 'inbox-send': sendInboxReply(value); break;
      case 'import': importDialog(value); break;
      case 'export-report': exportReport(value); break;
      case 'new-topic': case 'edit-topic': editTopic(value); break;
      case 'delete-topic': data.topics = data.topics.filter(item => item.id !== value); topicFilter = ''; dialog.close(); refresh(); break;
      case 'topic-select': topicFilter = value; render(); break;
      case 'mention-done': {
        const item = data.mentions.find(item => item.id === value);
        if (item) { item.done = !item.done; refresh(); }
        break;
      }
      case 'settings-tab': settingsTab = value; render(); break;
      case 'connect-platform': connectDialog(value); break;
      case 'report-metric': reportMetric = value; render(); break;
      case 'load-examples': loadExamples(value); break;
      case 'clear-examples': data[value] = data[value].filter(item => !item.example); if (value === 'mentions') data.topics = data.topics.filter(item => !item.example); refresh(); show('Example data removed.'); break;
      case 'integration-details':
        if (!['Claude MCP','Public API'].includes(value) && integrationMeta[value]) openDialog(value + ' setup','<p>' + esc(integrationMeta[value][2]) + '</p>');
        if (value === 'Claude MCP') openDialog('Claude Code setup','<p>Start the workspace server. From the project folder, run:</p><pre>claude mcp add --transport stdio sma -- node mcp.mjs</pre>');
        if (value === 'Public API') openDialog('Local publishing API','<p>Use the same local origin as the workspace.</p><pre>GET /api/publishing/accounts\nGET /api/publishing/posts\nGET /api/publishing/events</pre><p class="help">See publishing/README.md in the project for write routes and account setup.</p>');
        break;
      default: return false;
    }
    return true;
  }
  const click = event => {
    const target = event.target.closest('[data-suite]');
    return target ? handle(target.dataset.suite,target.dataset.value) : false;
  };
  function change(event) {
    const field = event.target;
    if (field.dataset.selectItem) {
      if (field.checked) selection.add(field.dataset.selectItem);
      else selection.delete(field.dataset.selectItem);
      render(); return true;
    }
    switch (field.name) {
      case 'inboxState': inboxState = field.value; break;
      case 'inboxSource': inboxSource = field.value; break;
      case 'reportDays': reportDays = field.value; break;
      case 'reportChannel': reportChannel = field.value; break;
      case 'reportMetric': reportMetric = field.value; break;
      case 'reportInterval': reportInterval = field.value; break;
      case 'reportBreakdown': reportBreakdown = field.value; break;
      case 'topicFilter': topicFilter = field.value; break;
      case 'listeningState': listeningState = field.value; break;
      default: return false;
    }
    render();
    return true;
  }
  function redrawNotifications() {
    if (dialog.open) { openDialog('Notifications',notifications()); dialog.classList.add('drawer'); }
    else render();
  }
  view.addEventListener('submit',event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = Object.fromEntries(form);
    switch (event.target.id) {
      case 'search-posts': filters.query = values.query; break;
      case 'filters-form': filters = { ...filters,...values }; break;
      case 'inbox-reply': {
        const item = data.inbox.find(item => item.id === values.id);
        if (item) { item.reply = values.reply.trim(); item.read = true; show('Reply draft saved.'); }
        break;
      }
      case 'profile-settings':
        try { new Intl.DateTimeFormat('en',{ timeZone:values.timeZone }).format(); }
        catch { show('Enter a valid time zone, such as Asia/Dhaka.'); return; }
        data.profile = values; show('Profile saved.'); break;
      case 'notification-settings':
        data.preferences = Object.fromEntries(Object.keys(data.preferences).map(key => [key,form.has(key)]));
        show('Preferences saved.'); break;
      case 'device-settings': data.device = values; show('Device label saved.'); break;
      default: return;
    }
    refresh();
  });
  dialog.addEventListener('click',click);
  document.querySelector('#notification-drawer').onclick = () => openDialog('Notifications',notifications());
  document.querySelector('#global-search').onclick = () => openDialog('Search workspace',field('query','Post title, copy, or label',filters.query),form => {
    page = 'Content'; contentTab = 'Posts'; filters = { query:form.get('query') }; render();
  });

  return {
    filtered, selector, cardMeta, planningToolbar, bulkBar, dayItems, saveMeta, click, change, editorClick, editorActions,
    unreadCount, run: runBulk, duplicate, isArchived,
    inboxUnread: () => data.inbox.filter(item => !item.read && !item.done).length,
    openNotifications() { openDialog('Notifications', notifications()); dialog.classList.add('drawer'); },
    editorFields: itemFields,
    defaultTimeZone: () => data.profile.timeZone,
    reviewSaved(key) {
      if (reviewOrder[0] !== key) return;
      reviewOrder.shift();
      reviewNext();
    },
    renderPage(name) {
      const renderers = { Content:content,Campaigns:campaigns,Approvals:approvals,Notifications:notifications,Inbox:inbox,Analytics:analytics,Competitors:competitorAnalytics,Listening:listening,Connections:integrations,Settings:settings };
      if (!renderers[name]) return false;
      view.innerHTML = renderers[name]();
      return true;
    },
    openSharedPost() {
      if (!location.hash.startsWith('#post=')) return;
      try { openItemById(decodeURIComponent(location.hash.slice(6))); } catch { show('Invalid workspace link.'); }
    }
  };
})();
render();
if (location.protocol === 'file:' && location.hash) suite.openSharedPost();
