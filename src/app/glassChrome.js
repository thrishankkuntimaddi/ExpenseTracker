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
