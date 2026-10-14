// ─── Motion ──────────────────────────────────────────────────────
// The app's animations, and the one switch for them:
//   off when the device asks for reduced motion, or when the user turns
//   "Animations" off in Profile (per device).
// Everything here moves with transform / opacity (or a small canvas), so
// it stays smooth on older phones.
import { useSyncExternalStore } from 'react';

const KEY = 'et_motion';            // 'off' | anything else = on
const EVENT = 'et-motion';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const userOff = () => { try { return localStorage.getItem(KEY) === 'off'; } catch { return false; } };

/** Animations wanted right now? (false on the server and in tests) */
export const motionOn = () => typeof window !== 'undefined' && typeof document !== 'undefined' && !reducedMotion() && !userOff();
export const motionPref = () => (userOff() ? 'off' : 'on');
export function setMotionPref(on) {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, 'off'); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  window.addEventListener(EVENT, cb); mq?.addEventListener?.('change', cb);
  return () => { window.removeEventListener(EVENT, cb); mq?.removeEventListener?.('change', cb); };
}
/** React: re-renders when the switch or the system setting changes. */
export const useMotion = () => useSyncExternalStore(subscribe, motionOn, () => false);
export const useMotionPref = () => useSyncExternalStore(subscribe, motionPref, () => 'on');

/* ── A · Coin drop ────────────────────────────────────────────────
   A coin arcs from where you pressed Save into the month card (or the
   Home tab), the card takes the hit and a light sweeps across it.
   tone: 'gold' (spent) · 'green' (money in) · 'blue' (saved) · 'violet' (debts) */
const COIN = {
  gold: ['#fff6cf', '#ffd45e', '#e6a52a', '#9c6514', '#8a5a10'],
  green: ['#e9fff4', '#7ef0bd', '#26b97d', '#0f6b47', '#0b5236'],
  blue: ['#eef4ff', '#9cc2ff', '#3f7fe8', '#1d4597', '#16336f'],
  violet: ['#f3eeff', '#c3b2ff', '#7a5cf0', '#41279b', '#311d78'],
};
const rectOf = (x) => (!x ? null : typeof x === 'string' ? document.querySelector(x)?.getBoundingClientRect() : x.getBoundingClientRect ? x.getBoundingClientRect() : x);
const visible = (r) => r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

function coinEl(tone, size) {
  const [hi, light, mid, dark, ink] = COIN[tone] ?? COIN.gold;
  const c = document.createElement('div');
  c.className = 'fx-coin';
  c.textContent = '₹';
  Object.assign(c.style, {
    width: `${size}px`, height: `${size}px`, marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, fontSize: `${size * 0.5}px`, color: ink,
    background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${light} 28%, ${mid} 62%, ${dark} 100%)`,
  });
  return c;
}

/**
 * @param from   element or rect the coin starts at (the Save button)
 * @param to     element, selector or rect it lands on; the first visible of a list wins
 */
export function flyCoin({ from, to, tone = 'gold' }) {
  if (!motionOn()) return;
  const a = rectOf(from);
  const targets = Array.isArray(to) ? to : [to];
  let target = null, b = null;
  for (const t of targets) { const r = rectOf(t); if (visible(r)) { b = r; target = typeof t === 'string' ? document.querySelector(t) : t?.getBoundingClientRect ? t : null; break; } }
  if (!a || !b) return;
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width * 0.7, y1 = b.top + Math.min(b.height * 0.55, 60);
  const lift = Math.min(180, Math.max(90, Math.abs(y1 - y0) * 0.45));
  const coin = coinEl(tone, 30);
  document.body.appendChild(coin);
  const N = 24, kf = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * lift;
    kf.push({ transform: `translate(${x}px, ${y}px) rotateY(${t * 720}deg) scale(${1 + Math.sin(Math.PI * t) * 0.35})`, offset: t });
  }
  const fly = coin.animate(kf, { duration: 820, easing: 'cubic-bezier(.45,0,.4,1)', fill: 'forwards' });
  // a short sparkle trail
  const [, light] = COIN[tone] ?? COIN.gold;
  for (let i = 1; i < 9; i++) {
    const t = i / 9, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * lift;
    const s = document.createElement('div');
    s.className = 'fx-spark'; s.style.background = light; s.style.boxShadow = `0 0 10px ${light}`;
    s.style.transform = `translate(${x}px, ${y}px)`; s.style.opacity = '0';
    document.body.appendChild(s);
    s.animate([{ opacity: 0.9, transform: `translate(${x}px, ${y}px) scale(1)` }, { opacity: 0, transform: `translate(${x}px, ${y + 8}px) scale(.2)` }], { duration: 480, delay: t * 760, fill: 'forwards' })
      .finished.then(() => s.remove(), () => s.remove());
  }
  fly.finished.then(() => {
    coin.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${x1}px, ${y1}px) scale(.3)` }], { duration: 200, fill: 'forwards' }).finished.then(() => coin.remove(), () => coin.remove());
    if (target) {
      target.animate([{ scale: '1' }, { scale: '.96' }, { scale: '1.025' }, { scale: '1' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      const glint = document.createElement('div');
      glint.className = 'fx-glint';
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
      target.appendChild(glint);
      glint.animate([{ transform: 'translateX(-120%) skewX(-18deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateX(420%) skewX(-18deg)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.9,.25,1)' })
        .finished.then(() => glint.remove(), () => glint.remove());
    }
  }, () => coin.remove());
}

/* ── E · Coin burst ───────────────────────────────────────────────
   Spinning coins thrown up from a point, falling with gravity. One canvas
   over the whole window for about two seconds, then it's gone. */
export function burstCoins(at, { count = 64 } = {}) {
  if (!motionOn()) return;
  const r = rectOf(at);
  const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'fx-canvas'; cv.width = W * dpr; cv.height = H * dpr;
  document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const ox = r ? r.left + r.width / 2 : W / 2, oy = r ? r.top + r.height / 2 : H / 2;
  const coins = Array.from({ length: count }, () => {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 5 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: 5 + Math.random() * 7, spin: Math.random() * 6, vs: 0.12 + Math.random() * 0.3 };
  });
  const start = performance.now();
  const frame = (now) => {
    const el = now - start;
    g.clearRect(0, 0, W, H);
    coins.forEach((c) => {
      c.vy += 0.32; c.vx *= 0.992; c.x += c.vx; c.y += c.vy; c.spin += c.vs;
      const a = Math.max(0, 1 - el / 1900);
      g.save(); g.globalAlpha = a; g.translate(c.x, c.y); g.scale(Math.max(0.12, Math.abs(Math.cos(c.spin))), 1);
      const gr = g.createRadialGradient(-c.s * 0.3, -c.s * 0.35, 1, 0, 0, c.s);
      gr.addColorStop(0, '#fff6cf'); gr.addColorStop(0.35, '#ffd45e'); gr.addColorStop(0.75, '#e6a52a'); gr.addColorStop(1, '#9c6514');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, c.s, 0, Math.PI * 2); g.fill(); g.restore();
    });
    if (el < 2000) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

/** Pop an element in (used for "All settled ✓" and the like). */
export function pop(el) {
  if (!el || !motionOn()) return;
  el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
