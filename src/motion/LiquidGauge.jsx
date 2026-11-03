// ─── C · Liquid budget ───────────────────────────────────────────
// How much of the budget is used, as liquid in glass: it rises to the
// level with a little spring, sloshes when the level changes, and goes
// green → amber → red as it nears the limit.
//   variant 'capsule'  a tall glass capsule (Budget page)
//   variant 'bar'      a slim horizontal tube (the Home month card)
// The canvas only animates while it's on screen and the app is visible;
// with animations off it draws one still picture.
import { useEffect, useRef } from 'react';
import { motionOn } from './motion';

const GREEN = [61, 220, 151], AMBER = [255, 181, 71], RED = [255, 107, 125];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function liquidColor(p) {
  if (p < 0.7) return GREEN;
  if (p < 0.85) return mix(GREEN, AMBER, (p - 0.7) / 0.15);
  return mix(AMBER, RED, Math.min(1, (p - 0.85) / 0.1));
}

export default function LiquidGauge({ fraction = 0, variant = 'capsule', className, style, label, id }) {
  const ref = useRef(null);
  const target = useRef(Math.max(0, fraction));
  const sloshRef = useRef(0);
  const still = useRef(null);   // redraw, when animations are off
  useEffect(() => {
    if (Math.abs(target.current - fraction) > 0.001) sloshRef.current = 1;
    target.current = Math.max(0, fraction);
    still.current?.();
  }, [fraction]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const g = cv.getContext('2d'); if (!g) return undefined;
    const animate = motionOn();
    let W = 0, H = 0, level = animate ? 0 : Math.min(1.08, target.current), vel = 0, raf = 0, onScreen = true, last = 0;
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.max(1, W * d); cv.height = Math.max(1, H * d); g.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    const bar = variant === 'bar';
    const draw = (now) => {
      // ~30 frames a second is plenty for liquid, and half the battery
      if (animate && now - last < 30) { raf = requestAnimationFrame(draw); return; }
      last = now;
      const goal = Math.min(1.08, target.current);
      if (animate) { vel = (vel + (goal - level) * 0.07) * 0.84; level += vel; sloshRef.current *= 0.97; } else level = goal;
      const p = Math.max(0, Math.min(1, level));
      const [cr, cg, cb] = liquidColor(Math.min(1, goal));
      g.clearRect(0, 0, W, H);
      const pad = bar ? 0 : 2, x = pad, y = pad, w = W - pad * 2, h = H - pad * 2, rad = bar ? h / 2 : Math.min(w / 2, 26);
      g.save(); g.beginPath(); g.roundRect(x, y, w, h, rad); g.clip();
      g.fillStyle = bar ? 'rgba(255,255,255,0.22)' : 'rgba(127,127,140,0.10)'; g.fillRect(x, y, w, h);
      const t = now / 1000, amp = animate ? (bar ? 1.2 : 3) + Math.min(bar ? 2 : 10, Math.abs(vel) * 300 + sloshRef.current * (bar ? 2 : 8)) : 0;
      for (let layer = 0; layer < 2; layer++) {
        g.beginPath();
        if (bar) {
          // liquid fills from the left; its edge is a wobbling wave
          const edge = x + w * p;
          g.moveTo(x, y);
          for (let i = 0; i <= 16; i++) { const yy = y + (h * i) / 16; g.lineTo(edge + Math.sin((i / 16) * Math.PI * 2 + t * (3 + layer)) * amp * 2 - layer * 3, yy); }
          g.lineTo(x, y + h);
        } else {
          const surf = y + h * (1 - p);
          g.moveTo(x, y + h);
          for (let i = 0; i <= 32; i++) { const xx = x + (w * i) / 32; g.lineTo(xx, surf + Math.sin((i / 32) * Math.PI * 2 * (1.2 + layer * 0.4) + t * (2.2 + layer)) * amp * (layer ? 0.7 : 1) + layer * 3); }
          g.lineTo(x + w, y + h);
        }
        g.closePath();
        const grad = bar ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y + h * (1 - p), 0, y + h);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${layer ? 0.95 : 0.5})`);
        grad.addColorStop(1, `rgba(${(cr * 0.6) | 0},${(cg * 0.6) | 0},${(cb * 0.6) | 0},1)`);
        g.fillStyle = grad; g.fill();
      }
      if (!bar && animate && p > 0.05) {   // bubbles rising
        for (let b = 0; b < 6; b++) {
          const bx = x + w * (0.18 + ((b * 37) % 64) / 100), span = Math.max(1, h * p), by = y + h - ((t * (16 + b * 5) * 2 + b * 30) % span);
          g.beginPath(); g.arc(bx, by, 1.4 + (b % 3), 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
        }
      }
      g.restore();
      // glass rim + a specular streak
      g.lineWidth = bar ? 1 : 1.6; g.strokeStyle = bar ? 'rgba(255,255,255,.35)' : 'rgba(127,127,140,.35)';
      g.beginPath(); g.roundRect(x, y, w, h, rad); g.stroke();
      if (!bar) {
        const sg = g.createLinearGradient(x, 0, x + w * 0.35, 0); sg.addColorStop(0, 'rgba(255,255,255,.28)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sg; g.beginPath(); g.roundRect(x + 6, y + 12, w * 0.16, h - 24, 12); g.fill();
      }
      if (animate && onScreen && !document.hidden) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    still.current = animate ? null : () => requestAnimationFrame(draw);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen && animate) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
    io.observe(cv);
    const wake = () => { if (!document.hidden && animate) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', wake);
    const ro = new ResizeObserver(() => { size(); if (!animate) requestAnimationFrame(draw); });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', wake); };
  }, [variant]);

  return <canvas id={id} ref={ref} className={`liquid liquid-${variant}${className ? ` ${className}` : ''}`} style={style} role="img" aria-label={label ?? `${Math.round(fraction * 100)}% of budget used`} />;
}
