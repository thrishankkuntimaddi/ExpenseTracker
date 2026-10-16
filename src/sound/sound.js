// ─── App sounds ───────────────────────────────────────────────────
// Every sound is synthesised here with the Web Audio API — no audio files,
// nothing borrowed from anyone, works offline on every platform.
//
//   tap       a soft, short "tick" on buttons and tabs
//   debit     money out: a coin dropping (expense added)
//   credit    money in: a bright rising chime (income added)
//   save      into savings: a coin landing in a jar
//   transfer  debts and settlements: two quick coins
//   roll      cash rolling: ticks that speed up and settle (a total counting up)
//   open      the app opening: a short roll and a chime
//   banner    a gentle two-note pop for alerts and update notes
//
// Settings are per device (Profile → Appearance → Sounds): on/off, volume,
// and each kind. On by default: taps and money sounds.
import { useSyncExternalStore } from 'react';

const KEY = 'et_sounds';
export const SOUND_KINDS = [
  { key: 'tap', label: 'Taps', hint: 'A soft tick on buttons and tabs', demo: 'tap' },
  { key: 'money', label: 'Money', hint: 'Coin for spending, chime for income, jar for savings', demo: 'debit' },
  { key: 'roll', label: 'Totals rolling', hint: 'Cash rolling as the month’s total counts up', demo: 'roll' },
  { key: 'open', label: 'App opening', hint: 'A short roll and a chime when the app starts', demo: 'open' },
  { key: 'alerts', label: 'Alerts & notes', hint: 'A gentle pop for security alerts and update notes', demo: 'banner' },
];
export const DEFAULT_SOUNDS = { on: true, volume: 0.6, tap: true, money: true, roll: false, open: false, alerts: false };
const KIND_OF = { tap: 'tap', debit: 'money', credit: 'money', save: 'money', transfer: 'money', roll: 'roll', open: 'open', banner: 'alerts' };

/* ── Preferences (a tiny store, so Settings re-renders) ── */
let prefs = (() => { try { return { ...DEFAULT_SOUNDS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_SOUNDS }; } })();
const subs = new Set();
export const getSoundPrefs = () => prefs;
export function setSoundPrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  subs.forEach((f) => f());
}
export const useSoundPrefs = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => prefs, () => prefs);

/* ── Audio ── */
let ctx = null, master = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  master.gain.value = Math.max(0, Math.min(1, prefs.volume)) * 0.9;
  return ctx;
}
// Browsers allow sound only after the first touch / click: wake the engine then
if (typeof window !== 'undefined') {
  const wake = () => { audio(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('keydown', wake, true); };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
}

/** One enveloped oscillator note. */
function tone(c, { freq, to, type = 'sine', at = 0, dur = 0.12, gain = 0.3, attack = 0.004 }) {
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
/** A short burst of filtered noise (the body of a tick or a coin's edge). */
function noise(c, { at = 0, dur = 0.03, gain = 0.15, freq = 3000, q = 1.2 }) {
  const t = c.currentTime + at;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}
/** A metallic coin "ding": a few inharmonic partials ringing out. */
function coin(c, { at = 0, base = 1975, gain = 0.16, dur = 0.45 }) {
  [1, 1.5, 2.0, 2.76].forEach((m, i) => tone(c, { freq: base * m, at, dur: dur / (1 + i * 0.6), gain: gain / (1 + i), type: 'sine', attack: 0.002 }));
  noise(c, { at, dur: 0.02, gain: gain * 0.6, freq: 6000, q: 0.8 });
}

const SOUNDS = {
  // A short, soft, dry tick — no pitch slide: a brief high "tk" over a
  // muted low body, gone in ~25 ms (the feel of a phone's touch sound)
  tap: (c) => {
    tone(c, { freq: 1250, dur: 0.022, gain: 0.07, attack: 0.0012 });
    tone(c, { freq: 480, dur: 0.028, gain: 0.045, attack: 0.0015 });
    noise(c, { dur: 0.006, gain: 0.025, freq: 3600, q: 0.7 });
  },
  debit: (c) => { coin(c, { base: 1568, gain: 0.11, dur: 0.32 }); coin(c, { at: 0.08, base: 1175, gain: 0.05, dur: 0.22 }); },
  credit: (c) => [1046.5, 1318.5, 1568].forEach((f, i) => tone(c, { freq: f, at: i * 0.06, dur: 0.26, gain: 0.08, type: 'triangle' })),
  save: (c) => { coin(c, { base: 1760, gain: 0.09, dur: 0.3 }); tone(c, { freq: 220, to: 150, at: 0.05, dur: 0.12, gain: 0.07, type: 'sine' }); },
  transfer: (c) => { coin(c, { base: 1760, gain: 0.08, dur: 0.25 }); coin(c, { at: 0.1, base: 2093, gain: 0.08, dur: 0.28 }); },
  roll: (c, { ms = 900 } = {}) => {
    // ticks that start fast and slow down as the digits settle, then a ding
    const n = 14, total = ms / 1000;
    for (let i = 0; i < n; i++) {
      const p = i / n, at = total * (1 - (1 - p) ** 1.8) * 0.92;
      noise(c, { at, dur: 0.018, gain: 0.07, freq: 3200 + (i % 3) * 400, q: 3 });
    }
    coin(c, { at: total, base: 2093, gain: 0.09, dur: 0.35 });
  },
  open: (c) => { SOUNDS.roll(c, { ms: 520 }); [784, 1175, 1568].forEach((f, i) => tone(c, { freq: f, at: 0.58 + i * 0.06, dur: 0.38, gain: 0.1, type: 'triangle' })); },
  banner: (c) => { tone(c, { freq: 880, dur: 0.12, gain: 0.12, type: 'sine' }); tone(c, { freq: 1318.5, at: 0.09, dur: 0.18, gain: 0.12, type: 'sine' }); },
};

const lastAt = {};
/**
 * Play a sound if it's switched on. `force` plays it regardless (previews).
 * Repeats of the same sound within a few ms are merged.
 */
export function play(name, { force = false, ...opts } = {}) {
  const fn = SOUNDS[name];
  if (!fn) return;
  if (!force && (!prefs.on || !prefs[KIND_OF[name]])) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = performance.now();
  if (now - (lastAt[name] ?? 0) < (name === 'roll' ? 700 : 40)) return;
  lastAt[name] = now;
  const c = audio();
  if (!c) return;
  try { fn(c, opts); } catch { /* audio unavailable */ }
}

/* Taps: one listener for the whole app — anything pressable ticks.
   On 'click', not on touch-down: a click only happens for a real tap, so
   starting a scroll or a swipe on a button stays silent. */
const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"], summary, label.toggle, .toggle-track, input[type="checkbox"], input[type="radio"], select';
let tapsWired = false;
export function wireTapSounds() {
  if (tapsWired || typeof document === 'undefined') return;
  tapsWired = true;
  document.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const el = e.target?.closest?.(PRESSABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-no-tap-sound]')) return;
    play('tap');
  }, true);
}

/** One line for the Profile row. */
export const soundsSummary = (p) => {
  if (!p.on) return 'Off';
  const on = SOUND_KINDS.filter((k) => p[k.key]).map((k) => k.label.toLowerCase());
  return on.length ? `On · ${on.join(', ')}` : 'On · nothing picked';
};
