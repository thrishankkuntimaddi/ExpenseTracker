// ─── Liquid Glass chrome ──────────────────────────────────────────
// Two small pieces that make the glass behave like Apple's:
//
// 1. Floating headers. Each page header is lifted out of the flow and
//    floats over its page, and the page body is padded by the header's
//    height — so content scrolls UNDER the glass (that is where Liquid
//    Glass comes alive). Only when the header is directly followed by the
//    page's scrolling body; any other layout is left exactly as it is.
//    The scroll container never changes (pages that read scrollTop keep
//    working).
//
// 2. Edge refraction. Chromium can bend the backdrop through an SVG lens
//    (#lg-refract in index.html); <html class="lg-refract"> turns it on
//    for the floating bars. Safari / WebKit keep the frosted blur.

const scrolls = (el) => {
  if (!el) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === 'auto' || oy === 'scroll';
};

export function startGlassChrome() {
  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return;
  const html = document.documentElement;

  const brands = navigator.userAgentData?.brands || [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  const reduce = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
  if (chromium && !reduce) html.classList.add('lg-refract');
  // iOS Safari only shows :active (the press on tiles and buttons) when the
  // page listens for touches; a passive no-op listener turns it on.
  document.addEventListener('touchstart', () => {}, { passive: true });
  startPressFeedback();

  const measure = (header) => {
    const root = header.parentElement;
    if (!root) return;
    const mt = parseFloat(getComputedStyle(header).marginTop) || 0;
    root.style.setProperty('--hdr-h', `${Math.round(header.offsetHeight + mt)}px`);
  };
  const ro = new ResizeObserver((entries) => { for (const e of entries) measure(e.target); });
  const seen = new WeakSet();

  const scan = () => {
    for (const header of document.querySelectorAll('.tab-header')) {
      if (seen.has(header)) continue;
      const body = header.nextElementSibling;
      const root = header.parentElement;
      seen.add(header);
      if (!root || !scrolls(body)) continue;     // not a header-over-scroller page: leave it
      root.classList.add('lg-float-root');
      header.classList.add('lg-floating');
      body.classList.add('lg-under');
      measure(header);
      ro.observe(header);
    }
  };

  let queued = false;
  const rootEl = document.getElementById('root') || document.body;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  }).observe(rootEl, { childList: true, subtree: true });
  scan();
}

// ─── Press feedback on touch ──────────────────────────────────────
// A finger has no hover, and a quick tap is over before :active can show,
// so touches get the press from here: the control sinks the moment the
// finger lands (class lg-press), stays down while held, and springs back
// with a slight overshoot when it lifts (lens.css). Tiles that open a page
// wait a beat (~130 ms) so the spring is seen before the page changes.
const PRESSABLE = 'button, a[href], [role="button"], .explore-card, .home-tile, .hist-row, .settings-row-btn, .add-kind, .reminder-tile, .dcard';
const NAV_TILES = '.explore-card, .home-tile, .reminder-tile';
const MIN_DOWN = 110;      // ms a quick tap stays pressed, so it is visible
const NAV_DELAY = 130;     // ms before a tile opens its page

function startPressFeedback() {
  if (typeof window === 'undefined') return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let pressed = null, downAt = 0, lastTouch = 0;

  const release = () => {
    const el = pressed;
    if (!el) return;
    pressed = null;
    const wait = Math.max(0, MIN_DOWN - (performance.now() - downAt));
    setTimeout(() => {
      el.classList.remove('lg-press');
      el.classList.add('lg-release');
      setTimeout(() => el.classList.remove('lg-release'), 520);
    }, wait);
  };

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || reduce) return;          // mouse: hover + :active already
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    lastTouch = performance.now();
    pressed = el; downAt = lastTouch;
    el.classList.remove('lg-release');
    el.classList.add('lg-press');
  }, { passive: true, capture: true });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, release, { passive: true, capture: true });
  // the finger slid off (a scroll began): let go without a tap
  document.addEventListener('scroll', release, { passive: true, capture: true });

  // Tiles that change the page: hold the click for a beat, then replay it
  document.addEventListener('click', (e) => {
    if (reduce || e.lgReplay || performance.now() - lastTouch > 800) return;
    const tile = e.target.closest?.(NAV_TILES);
    if (!tile) return;
    e.preventDefault(); e.stopPropagation();
    setTimeout(() => {
      const again = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      again.lgReplay = true;
      tile.dispatchEvent(again);
    }, NAV_DELAY);
  }, true);
}
