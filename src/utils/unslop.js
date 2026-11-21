// ─── Unslop ──────────────────────────────────────────────────────
// One switch (Profile → Appearance → Unslop) that trades the Liquid Glass
// look for a quiet, solid one: a plain canvas instead of the colour-blob
// wallpaper, solid cards with hairline edges instead of bevelled glass,
// one ink accent, sentence-case labels, grouped lists, no overshoot.
//
// It is a layer, not a rewrite: <html data-unslop="on"> turns on
// styles/unslop.css, and with the switch off nothing of it applies — the
// Liquid Glass UI is exactly as it was. Per device (like the theme), off by
// default. index.html applies it before first paint, so there's no flash.
import { useSyncExternalStore } from 'react';

export const UNSLOP_KEY = 'et_unslop';   // 'on' | anything else = off
const EVENT = 'et-unslop';

/* Colour behind the browser bar / Android system bars, per look and theme.
   Glass matches glass.css --lg-wall-base; Unslop matches unslop.css --us-canvas. */
const BARS = {
  glass:  { light: '#EEF0F6', monoflow: '#06070B' },
  unslop: { light: '#F4F4F2', monoflow: '#0C0C0D' },
};

/** Is the Unslop look switched on for this device? */
export function unslopOn() {
  try { return localStorage.getItem(UNSLOP_KEY) === 'on'; } catch { return false; }
}

/** System-bar colour for a theme ('light' | 'monoflow') in the current look. */
export function barColor(theme, on = unslopOn()) {
  const set = on ? BARS.unslop : BARS.glass;
  return set[theme] ?? set.light;
}

let fadeTimer = null;
/** Put the look on <html> (and the browser bar). Safe to call any time. */
export function applyUnslop(on = unslopOn()) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const was = html.getAttribute('data-unslop') === 'on';
  if (was !== on && html.hasAttribute('data-theme')) {
    // the same short colour fade the theme switch uses (index.css)
    html.classList.add('theme-switching');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => html.classList.remove('theme-switching'), 320);
  }
  if (on) html.setAttribute('data-unslop', 'on'); else html.removeAttribute('data-unslop');
  const theme = html.getAttribute('data-theme') || 'light';
  const color = barColor(theme, on);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  if (document.body) document.body.style.backgroundColor = color;
}

/** Switch it on or off for this device. */
export function setUnslop(on) {
  try { if (on) localStorage.setItem(UNSLOP_KEY, 'on'); else localStorage.removeItem(UNSLOP_KEY); } catch { /* storage unavailable */ }
  applyUnslop(!!on);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb) {
  if (typeof window === 'undefined') return () => {};
  // another window of the app changed it: follow
  const onStorage = (e) => { if (e.key === UNSLOP_KEY) { applyUnslop(); cb(); } };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage); };
}

/** React: true while Unslop is on; re-renders when it's switched. */
export const useUnslop = () => useSyncExternalStore(subscribe, unslopOn, () => false);
