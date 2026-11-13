import { useLayoutEffect, useRef } from 'react';

/**
 * The Liquid Glass lens that slides behind the active tab of the phone
 * dock. Placed with transform only (GPU-composited, no layout per frame),
 * written straight to the DOM so a tab change never re-renders the bar.
 * Hidden when the open page has no tab (Profile, a sub-page).
 */
export default function DockPill({ active }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const pill = ref.current;
    const bar = pill?.parentElement;
    if (!bar) return undefined;
    const place = () => {
      const btn = bar.querySelector(`#tab-${active}`);
      if (!btn) { pill.style.opacity = '0'; return; }
      pill.style.width = `${btn.offsetWidth}px`;
      pill.style.height = `${btn.offsetHeight}px`;
      pill.style.transform = `translate3d(${btn.offsetLeft}px, ${btn.offsetTop}px, 0)`;
      pill.style.opacity = '1';
    };
    place();
    // first placement snaps; later tab changes glide
    const raf = requestAnimationFrame(() => pill.classList.add('ready'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(bar);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [active]);

  return <span ref={ref} className="dock-pill" aria-hidden="true" />;
}
