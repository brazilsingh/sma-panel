'use strict';
// Hosted SMA panel: runs before the workspace scripts. It signs people in through @Human and
// answers the workspace's /api/* calls in the browser from @Human records (see api.mjs),
// so the screens work unchanged without the SMA server.
(function () {
  const cfg = window.SMA_HUMAN;
  const KEY = 'sma-human-session';
  const nativeFetch = window.fetch.bind(window);
  const page = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';

  const session = {
    read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
    write(value) { try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch {} },
    async token() {
      let s = session.read();
      if (s?.access && s.expiresAt > Date.now() + 60000) return s.access;
      if (s?.refresh) {
        s = await refresh(s.refresh).catch(() => null);
        if (s) return s.access;
      }
      session.write(null);
      signIn();
      return new Promise(() => {}); // the page is leaving for the @Human sign-in
    },
    signOut() {
      session.write(null);
      try { sessionStorage.setItem('sma-signed-out', '1'); } catch {}
      location.replace(cfg.baseUrl + '/auth/logout?back=' + encodeURIComponent(location.origin + '/'));
    }
  };

  async function refresh(token) {
    const response = await nativeFetch(cfg.baseUrl + '/auth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(cfg.clientId + ':' + cfg.clientSecret) },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(token)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error('refresh refused');
    const next = { access: data.access_token, refresh: data.refresh_token || token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    session.write(next);
    return next;
  }

  const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function signIn() {
    let signedOut = false;
    try { signedOut = sessionStorage.getItem('sma-signed-out') === '1'; } catch {}
    if (signedOut) return showSignedOut();
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    try { sessionStorage.setItem('sma-oauth', JSON.stringify({ state, verifier, back: location.pathname + location.search + location.hash })); } catch {}
    const params = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: location.origin + '/auth.html', scope: 'profile api', state, code_challenge: challenge, code_challenge_method: 'S256' });
    location.replace(cfg.baseUrl + '/auth/oauth2/authorize?' + params);
  }

  function showSignedOut() {
    const draw = () => {
      document.body.innerHTML = '<main style="max-width:420px;margin:15vh auto;padding:0 16px;font-family:Poppins,system-ui,sans-serif;text-align:center">' +
        '<h1 style="font-size:22px">You are signed out of SMA</h1><p style="color:#5f6b66">Sign in with your @Human account to open the workspace.</p>' +
        '<button id="sma-signin" style="background:#c8553d;color:#fff;border:0;border-radius:999px;padding:10px 22px;font:inherit;cursor:pointer">Sign in with @Human</button></main>';
      document.getElementById('sma-signin').onclick = () => { try { sessionStorage.removeItem('sma-signed-out'); } catch {} signIn(); };
    };
    document.body ? draw() : document.addEventListener('DOMContentLoaded', draw);
  }

  let api = null;
  const loadApi = () => (api ||= import('/human/api.mjs').then(module => module.connect({ config: cfg, session, fetch: nativeFetch })));

  // The workspace calls same-origin /api/* routes; answer them here.
  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    const handler = await loadApi();
    return handler(url, { method: (init.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase(), headers: new Headers(init.headers || {}), body: init.body });
  };
  window.SMA_SESSION = session;

  // Owners use the workspace; reviewers land on the review page.
  loadApi().then(handler => handler.me()).then(me => {
    if (!me.role) {
      const draw = () => { document.body.innerHTML = '<main style="max-width:480px;margin:15vh auto;padding:0 16px;font-family:Poppins,system-ui,sans-serif;text-align:center"><h1 style="font-size:22px">No access to SMA yet</h1><p style="color:#5f6b66">You are signed in to @Human as ' + String(me.name || me.email || 'this user').replace(/[<>&"]/g, '') + ', but this account is not in the SMA owners or SMA reviewers group. Ask the workspace owner to add you.</p><button id="sma-out" style="border:1px solid #ccd5d1;background:#fff;border-radius:999px;padding:8px 18px;font:inherit;cursor:pointer">Sign out</button></main>'; document.getElementById('sma-out').onclick = () => session.signOut(); };
      document.body ? draw() : document.addEventListener('DOMContentLoaded', draw);
    } else if (me.role === 'reviewer' && page === '/') location.replace('/review');
  }).catch(() => {});
})();
