// ─── useEscape ───────────────────────────────────────────────────
// Esc (and the Android back button, which sends Esc — see native/) closes
// the TOP overlay only: overlays register on a stack, newest first.
import { useEffect, useRef } from 'react';

const stack = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !stack.length) return;
    e.stopImmediatePropagation();
    stack[stack.length - 1].current?.();
  });
}

/** Is any overlay open? (The back button uses this before navigating.) */
export const overlayOpen = () => stack.length > 0;

export function useEscape(onClose, active = true) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active) return undefined;
    stack.push(ref);
    return () => { const i = stack.lastIndexOf(ref); if (i !== -1) stack.splice(i, 1); };
  }, [active]);
}
