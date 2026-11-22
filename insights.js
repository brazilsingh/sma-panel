'use strict';
// Insight pages registered with app.js through `extraPages`:
//  SEO   – SE Ranking keyword rankings and AI visibility (how AI assistants mention and cite Planet Crust), from imports.
//  Guide – what gets reach on each platform, and exact image, GIF, video and text sizes (platform-guide.js).
var extraPages = {};
(function () {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KEY = 'sma-insights-v1';
  const BRAND = /planet\s*crust|planetcrust\.com|@human|human\.cloud/i;
  let data;
  try { data = { rankings: [], ai: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { data = { rankings: [], ai: [] }; }
  let seoTab = 'AI visibility';
  let importing = '';
  let guidePick = 'LinkedIn';
  let guideQuery = '';
  let guideGroup = '';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { show('Browser storage is full. Clear older imports.'); } };
  const rerender = () => { save(); render(); };
  const say = text => { try { show(text); } catch {} };
  // Empty, "-" or "not ranked" cells are unknown, never 0.
  const num = v => { const text = String(v ?? '').replace(/[, %]/g, ''); if (!/\d/.test(text)) return null; const n = Number(text); return Number.isFinite(n) ? n : null; };
  const yes = v => /^(1|true|yes|y|mentioned|cited|✓)$/i.test(String(v ?? '').trim());
  const pct = (part, whole) => whole ? Math.round(part / whole * 100) + '%' : '–';
  const btn = (act, label, value = '', primary = false) => '<button type="button" class="' + (primary ? 'primary' : 'secondary') + '" data-ins="' + act + '" data-value="' + e(value) + '">' + e(label) + '</button>';
  const tabsHtml = (act, list, current) => '<div class="suite-tabs">' + list.map(name => btn(act, name, name, name === current)).join('') + '</div>';
  const stat = (label, value, note) => '<article class="panel stat"><span>' + e(label) + '</span><strong>' + e(value) + '</strong>' + (note ? '<small class="help">' + e(note) + '</small>' : '') + '</article>';
  const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const link = (url, text) => safeUrl(url) ? '<a href="' + e(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer">' + e(text || url) + '</a>' : e(text || '');

  // ---------- Import (CSV or JSON, as exported from SE Ranking or any tracker) ----------
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    const delimiter = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; continue; }
      if (c === '"') quoted = true;
      else if (c === delimiter) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows.filter(r => r.some(v => v.trim()));
    if (!head) return [];
    const keys = head.map(h => h.trim().toLowerCase());
    return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
  }
  const pick = (row, names) => { for (const name of names) { const hit = Object.keys(row).find(k => k.toLowerCase() === name); if (hit && row[hit] !== '') return row[hit]; } return ''; };
  function rows(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Paste a CSV export or a JSON array first.');
    if (/^[\[{]/.test(trimmed)) {
      const value = JSON.parse(trimmed);
      const list = Array.isArray(value) ? value : value.rows || value.data || value.items || [];
      if (!Array.isArray(list)) throw new Error('The JSON needs an array of rows.');
      return list.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
    }
    return parseCsv(trimmed);
  }
  const importers = {
    rankings(text) {
      const list = rows(text).map(r => ({
        id: crypto.randomUUID(),
        keyword: String(pick(r, ['keyword', 'query', 'search query', 'keywords'])),
        position: num(pick(r, ['position', 'current position', 'rank', 'pos', 'google'])),
        previous: num(pick(r, ['previous', 'previous position', 'prev position', 'last position'])),
        volume: num(pick(r, ['volume', 'search volume', 'search vol.', 'sv'])),
        url: String(pick(r, ['url', 'landing page', 'page', 'ranking url'])),
        engine: String(pick(r, ['engine', 'search engine']) || 'Google'),
        date: String(pick(r, ['date', 'check date', 'checked']) || new Date().toISOString().slice(0, 10))
      })).filter(r => r.keyword);
      if (!list.length) throw new Error('No rows with a keyword column were found.');
      data.rankings = [...data.rankings.filter(r => !r.example), ...list];
      return list.length;
    },
    ai(text) {
      const list = rows(text).map(r => {
        const answer = String(pick(r, ['answer', 'response', 'snippet']));
        const mentionedRaw = pick(r, ['mentioned', 'brand mentioned', 'mention', 'visible']);
        const cited = String(pick(r, ['cited url', 'citation', 'cited', 'source', 'link', 'url']));
        return {
          id: crypto.randomUUID(),
          prompt: String(pick(r, ['prompt', 'query', 'question', 'keyword'])),
          engine: String(pick(r, ['engine', 'llm', 'ai engine', 'model', 'platform']) || 'Unknown'),
          mentioned: mentionedRaw !== '' ? yes(mentionedRaw) : BRAND.test(answer),
          position: num(pick(r, ['position', 'rank', 'mention position'])),
          cited: /planetcrust\.com|human\.cloud/i.test(cited) ? cited : '',
          competitors: String(pick(r, ['competitors', 'other brands', 'brands'])),
          date: String(pick(r, ['date', 'checked']) || new Date().toISOString().slice(0, 10))
        };
      }).filter(r => r.prompt);
      if (!list.length) throw new Error('No rows with a prompt column were found.');
      data.ai = [...data.ai.filter(r => !r.example), ...list];
      return list.length;
    }
  };
  const examples = {
    rankings: () => [
      ['sovereign ai', 7, 11, 1900, 'https://planetcrust.com/what-is-sovereign-ai/'], ['ai governance platform', 14, 12, 880, 'https://planetcrust.com/'],
      ['ai agents for business', 9, 18, 2400, 'https://planetcrust.com/ai-agents-for-business/'], ['human in the loop', 23, 31, 3600, 'https://planetcrust.com/human-in-the-loop-vs-human-on-the-loop/'],
      ['agentic ai governance', 5, 6, 480, 'https://planetcrust.com/agentic-ai-governance/'], ['eu ai act delay', 3, 4, 1300, 'https://planetcrust.com/eu-ai-act-delay-what-still-applies/']
    ].map(([keyword, position, previous, volume, url]) => ({ id: crypto.randomUUID(), example: true, keyword, position, previous, volume, url, engine: 'Google', date: new Date().toISOString().slice(0, 10) })),
    ai: () => [
      ['What is sovereign AI?', 'ChatGPT', true, 3, 'https://planetcrust.com/what-is-sovereign-ai/', 'Example competitor A, Example competitor B'], ['What is sovereign AI?', 'Perplexity', true, 2, 'https://planetcrust.com/what-is-sovereign-ai/', 'Example competitor A'],
      ['Best AI governance platforms', 'ChatGPT', false, null, '', 'Example competitor A, Example competitor C'], ['Best AI governance platforms', 'Google AI Overviews', true, 5, '', 'Example competitor C'],
      ['How do I govern AI agents?', 'Gemini', false, null, '', 'Example competitor B'], ['How do I govern AI agents?', 'Perplexity', true, 4, 'https://planetcrust.com/agentic-ai-governance/', 'Example competitor B']
    ].map(([prompt, engine, mentioned, position, cited, competitors]) => ({ id: crypto.randomUUID(), example: true, prompt, engine, mentioned, position, cited, competitors, date: new Date().toISOString().slice(0, 10) }))
  };

  function importPanel(kind) {
    const label = kind === 'ai' ? 'AI visibility results' : 'keyword rankings';
    const columns = kind === 'ai' ? 'prompt, engine, mentioned (yes/no), position, cited url, competitors, date' : 'keyword, position, previous position, search volume, url, date';
    return '<form class="panel suite-form" data-ins-form="' + kind + '"><h2>Import ' + label + '</h2><p class="help">Paste a CSV export (for example from SE Ranking) or a JSON array. Recognised columns: ' + e(columns) + '. Imports replace example rows and are stored in this browser.</p>' +
      '<label>Data<textarea name="text" rows="8" placeholder="keyword,position,previous position\nsovereign ai,7,11"></textarea></label><label>Or choose a file<input type="file" name="file" accept=".csv,.json,text/csv,application/json"></label>' +
      '<div class="row"><button class="primary">Import</button>' + btn('cancel-import', 'Cancel') + '</div></form>';
  }
  const tools = kind => '<div class="row">' + btn('import', 'Import', kind, true) + (data[kind].length ? '' : btn('example', 'Load example', kind)) +
    (data[kind].some(r => r.example) ? btn('clear-example', 'Remove examples', kind) : '') + (data[kind].length ? btn('export', 'Export CSV', kind) + btn('clear', 'Clear all', kind) : '') + '</div>';
  const exampleTag = list => list.some(r => r.example) ? ' <span class="status s-draft">Example data</span>' : '';

  function aiView() {
    const list = data.ai;
    if (importing === 'ai') return importPanel('ai');
    const engines = [...new Set(list.map(r => r.engine))].sort();
    const mentioned = list.filter(r => r.mentioned);
    const cited = list.filter(r => r.cited);
    const positions = mentioned.map(r => r.position).filter(v => v != null);
    return '<div class="suite-tools"><p class="help">How AI assistants (ChatGPT, Gemini, Perplexity, Google AI Overviews and others) answer the prompts you track: is Planet Crust mentioned, in which position, and is planetcrust.com cited?' + exampleTag(list) + '</p>' + tools('ai') + '</div>' +
      (list.length ? '<div class="stat-grid">' + stat('Prompt checks', String(list.length), engines.length + ' engines') + stat('Mentioned', pct(mentioned.length, list.length), mentioned.length + ' of ' + list.length) +
        stat('Cited with a link', pct(cited.length, list.length), cited.length + ' answers link to us') + stat('Average position', positions.length ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : '–', 'When mentioned') + '</div>' +
        '<section class="panel"><div class="toolbar"><h2>By engine</h2></div><div class="scroll"><table class="suite-table"><thead><tr><th>Engine</th><th>Checks</th><th>Mentioned</th><th>Cited</th><th>Avg position</th></tr></thead><tbody>' +
        engines.map(engine => { const rowsFor = list.filter(r => r.engine === engine); const m = rowsFor.filter(r => r.mentioned); const p = m.map(r => r.position).filter(v => v != null);
          return '<tr><td><strong>' + e(engine) + '</strong></td><td>' + rowsFor.length + '</td><td>' + pct(m.length, rowsFor.length) + '</td><td>' + pct(rowsFor.filter(r => r.cited).length, rowsFor.length) + '</td><td>' + (p.length ? (p.reduce((a, b) => a + b, 0) / p.length).toFixed(1) : '–') + '</td></tr>'; }).join('') +
        '</tbody></table></div></section><section class="panel"><div class="toolbar"><h2>Prompts</h2></div><div class="scroll"><table class="suite-table"><thead><tr><th>Prompt</th><th>Engine</th><th>Planet Crust</th><th>Position</th><th>Cited page</th><th>Other brands named</th><th>Date</th></tr></thead><tbody>' +
        list.slice().sort((a, b) => a.prompt.localeCompare(b.prompt) || a.engine.localeCompare(b.engine)).map(r => '<tr><td>' + e(r.prompt) + '</td><td>' + e(r.engine) + '</td><td>' + (r.mentioned ? '<span class="status s-published">Mentioned</span>' : '<span class="status s-attention">Not mentioned</span>') + '</td><td>' + (r.position ?? '–') + '</td><td>' + (r.cited ? link(r.cited, new URL(safeUrl(r.cited) || 'https://x').pathname) : '–') + '</td><td>' + e(r.competitors || '–') + '</td><td>' + e(r.date) + '</td></tr>').join('') +
        '</tbody></table></div></section>'
        : '<div class="panel suite-form"><p class="empty">No AI visibility data yet. Import results from SE Ranking (AI Search / AI Results Tracker export) or load the example to see the layout.</p></div>');
  }

  function rankingsView() {
    const list = data.rankings;
    if (importing === 'rankings') return importPanel('rankings');
    const ranked = list.filter(r => r.position != null);
    const up = list.filter(r => r.position != null && r.previous != null && r.position < r.previous).length;
    const down = list.filter(r => r.position != null && r.previous != null && r.position > r.previous).length;
    const change = r => r.position == null || r.previous == null ? '–' : r.previous === r.position ? '0' : (r.previous > r.position ? '▲ ' + (r.previous - r.position) : '▼ ' + (r.position - r.previous));
    return '<div class="suite-tools"><p class="help">Keyword positions from SE Ranking (or any rank tracker export).' + exampleTag(list) + '</p>' + tools('rankings') + '</div>' +
      (list.length ? '<div class="stat-grid">' + stat('Keywords', String(list.length)) + stat('Top 3', String(ranked.filter(r => r.position <= 3).length)) + stat('Top 10', String(ranked.filter(r => r.position <= 10).length)) +
        stat('Average position', ranked.length ? (ranked.reduce((a, r) => a + r.position, 0) / ranked.length).toFixed(1) : '–') + stat('Moved', up + ' up · ' + down + ' down') + '</div>' +
        '<section class="panel"><div class="scroll"><table class="suite-table"><thead><tr><th>Keyword</th><th>Position</th><th>Change</th><th>Search volume</th><th>Ranking page</th><th>Engine</th><th>Date</th></tr></thead><tbody>' +
        list.slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).map(r => '<tr><td><strong>' + e(r.keyword) + '</strong></td><td>' + (r.position ?? 'Not in top 100') + '</td><td>' + e(change(r)) + '</td><td>' + (r.volume != null ? r.volume.toLocaleString() : '–') + '</td><td>' + (r.url ? link(r.url, (() => { try { return new URL(r.url).pathname; } catch { return r.url; } })()) : '–') + '</td><td>' + e(r.engine) + '</td><td>' + e(r.date) + '</td></tr>').join('') +
        '</tbody></table></div></section>'
        : '<div class="panel suite-form"><p class="empty">No rankings yet. Export the Rank Tracker table from SE Ranking as CSV and import it, or load the example.</p></div>');
  }

  function connectView() {
    const configured = queueClient?.integrations || {};
    return '<div class="tile-grid">' +
      '<article class="panel suite-tile"><span class="int-logo">' + chanMono('SE', '#2B3B3C') + '</span><h2>SE Ranking</h2><p>Keyword rankings, site audits and AI search visibility. Export the Rank Tracker or AI Results tables as CSV and import them here. Claude Code with the SE Ranking connector can also prepare an import for you.</p><div class="row"><span class="status ' + (configured['SE Ranking'] ? 's-published">Key set on server' : 's-draft">Import') + '</span>' + btn('goto-tab', 'Import rankings', 'Keyword rankings') + '</div></article>' +
      '<article class="panel suite-tile"><span class="int-logo">' + icon('eye', 20) + '</span><h2>AI visibility</h2><p>Track whether ChatGPT, Gemini, Perplexity and Google AI Overviews mention and cite Planet Crust for the prompts that matter. Import results from SE Ranking AI Search, Ubersuggest AI visibility or your own checks.</p><div class="row"><span class="status s-draft">Import</span>' + btn('goto-tab', 'Import results', 'AI visibility') + '</div></article>' +
      '<article class="panel suite-tile"><span class="int-logo">' + chanMono('lm', '#2B3B3C') + '</span><h2>lemlist</h2><p>Send outreach and email sequences. lemlist is a publishing destination: connect it in Integrations through your automation endpoint (n8n, Zapier or Make) that adds leads or steps in lemlist.</p><div class="row">' + btn('connect-lemlist', 'Connect lemlist') + '</div></article>' +
      '</div><p class="help">Live API sync for SE Ranking is not built yet: data comes from imports, kept in this browser.</p>';
  }
  const chanMono = (text, hex) => '<span class="mono-tile" style="background:' + hex + ';width:22px;height:22px;font-size:10px">' + e(text) + '</span>';

  extraPages.SEO = () => tabsHtml('seo-tab', ['AI visibility', 'Keyword rankings', 'Connect'], seoTab) +
    (seoTab === 'AI visibility' ? aiView() : seoTab === 'Keyword rankings' ? rankingsView() : connectView());

  // ---------- Platform guide ----------
  const G = typeof PLATFORM_GUIDE !== 'undefined' ? PLATFORM_GUIDE : { platforms: [], updated: '' };
  const byName = new Map(G.platforms.map(p => [p.name, p]));
  const groupOf = name => (typeof CHANNEL_INDEX !== 'undefined' && CHANNEL_INDEX.get(name)?.cat) || 'Other';
  const v = value => value == null || value === '' ? '<span class="help">Not confirmed</span>' : e(value);
  const table = (heads, body) => body.length ? '<div class="scroll"><table class="suite-table"><thead><tr>' + heads.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + body.join('') + '</tbody></table></div>' : '<p class="help">No confirmed specs for this.</p>';

  function guideDetail(p) {
    if (!p) return '<div class="panel suite-form"><p class="empty">Choose a platform.</p></div>';
    const s = p.specs || {};
    const t = s.text || {};
    return '<section class="panel suite-form guide-detail"><div class="row" style="gap:10px">' + chanBadge(p.name, null, 16) + '<h2 style="margin:0">' + e(p.name) + '</h2></div><p>' + e(p.summary) + '</p>' +
      '<h3>What gets the most reach</h3><ol class="guide-reach">' + (p.reach || []).map(r => '<li><strong>' + e(r.format) + '</strong> · ' + e(r.why) + '<br><small class="help">' + e(r.evidence) + (r.source ? ' · ' + link(r.source, 'Source' + (r.sourceDate ? ' (' + r.sourceDate + ')' : '')) : '') + '</small></li>').join('') + '</ol>' +
      ((p.tips || []).length ? '<h3>Tips</h3><ul>' + p.tips.map(x => '<li>' + e(x) + '</li>').join('') + '</ul>' : '') +
      '<h3>Images</h3>' + table(['Use', 'Size (px)', 'Ratio', 'Max file', 'Formats', 'Note'], (s.images || []).map(i => '<tr><td>' + e(i.use) + '</td><td>' + v(i.size) + '</td><td>' + v(i.ratio) + '</td><td>' + v(i.maxFile) + '</td><td>' + v(i.formats) + '</td><td>' + e(i.note || '') + '</td></tr>')) +
      '<h3>GIF</h3><p>' + (s.gif ? (s.gif.supported ? 'Supported' : 'Not supported') + (s.gif.maxFile ? ' · Max ' + e(s.gif.maxFile) : '') + (s.gif.note ? ' · ' + e(s.gif.note) : '') : '<span class="help">Not confirmed</span>') + '</p>' +
      '<h3>Video</h3>' + table(['Use', 'Ratio', 'Size', 'Length', 'Max file', 'Formats', 'Note'], (s.video || []).map(i => '<tr><td>' + e(i.use) + '</td><td>' + v(i.ratio) + '</td><td>' + v(i.size) + '</td><td>' + v(i.length) + '</td><td>' + v(i.maxFile) + '</td><td>' + v(i.formats) + '</td><td>' + e(i.note || '') + '</td></tr>')) +
      (s.carousel ? '<h3>Carousel</h3><p>Up to ' + v(s.carousel.maxItems) + ' items' + (s.carousel.note ? ' · ' + e(s.carousel.note) : '') + '</p>' : '') +
      '<h3>Text limits</h3>' + table(['Post', 'Comment', 'Title', 'Alt text', 'Note'], ['<tr><td>' + v(t.post) + '</td><td>' + v(t.comment) + '</td><td>' + v(t.title) + '</td><td>' + v(t.altText) + '</td><td>' + e(t.note || '') + '</td></tr>']) +
      '<h3>Hashtags</h3><p>' + v(s.hashtags) + '</p><h3>Links</h3><p>' + v(s.links) + '</p>' +
      '<h3>Sources</h3><ul>' + (p.sources || []).map(src => '<li>' + link(src.url, src.title) + (src.date ? ' <small class="help">' + e(src.date) + '</small>' : '') + '</li>').join('') + '</ul></section>';
  }

  extraPages.Guide = () => {
    const groups = [...new Set(G.platforms.map(p => groupOf(p.name)))];
    const q = guideQuery.toLowerCase();
    const shown = G.platforms.filter(p => (!guideGroup || groupOf(p.name) === guideGroup) && (!q || (p.name + ' ' + p.summary + ' ' + (p.reach || []).map(r => r.format).join(' ')).toLowerCase().includes(q)));
    const first = (list, f) => (list || []).find(f) || (list || [])[0];
    const best = G.platforms.filter(p => (p.reach || []).length && !/no dated reach study/i.test(p.reach[0].evidence || ''));
    return '<div class="suite-tools"><p class="help">Researched ' + e(G.updated) + ' from official platform docs and dated 2025–2026 studies (Buffer, Socialinsider, Metricool and others). Values a source could not confirm say so. Formats and limits change often; check the linked source before a big campaign.</p></div>' +
      '<section class="panel"><div class="toolbar"><h2>Best-performing format by platform</h2></div><div class="scroll"><table class="suite-table"><thead><tr><th>Platform</th><th>Leads reach now</th><th>Evidence</th><th>Source</th></tr></thead><tbody>' +
      best.map(p => '<tr><td><button type="button" class="link-btn" data-ins="guide-pick" data-value="' + e(p.name) + '">' + chanBadge(p.name, null, 11) + ' ' + e(p.name) + '</button></td><td><strong>' + e(p.reach[0].format) + '</strong></td><td><small>' + e(p.reach[0].evidence) + '</small></td><td>' + link(p.reach[0].source, p.reach[0].sourceDate || 'Link') + '</td></tr>').join('') + '</tbody></table></div></section>' +
      '<section class="panel"><div class="toolbar"><h2>Size quick reference</h2><form class="row" data-ins-form="guide-filter"><input name="q" placeholder="Search platforms or formats" value="' + e(guideQuery) + '" aria-label="Search platforms"><select name="group" aria-label="Platform group"><option value="">All groups</option>' + groups.map(g => '<option' + (g === guideGroup ? ' selected' : '') + '>' + e(g) + '</option>').join('') + '</select><button class="secondary">Filter</button></form></div>' +
      '<div class="scroll"><table class="suite-table"><thead><tr><th>Platform</th><th>Feed image</th><th>Vertical / story</th><th>Video</th><th>GIF</th><th>Post text</th></tr></thead><tbody>' +
      shown.map(p => { const s = p.specs || {}; const feed = first(s.images, i => /feed|post|square|portrait|header|email|in-?line|body|content/i.test(i.use)); const tall = (s.images || []).find(i => /story|vertical|9:16|reel|pin/i.test(i.use + ' ' + i.ratio)); const vid = (s.video || [])[0];
        return '<tr' + (p.name === guidePick ? ' class="selected"' : '') + '><td><button type="button" class="link-btn" data-ins="guide-pick" data-value="' + e(p.name) + '">' + chanBadge(p.name, null, 11) + ' ' + e(p.name) + '</button></td><td>' + (feed ? v(feed.size) + (feed.ratio ? ' <small class="help">' + e(feed.ratio) + '</small>' : '') : '–') + '</td><td>' + (tall ? v(tall.size) + (tall.ratio ? ' <small class="help">' + e(tall.ratio) + '</small>' : '') : '–') + '</td><td>' + (vid ? [vid.ratio, vid.length].filter(Boolean).map(e).join(' · ') || v(null) : '–') + '</td><td>' + (s.gif ? (s.gif.supported ? 'Yes' : 'No') : '–') + '</td><td>' + (s.text?.post != null ? e(typeof s.text.post === 'number' ? s.text.post.toLocaleString() + ' chars' : s.text.post) : '–') + '</td></tr>'; }).join('') +
      '</tbody></table></div></section><div id="guide-detail">' + guideDetail(byName.get(guidePick)) + '</div>';
  };

  // ---------- Events ----------
  async function readImport(form) {
    const file = form.querySelector('input[type=file]')?.files?.[0];
    if (file) { if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file under 5 MB.'); return file.text(); }
    return String(new FormData(form).get('text') || '');
  }
  function toCsv(kind) {
    const list = data[kind];
    const cols = kind === 'ai' ? ['prompt', 'engine', 'mentioned', 'position', 'cited', 'competitors', 'date'] : ['keyword', 'position', 'previous', 'volume', 'url', 'engine', 'date'];
    const cell = value => { const text = String(value ?? ''); return /[",\n]|^[=+\-@]/.test(text) ? '"' + text.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""') + '"' : text; };
    return [cols.join(','), ...list.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-ins]');
    if (!target) return;
    const value = target.dataset.value;
    switch (target.dataset.ins) {
      case 'seo-tab': seoTab = value; importing = ''; render(); break;
      case 'goto-tab': seoTab = value; importing = value === 'AI visibility' ? 'ai' : 'rankings'; render(); break;
      case 'import': importing = value; render(); break;
      case 'cancel-import': importing = ''; render(); break;
      case 'example': data[value] = examples[value](); rerender(); say('Example data loaded. Remove it before importing real data.'); break;
      case 'clear-example': data[value] = data[value].filter(r => !r.example); rerender(); break;
      case 'clear': if (confirm('Remove all imported ' + (value === 'ai' ? 'AI visibility results' : 'rankings') + ' from this browser?')) { data[value] = []; rerender(); } break;
      case 'export': {
        const blob = new Blob([toCsv(value)], { type: 'text/csv' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: (value === 'ai' ? 'ai-visibility' : 'keyword-rankings') + '.csv' });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); break;
      }
      case 'connect-lemlist': page = 'Connections'; render(); setTimeout(() => document.querySelector('[data-suite="connect-platform"][data-value="lemlist"]')?.click(), 50); break;
      case 'guide-pick': guidePick = value; render(); requestAnimationFrame(() => document.getElementById('guide-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); break;
    }
  });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-ins-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.insForm;
    if (kind === 'guide-filter') { const f = new FormData(form); guideQuery = String(f.get('q') || ''); guideGroup = String(f.get('group') || ''); render(); return; }
    try {
      const count = importers[kind](await readImport(form));
      importing = '';
      rerender();
      say('Imported ' + count + ' rows.');
    } catch (error) { say(error.message.startsWith('Unexpected') ? 'That JSON could not be read.' : error.message); }
  });
})();
