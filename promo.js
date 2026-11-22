'use strict';
// @Human placements inside SMA: sidebar card, Overview spotlight, and contextual tips.
// Copy uses only approved facts (brand/references/voice-and-facts.md and live planetcrust.com pages).
(() => {
  const SITE = 'https://www.planetcrust.com/';
  const link = (path, placement, hash = '') => SITE + path + '?utm_source=sma&utm_medium=app&utm_campaign=human-crosssell&utm_content=' + placement + hash;
  const COPY = {
    badge: 'Governed by design',
    cardTitle: 'Approval gates for your AI.',
    facts: [
      '0 of 296 MCP tools on a live @Human instance can sign an approval gate.',
      'Self-hosted and open source. Your data and models stay with you.',
      'Built for the EU AI Act, ISO/IEC 42001 and GDPR. You get the controls and the evidence.',
      'You can always unplug: @Human runs with AI switched off.',
      'Pay what you can, from €1 per month.',
      'Bring a use case to a 20-minute walkthrough and see it built inside @Human.'
    ],
    walkthrough: 'Book @Human Walkthrough',
    pricing: 'See plans and pricing',
    spotEyebrow: '@Human by Planet Crust',
    spotTitle: 'People sign off your posts. In @Human, people sign off <em>AI work</em> too.',
    spotBody: '@Human is the Sovereign AI Enterprise System. Build compliance-led AI agents, automations and applications with accountable roles, signed approval gates and risk scenarios, on your own servers.',
    chips: ['Ready for EU AI Act · ISO/IEC 42001 · GDPR', 'Open source', 'Self-hosted'],
    stats: [['20 min', 'A walkthrough built around your use case'], ['0 of 296', 'MCP tools on a live instance that can sign a gate'], ['From €1', 'Per month, pay what you can']],
    tips: {
      Approvals: ['Approvals here are advisory. In @Human, AI agents can’t sign an approval gate. People do.', 'Ask how governance works', 'why-human/'],
      Connections: ['Every @Human instance runs its own MCP server, separate from this Claude connection. A live one exposes 296 tools; none can sign a gate.', 'Ask how governance works', 'mcp/'],
      Analytics: ['@Human dashboards add heatmaps, Sankey, sunburst and treemap charts, on your own data.', 'See plans and pricing', 'pricing/']
    }
  };
  const store = {
    get: key => { try { return localStorage.getItem('pc-promo-' + key); } catch { return null; } },
    set: (key, value) => { try { localStorage.setItem('pc-promo-' + key, value); } catch { /* private mode */ } }
  };
  const external = (href, label, cls) => '<a class="' + cls + '" href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';

  /* ---------- Sidebar card with rotating facts ---------- */
  const sidebar = document.querySelector('.sidebar');
  const card = document.createElement('aside');
  card.className = 'human-card';
  card.setAttribute('aria-label', 'About @Human');
  card.innerHTML =
    '<button type="button" class="human-close" aria-label="Hide the @Human card">' + icon('close', 14) + '</button>' +
    '<span class="human-badge"><i aria-hidden="true">' + icon('approvals', 10) + '</i>' + COPY.badge + '</span>' +
    '<strong class="human-title">' + COPY.cardTitle + '</strong>' +
    '<p class="human-fact" aria-live="polite">' + COPY.facts[0] + '</p>' +
    '<span class="human-dots" aria-hidden="true">' + COPY.facts.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</span>' +
    external(link('', 'sidebar-card', '#book-walkthrough'), COPY.walkthrough, 'human-cta') +
    external(link('pricing/', 'sidebar-card'), COPY.pricing, 'human-link');
  const pill = document.createElement('a');
  pill.className = 'human-pill';
  pill.href = link('pricing/', 'sidebar-pill');
  pill.target = '_blank';
  pill.rel = 'noopener';
  pill.innerHTML = '<img src="assets/human-at-icon.png" alt="" width="22" height="22"><span>Discover @Human</span>';
  pill.title = 'Discover @Human by Planet Crust';
  sidebar.insertBefore(card, sidebar.querySelector('.sidebar-bottom'));
  sidebar.insertBefore(pill, sidebar.querySelector('.sidebar-bottom'));
  const setHidden = hidden => { card.hidden = hidden; pill.hidden = !hidden; };
  setHidden(store.get('card') === 'hidden');
  card.querySelector('.human-close').onclick = () => { store.set('card', 'hidden'); setHidden(true); };

  const fact = card.querySelector('.human-fact');
  const dots = [...card.querySelectorAll('.human-dots i')];
  let index = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const rotate = () => {
    if (card.hidden || document.hidden || card.matches(':hover, :focus-within')) return;
    index = (index + 1) % COPY.facts.length;
    const swap = () => { fact.textContent = COPY.facts[index]; dots.forEach((dot, i) => dot.classList.toggle('on', i === index)); fact.classList.remove('out'); };
    if (reduce.matches) return swap();
    fact.classList.add('out');
    setTimeout(swap, 260);
  };
  setInterval(rotate, 7000);
  dots.forEach((dot, i) => { dot.onclick = () => { index = i - 1; rotate(); }; });

  /* ---------- Overview spotlight and contextual tips ---------- */
  function spotlight() {
    return '<section class="panel human-spotlight ov-span-12" aria-labelledby="human-spot-title">' +
      '<div class="spot-copy"><span class="spot-eyebrow">' + COPY.spotEyebrow + '</span><h2 id="human-spot-title">' + COPY.spotTitle + '</h2><p>' + COPY.spotBody + '</p>' +
      '<div class="spot-chips">' + COPY.chips.map(chip => '<span>' + chip + '</span>').join('') + '</div>' +
      '<div class="row">' + external(link('', 'overview-spotlight', '#book-walkthrough'), COPY.walkthrough, 'primary human-primary') + external(link('pricing/', 'overview-spotlight'), COPY.pricing, 'secondary spot-secondary') + '</div></div>' +
      '<div class="spot-stats">' + COPY.stats.map(([value, label]) => '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('') + '</div></section>';
  }
  function tip(name) {
    const entry = COPY.tips[name];
    if (!entry || store.get('tip-' + name) === 'hidden') return null;
    const node = document.createElement('div');
    node.className = 'human-tip';
    node.innerHTML = '<img src="assets/human-at-icon.png" alt="" width="28" height="28"><p>' + entry[0] + '</p>' + external(link(entry[2], 'tip-' + name.toLowerCase()), entry[1], 'human-tip-link') +
      '<button type="button" class="icon-btn" aria-label="Hide this tip">' + icon('close', 14) + '</button>';
    node.querySelector('button').onclick = () => { store.set('tip-' + name, 'hidden'); node.remove(); };
    return node;
  }
  function inject(current) {
    if (current === 'Overview') {
      const grid = view.querySelector('.overview');
      if (grid && !grid.querySelector('.human-spotlight')) grid.insertAdjacentHTML('beforeend', spotlight());
    }
    const node = tip(current);
    if (node && !view.querySelector('.human-tip')) view.prepend(node);
  }
  window.addEventListener('sma:render', event => inject(event.detail.page));
  inject(page);
})();
