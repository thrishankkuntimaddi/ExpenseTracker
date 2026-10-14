// ─── G · Living card ─────────────────────────────────────────────
// The card leans toward the pointer (desktop) or with how the phone is
// held (Android), and a soft light glides across it. Writes CSS variables
// on the element — --tilt-x / --tilt-y (deg) and --glare-x / --glare-y (%) —
// which motion.css turns into the tilt and the glare. Off with animations off.
import { useEffect } from 'react';
import { useMotion } from './motion';

export function useTilt(ref, { max = 7 } = {}) {
  const on = useMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return undefined;
    el.classList.add('tilt-live');
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const step = () => {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      el.style.setProperty('--tilt-x', `${(cx * max).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(-cy * max).toFixed(2)}deg`);
      el.style.setProperty('--glare-x', `${(50 + cx * 45).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${(50 + cy * 45).toFixed(1)}%`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const aim = (x, y) => { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); if (!raf) raf = requestAnimationFrame(step); };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      aim(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const leave = () => aim(0, 0);
    // Phones: the way it's held (no permission needed on Android; iOS stays still)
    let base = null;
    const orient = (e) => {
      if (e.beta == null || e.gamma == null || document.hidden) return;
      base ??= { b: e.beta, g: e.gamma };
      // slowly re-centre, so a new way of holding the phone becomes "level"
      base.b += (e.beta - base.b) * 0.02; base.g += (e.gamma - base.g) * 0.02;
      aim((e.gamma - base.g) / 20, (e.beta - base.b) / 20);
    };
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    if (coarse) window.addEventListener('deviceorientation', orient);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('deviceorientation', orient);
      el.classList.remove('tilt-live');
      ['--tilt-x', '--tilt-y', '--glare-x', '--glare-y'].forEach((p) => el.style.removeProperty(p));
    };
  }, [ref, on, max]);
}
