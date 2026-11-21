// ─── Look: Glass · Unslop · Unsloped ─────────────────────────────
// One switch (Profile → Appearance → Look) with three answers:
//   glass     the Liquid Glass UI as shipped (default)
//   unslop    the household hisaab notebook: paper-warm neutrals, blue-ink
//             accent, ledger figures with the double rule under totals
//             (styles/unslop.css)
//   unsloped  the same book taken further: the month card is the red
//             cloth cover of a bahi-khata stamped in gold, every list a
//             ledger page with the red margin rule (styles/unsloped.css,
//             on top of unslop.css)
// Built with the unslop method by Damir Sokolovsky
// (github.com/heydamir/unslop, CC BY 4.0).
//
// Layers, not rewrites: <html data-unslop="on"> turns on unslop.css, and
// <html data-unsloped> adds unsloped.css. With the look on Glass neither
// attribute exists and not one of those rules applies — the Liquid Glass
// UI is exactly as it was. Per device (like the theme). index.html applies
// it before first paint, so there's no flash.
import { useSyncExternalStore } from 'react';

export const UNSLOP_KEY = 'et_unslop';   // 'on' = unslop · 'unsloped' · anything else = glass
const EVENT = 'et-unslop';
export const LOOKS = ['glass', 'unslop', 'unsloped'];

/* Colour behind the browser bar / Android system bars, per look and theme.
   Each matches that look's canvas. */
const BARS = {
  glass:    { light: '#EEF0F6', monoflow: '#06070B' },
  plain:    { light: '#FFFFFF', monoflow: '#000000' },   // Glass with its background colour off
  unslop:   { light: '#F7F5F0', monoflow: '#161513' },
  unsloped: { light: '#F2ECE0', monoflow: '#13110E' },
};

/** The look for this device: 'glass' | 'unslop' | 'unsloped'. */
export function getLook() {
  try {
    const v = localStorage.getItem(UNSLOP_KEY);
    return v === 'on' ? 'unslop' : v === 'unsloped' ? 'unsloped' : 'glass';
  } catch { return 'glass'; }
}

/** Is a non-glass look on (Unslop or Unsloped)? Both build on unslop.css. */
export const unslopOn = () => getLook() !== 'glass';

const asLook = (v) => (v === true ? 'unslop' : v === false ? 'glass' : LOOKS.includes(v) ? v : 'glass');

/* Glass's background colour (Profile → Appearance → Background colour):
   on = the soft colour field behind the glass (as shipped); off = pure white
   (light) or pure black (dark), like macOS Control Center. Only Glass has it. */
export const GLASS_COLOUR_KEY = 'et_glass_colour';   // 'off' | anything else = on
export function glassColourOn() {
  try { return localStorage.getItem(GLASS_COLOUR_KEY) !== 'off'; } catch { return true; }
}

/** System-bar colour for a theme ('light' | 'monoflow') in a look. */
export function barColor(theme, look = getLook(), colour = glassColourOn()) {
  look = asLook(look);
  const set = BARS[look === 'glass' && !colour ? 'plain' : look];
  return set[theme] ?? set.light;
}

/* The notebook type: Instrument Sans for the interface, Newsreader for the
   big figures and page titles. Loaded only once a notebook look is on, so
   Glass never downloads them; offline, the system font stands in. */
export const UNSLOP_FONTS = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap';
function loadFonts() {
  if (document.getElementById('us-fonts') || !document.head) return;
  const link = document.createElement('link');
  link.id = 'us-fonts'; link.rel = 'stylesheet'; link.href = UNSLOP_FONTS;
  document.head.appendChild(link);
}

let fadeTimer = null;
/** Put a look on <html> (and the browser bar). Safe to call any time. */
export function applyLook(look = getLook()) {
  if (typeof document === 'undefined') return;
  look = asLook(look);
  const html = document.documentElement;
  const was = html.getAttribute('data-unsloped') !== null ? 'unsloped' : html.getAttribute('data-unslop') === 'on' ? 'unslop' : 'glass';
  if (was !== look && html.hasAttribute('data-theme')) {
    // the same short colour fade the theme switch uses (index.css)
    html.classList.add('theme-switching');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => html.classList.remove('theme-switching'), 320);
  }
  if (look === 'glass') html.removeAttribute('data-unslop');
  else { html.setAttribute('data-unslop', 'on'); loadFonts(); }
  if (look === 'unsloped') html.setAttribute('data-unsloped', ''); else html.removeAttribute('data-unsloped');
  if (glassColourOn()) html.removeAttribute('data-glass-plain'); else html.setAttribute('data-glass-plain', '');
  const theme = html.getAttribute('data-theme') || 'light';
  const color = barColor(theme, look);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  if (document.body) document.body.style.backgroundColor = color;
}
/** Older name: true = Unslop, false = Glass, nothing = whatever is saved. */
export const applyUnslop = (on) => applyLook(on === undefined ? getLook() : asLook(on));

/** Choose the look for this device. */
export function setLook(look) {
  look = asLook(look);
  try {
    if (look === 'glass') localStorage.removeItem(UNSLOP_KEY);
    else localStorage.setItem(UNSLOP_KEY, look === 'unslop' ? 'on' : 'unsloped');
  } catch { /* storage unavailable */ }
  applyLook(look);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}
/** Glass's background colour on or off, for this device. */
export function setGlassColour(on) {
  try { if (on) localStorage.removeItem(GLASS_COLOUR_KEY); else localStorage.setItem(GLASS_COLOUR_KEY, 'off'); } catch { /* storage unavailable */ }
  applyLook();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** Older name: on = Unslop, off = Glass. */
export const setUnslop = (on) => setLook(on ? 'unslop' : 'glass');

function subscribe(cb) {
  if (typeof window === 'undefined') return () => {};
  // another window of the app changed it: follow
  const onStorage = (e) => { if (e.key === UNSLOP_KEY || e.key === GLASS_COLOUR_KEY) { applyLook(); cb(); } };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage); };
}

/** React: the current look; re-renders when it's switched. */
export const useLook = () => useSyncExternalStore(subscribe, getLook, () => 'glass');
/** React: true while a notebook look (Unslop or Unsloped) is on. */
export const useUnslop = () => useSyncExternalStore(subscribe, unslopOn, () => false);
/** React: true while Glass shows its background colour. */
export const useGlassColour = () => useSyncExternalStore(subscribe, glassColourOn, () => true);
