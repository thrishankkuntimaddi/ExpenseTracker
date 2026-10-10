// Debug-only self-test (EXPENSETRACKER_SELFTEST=1, or =signup against the
// local Firebase emulators): runs inside the app's web view, exercises the
// desktop bridge and the app, and reports what actually happened.
(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await wait(250); } return null; };
  const type = (el, value) => { // set a React-controlled input
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const r = {};
  const step = async (name, fn) => { try { r[name] = await fn(); } catch (e) { r[name] = 'ERROR ' + (e?.message || e); } };

  await step('app_version', () => invoke('app_version'));
  await step('page_loaded', () => !!document.querySelector('#auth-email, #tab-today, nav, header, [style*="position: sticky"]'));
  await step('theme', () => document.documentElement.getAttribute('data-theme'));
  await step('service_workers', async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 'n/a');
  await step('google_button', () => (document.querySelector('#btn-google') ? 'shown' : document.querySelector('#google-unavailable') ? 'hidden with note' : 'n/a'));
  await step('location', () => location.href);

  if (window.__ET_SELFTEST_SIGNUP) {
    await step('signup', async () => {
      document.querySelector('#auth-tab-signup').click(); await wait(300);
      const pw = 'Selftest-' + Math.random().toString(36).slice(2, 10);
      type(document.querySelector('#auth-email'), `desktop${Date.now()}@example.test`);
      type(document.querySelector('#auth-password'), pw); type(document.querySelector('#auth-confirm'), pw);
      document.querySelector('#btn-auth-submit').click();
      return !!(await until(() => !document.querySelector('#auth-email')));   // signed in = the sign-in form is gone
    });
    await step('settings_text', async () => {
      const btn = await until(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings'));
      btn?.click();
      const txt = await until(() => { const t = document.body.innerText; return /Desktop app ·/.test(t) && /this device/.test(t) ? t : null; });
      return txt ? { shell: txt.match(/Desktop app · [^\n]*/)?.[0], device: txt.match(/[^\n]*· this device/)?.[0] } : document.body.innerText.slice(0, 200);
    });
    await step('sync', async () => (await until(() => document.querySelector('#sync-status')?.dataset.tone === 'ok' ? 'ok' : null)) ?? document.querySelector('#sync-status')?.dataset.tone);
  }
  await invoke('selftest_report', { report: JSON.stringify(r) });
})();
