'use strict';
// Motion, navigation chrome, and direct-manipulation features for the Publishing Studio.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const shell = document.querySelector('#shell');
  const nav = document.querySelector('#nav');
  const top = document.querySelector('.top');
  const scrim = document.querySelector('#scrim');
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ---------- Page transitions + deep links ---------- */
  let lastPage = null;
  const baseRender = render;
  // eslint-disable-next-line no-global-assign
  render = function () {
    const changed = page !== lastPage;
    const result = baseRender.apply(this, arguments);
    window.dispatchEvent(new CustomEvent('sma:render', { detail: { page, changed } }));
    if (changed) {
      lastPage = page;
      if (location.hash.slice(1) !== page && !location.hash.startsWith('#post=')) history.replaceState(null, '', '#' + page);
      enter(view);
      if (document.activeElement?.closest?.('#nav')) view.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    }
    return result;
  };
  function enter(root) {
    if (reduce.matches) return;
    const blocks = [...root.children].flatMap(child => child.classList.contains('overview') || child.classList.contains('stat-grid') || child.classList.contains('tile-grid') || child.classList.contains('approval-board') ? [...child.children] : [child]);
    blocks.slice(0, 14).forEach((node, index) => {
      if (node.classList.contains('rise')) return;
      node.style.setProperty('--i', index);
      node.classList.add('rise');
      node.addEventListener('animationend', () => node.classList.remove('rise'), { once: true });
    });
    countUp(root);
  }
  function countUp(root) {
    root.querySelectorAll('[data-count]').forEach(node => {
      const target = Number(node.dataset.count);
      if (!Number.isFinite(target) || node.dataset.count === '' || reduce.matches) return;
      const decimals = Number.isInteger(target) ? 0 : 1;
      const start = performance.now();
      const step = now => {
        const t = Math.min(1, (now - start) / 750);
        node.textContent = (target * ease(t)).toLocaleString([], { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Sidebar: sliding active pill, collapse, mobile drawer ---------- */
  function placePill(instant) {
    const pill = nav.querySelector('.nav-pill');
    const active = nav.querySelector('button.active');
    if (!pill) return;
    if (!active) { pill.style.opacity = 0; return; }
    if (instant) pill.style.transition = 'none';
    pill.style.opacity = 1;
    pill.style.height = active.offsetHeight + 'px';
    pill.style.transform = 'translateY(' + active.offsetTop + 'px)';
    if (instant) { pill.getBoundingClientRect(); pill.style.transition = ''; }
  }
  let previousPill = null;
  window.addEventListener('sma:nav', () => {
    const pill = nav.querySelector('.nav-pill');
    if (pill && previousPill) { pill.style.transition = 'none'; pill.style.height = previousPill.h; pill.style.transform = previousPill.t; pill.getBoundingClientRect(); pill.style.transition = ''; }
    requestAnimationFrame(() => {
      placePill(!previousPill);
      if (pill) previousPill = { h: pill.style.height, t: pill.style.transform };
    });
  });
  window.addEventListener('resize', () => placePill(true));

  // One toggle: collapses the sidebar on desktop, opens it as a drawer on small screens.
  const toggle = document.querySelector('#menu');
  const small = matchMedia('(max-width: 900px)');
  const setCollapsed = value => {
    shell.classList.toggle('collapsed', value);
    toggle.setAttribute('aria-expanded', String(!value));
    toggle.setAttribute('aria-label', value ? 'Expand sidebar' : 'Collapse sidebar');
    try { localStorage.setItem('pc-sidebar-collapsed', value ? '1' : '0'); } catch { /* private mode */ }
    setTimeout(() => placePill(true), 380);
  };
  try { if (localStorage.getItem('pc-sidebar-collapsed') === '1') setCollapsed(true); } catch { /* ignore */ }
  const setNavOpen = open => {
    shell.classList.toggle('nav-open', open);
    scrim.hidden = !open;
    if (small.matches) toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => small.matches ? setNavOpen(!shell.classList.contains('nav-open')) : setCollapsed(!shell.classList.contains('collapsed'));
  small.addEventListener('change', () => { setNavOpen(false); toggle.setAttribute('aria-label', small.matches ? 'Open navigation' : shell.classList.contains('collapsed') ? 'Expand sidebar' : 'Collapse sidebar'); });
  scrim.onclick = () => setNavOpen(false);
  nav.addEventListener('click', () => setNavOpen(false));
  document.querySelector('#home-link').onclick = event => { event.preventDefault(); page = 'Overview'; render(); };
  window.addEventListener('scroll', () => top.classList.toggle('scrolled', window.scrollY > 4), { passive: true });

  /* ---------- One-line animated brand: "SMA · Social Media Automation" ⇄ "by Planet Crust | @human" ---------- */
  const brand = document.querySelector('#home-link');
  let brandTimer = null;
  function playBrand(cycles = 3) {
    clearInterval(brandTimer);
    if (reduce.matches || shell.classList.contains('collapsed')) { brand.classList.remove('alt'); return; }
    let flips = cycles * 2;
    brandTimer = setInterval(() => {
      brand.classList.toggle('alt');
      if (--flips <= 0) { clearInterval(brandTimer); brand.classList.remove('alt'); }
    }, 3200);
  }
  playBrand();
  brand.addEventListener('mouseenter', () => { brand.classList.add('alt'); playBrand(1); });
  brand.addEventListener('focus', () => { brand.classList.add('alt'); playBrand(1); });

  /* ---------- Header actions ---------- */
  document.querySelector('#notification-drawer').onclick = () => suite?.openNotifications();
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.querySelector('#global-search').click();
    }
    if (event.key === 'Escape') { closeMenu(); setNavOpen(false); }
  });
  view.addEventListener('click', event => {
    const goto = event.target.closest('[data-goto]');
    if (goto) { event.stopPropagation(); page = goto.dataset.goto; render(); }
  }, true);

  /* ---------- Animated dialogs ---------- */
  for (const dialog of [editor, document.querySelector('#workspace-dialog')]) {
    const nativeClose = dialog.close.bind(dialog);
    let timer = null;
    const finish = () => { clearTimeout(timer); timer = null; dialog.classList.remove('closing'); };
    new MutationObserver(() => { if (timer) finish(); }).observe(dialog, { childList: true });
    dialog.close = function (value) {
      if (!dialog.open || reduce.matches) return nativeClose(value);
      if (timer) return;
      dialog.classList.add('closing');
      timer = setTimeout(() => { const wasClosing = timer; finish(); if (wasClosing) nativeClose(value); }, dialog.classList.contains('drawer') ? 200 : 160);
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    // Backdrop click closes side panels only; the editor keeps unsaved work open.
    if (dialog !== editor) dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }

  /* ---------- Context menu for posts ---------- */
  let menu = null;
  const findItem = id => allItems().find(item => item.id === id);
  function closeMenu() { menu?.remove(); menu = null; }
  function openMenu(id, x, y, returnFocus) {
    closeMenu();
    const item = findItem(id);
    if (!item) return;
    const remote = item.remote;
    const social = item.channel !== 'WordPress';
    const entries = [
      ['open', 'Open', 'edit', true],
      ['preview', 'Preview', 'eye', true],
      '-',
      ['review', 'Request approval', 'approvals', item.review !== 'Pending'],
      ['approve', 'Approve myself', 'done', !/^(You|Niall)/.test(item.review || '')],
      '-',
      ['publish', 'Publish now', 'send', social && remote && remote.allowedActions?.publishNow],
      ['unschedule', 'Unschedule', 'clock', remote ? remote.allowedActions?.cancel && remote.status === 'scheduled' : item.status === 'Scheduled'],
      ['duplicate', 'Duplicate as draft', 'copy', true],
      ['archive', 'Archive', 'archive', !/^(Scheduled|Publishing)/.test(item.status), 'danger-item']
    ];
    menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Actions for ' + item.title);
    menu.innerHTML = '<div class="ctx-label">' + esc(item.channel) + ' post</div>' + entries.filter(entry => entry === '-' || entry[3]).map(entry => entry === '-' ? '<hr>' : '<button type="button" role="menuitem" data-ctx="' + entry[0] + '" class="' + (entry[4] || '') + '">' + icon(entry[2], 16) + entry[1] + '</button>').join('').replace(/(<hr>)+/g, '<hr>').replace(/<hr>$/, '');
    document.body.append(menu);
    menuScroll = window.scrollY;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - rect.height - 8)) + 'px';
    menu.querySelector('button')?.focus();
    menu.addEventListener('keydown', event => {
      const buttons = [...menu.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length].focus(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length].focus(); }
      if (event.key === 'Tab') closeMenu();
      if (event.key === 'Escape') { closeMenu(); returnFocus?.focus(); }
    });
    menu.addEventListener('click', async event => {
      const action = event.target.closest('[data-ctx]')?.dataset.ctx;
      if (!action) return;
      closeMenu();
      const current = findItem(id);
      if (!current) return;
      if (action === 'open') return openItem(current);
      if (action === 'preview') { mobile = false; return openItem(current); }
      if (action === 'duplicate') return suite.duplicate(current);
      await suite.run(action, [current]);
    });
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-menu]');
    if (trigger) {
      event.preventDefault(); event.stopPropagation();
      const rect = trigger.getBoundingClientRect();
      return openMenu(trigger.dataset.menu, rect.right - 220, rect.bottom + 6, trigger);
    }
    if (menu && !event.target.closest('.ctx-menu')) closeMenu();
  }, true);
  view.addEventListener('contextmenu', event => {
    const card = event.target.closest('[data-item]');
    if (!card) return;
    event.preventDefault();
    openMenu(card.dataset.item, event.clientX, event.clientY, card.querySelector('button'));
  });
  let menuScroll = 0;
  window.addEventListener('scroll', () => { if (menu && Math.abs(window.scrollY - menuScroll) > 40) closeMenu(); }, { passive: true });
  window.addEventListener('resize', closeMenu);

  /* ---------- Drag a post to another day to reschedule ---------- */
  let dragged = null;
  view.addEventListener('dragstart', event => {
    const card = event.target.closest('.calendar-item[draggable=true]');
    if (!card) return;
    dragged = card.dataset.item;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragged);
  });
  view.addEventListener('dragend', event => {
    event.target.closest?.('.calendar-item')?.classList.remove('dragging');
    view.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target'));
    dragged = null;
  });
  view.addEventListener('dragover', event => {
    const day = event.target.closest('[data-drop]');
    if (!day || !dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!day.classList.contains('drop-target')) {
      view.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target'));
      day.classList.add('drop-target');
    }
  });
  view.addEventListener('drop', async event => {
    const day = event.target.closest('[data-drop]');
    if (!day || !dragged) return;
    event.preventDefault();
    const item = findItem(dragged);
    day.classList.remove('drop-target');
    if (!item || item.date.slice(0, 10) === day.dataset.drop) return;
    const local = day.dataset.drop + 'T' + (item.date.slice(11, 16) || '09:00');
    if (Date.parse(local) < Date.now()) return show('Choose a day that has not passed yet.');
    try {
      if (item.remote) {
        await queueClient.reschedule(item, local);
        show('Rescheduled to ' + printDate(local) + '.');
      } else {
        const original = state.items.find(candidate => candidate.id === item.id);
        if (!original) return;
        original.date = local;
        record(original, 'Moved to ' + printDate(local));
        persist();
        render();
        show('Moved to ' + printDate(local) + '. Open it and choose Schedule to queue it.');
      }
    } catch (error) { show(error.message); }
  });

  /* ---------- Chart hover tooltips (mouse, touch, keyboard) ---------- */
  function chartState(wrap) {
    if (!wrap._chart) wrap._chart = JSON.parse(wrap.dataset.chart);
    return wrap._chart;
  }
  function showPoint(wrap, index) {
    const chart = chartState(wrap);
    const { W, H, L, R, T, B, max } = chart.geometry;
    const n = chart.labels.length;
    index = Math.max(0, Math.min(n - 1, index));
    wrap._index = index;
    const x = n === 1 ? L + (W - L - R) / 2 : L + index * (W - L - R) / (n - 1);
    const svg = wrap.querySelector('svg');
    const cross = svg.querySelector('.cross');
    cross.setAttribute('x1', x); cross.setAttribute('x2', x);
    let topY = H;
    svg.querySelectorAll('.hot').forEach((dot, i) => {
      const y = T + (1 - chart.series[i].values[index] / max) * (H - T - B);
      topY = Math.min(topY, y);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    });
    const tip = wrap.querySelector('.chart-tip');
    tip.innerHTML = '<span>' + esc(chart.labels[index]) + '</span>' + chart.series.map(line => '<strong style="color:' + (chart.series.length > 1 ? line.colour : 'var(--ink)') + '">' + Number(line.values[index].toFixed(1)).toLocaleString() + chart.unit + (chart.series.length > 1 ? ' <small style="font-weight:500;color:var(--muted)">' + esc(line.name) + '</small>' : '') + '</strong>').join('');
    const box = svg.getBoundingClientRect();
    const scale = box.width / W;
    tip.style.left = Math.max(70, Math.min(box.width - 70, x * scale)) + 16 + 'px';
    tip.style.top = topY * scale + 8 + 'px';
    wrap.classList.add('hover');
  }
  view.addEventListener('pointermove', event => {
    const wrap = event.target.closest('.chart-wrap');
    if (!wrap) return;
    const chart = chartState(wrap);
    const box = wrap.querySelector('svg').getBoundingClientRect();
    const { W, L, R } = chart.geometry;
    const x = (event.clientX - box.left) / box.width * W;
    showPoint(wrap, Math.round((x - L) / ((W - L - R) / Math.max(1, chart.labels.length - 1))));
  });
  view.addEventListener('pointerleave', event => {
    if (event.target.closest?.('.chart-wrap')) event.target.closest('.chart-wrap').classList.remove('hover');
  }, true);
  view.addEventListener('pointerout', event => {
    const wrap = event.target.closest?.('.chart-wrap');
    if (wrap && !wrap.contains(event.relatedTarget)) wrap.classList.remove('hover');
  });
  view.addEventListener('keydown', event => {
    const wrap = event.target.closest?.('.chart-wrap');
    if (!wrap || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const n = chartState(wrap).labels.length;
    const current = wrap._index ?? n - 1;
    showPoint(wrap, event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  new MutationObserver(() => {
    view.querySelectorAll('.chart-wrap:not([tabindex])').forEach(wrap => {
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', 'Chart. Use the left and right arrow keys to read each point.');
    });
  }).observe(view, { childList: true, subtree: true });

  /* ---------- Initial paint ---------- */
  hydrateIcons();
  render();
})();
