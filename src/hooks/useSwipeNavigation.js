// ─── useSwipeNavigation ──────────────────────────────────────────
// Horizontal swipe between pages on touch devices. Returns touch handlers
// to spread on the page container.
//
// A swipe is ignored when it starts
//   • near the screen edges (the OS back/forward gesture lives there),
//   • inside anything that scrolls horizontally (chip rows, wide charts),
//   • inside a dialog (position: fixed) or an element marked data-no-swipe,
// and only counts when it is clearly horizontal, long enough and quick.
import { useRef, useCallback } from 'react';

const EDGE_PX = 24;
const MIN_DX  = 56;
const MAX_MS  = 700;

function shouldIgnore(target, root) {
  // Dialogs render into <body> via a portal; React still bubbles their
  // touches here, but they are not part of the page.
  if (!root.contains(target)) return true;
  if (target?.closest?.('[data-no-swipe]')) return true;
  for (let n = target; n && n !== root; n = n.parentElement) {
    if (n.tagName === 'INPUT' && n.type === 'range') return true;
    const cs = getComputedStyle(n);
    if (cs.position === 'fixed') return true;
    const ox = cs.overflowX;
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

export function useSwipeNavigation({ order, active, onChange, enabled = true }) {
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    start.current = null;
    if (!enabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX) return;
    if (shouldIgnore(e.target, e.currentTarget)) return;
    start.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, [enabled]);

  const onTouchEnd = useCallback((e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Date.now() - s.at > MAX_MS) return;
    if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = order.indexOf(active);
    if (i === -1) return;
    const next = dx < 0 ? i + 1 : i - 1;
    if (next < 0 || next >= order.length) return;
    onChange(order[next], dx < 0 ? 'left' : 'right');
  }, [order, active, onChange]);

  const onTouchCancel = useCallback(() => { start.current = null; }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
