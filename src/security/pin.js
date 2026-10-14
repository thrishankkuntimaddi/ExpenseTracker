// ─── App lock: the PIN (pure) ────────────────────────────────────
// One PIN for the account, used on every device. Only a slow salted hash is
// stored (users/{uid}/security/lock), never the PIN itself.
//
// What the lock is — and isn't: it keeps someone holding your unlocked
// phone or laptop out of the app. Your data is protected in the cloud by
// your Google/email sign-in, not by this PIN; a 4–6 digit PIN can't stand up
// to someone who already has your device's files and time to spare, which
// is why repeated wrong PINs lock the app for longer and longer, alert you,
// and in the end require signing in again.
export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const ITERATIONS = 150000;
export const MAX_TRIES = 10;            // then only "sign in again" unlocks

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Is this a PIN we accept? Returns an error message or null. */
export function pinProblem(pin) {
  if (!/^\d+$/.test(pin ?? '')) return 'Use digits only.';
  if (pin.length < PIN_MIN || pin.length > PIN_MAX) return `Use ${PIN_MIN} to ${PIN_MAX} digits.`;
  if (/^(\d)\1+$/.test(pin)) return 'All the same digit is too easy to guess.';
  const asc = '0123456789012345', desc = '9876543210987654';
  if (asc.includes(pin) || desc.includes(pin)) return 'A straight run like 1234 is too easy to guess.';
  return null;
}

export async function hashPin(pin, saltB64, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations }, key, 256);
  return b64(bits);
}

/** A new lock record for this PIN: { pinHash, salt, iterations, length }. */
export async function makePinRecord(pin) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { pinHash: await hashPin(pin, salt), salt, iterations: ITERATIONS, length: pin.length };
}

/** Constant-time-ish compare (the hash is slow anyway). */
export async function checkPin(pin, record) {
  if (!record?.pinHash || !record?.salt) return false;
  const h = await hashPin(pin, record.salt, record.iterations || ITERATIONS);
  if (h.length !== record.pinHash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ record.pinHash.charCodeAt(i);
  return diff === 0;
}

/**
 * How long to wait after `fails` wrong PINs in a row (ms).
 * 1–4: none · 5: 30 s · 6: 1 min · 7: 5 min · 8: 15 min · 9: 1 h · 10+: sign in again (Infinity)
 */
export function lockoutFor(fails) {
  if (fails >= MAX_TRIES) return Infinity;
  return [0, 0, 0, 0, 0, 30e3, 60e3, 5 * 60e3, 15 * 60e3, 60 * 60e3][fails] ?? 0;
}

/** Tell the owner (other devices, email) from this many failures on. */
export const ALERT_AT = 5;

/** "30 s", "5 min", "1 h" */
export function waitLabel(ms) {
  if (!isFinite(ms)) return 'until you sign in again';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.ceil(s / 60);
  return m < 60 ? `${m} min` : `${Math.ceil(m / 60)} h`;
}

/** "Lock after" choices, in seconds away from the app. */
export const LOCK_AFTER = [
  { key: 0, label: 'Immediately' },
  { key: 60, label: 'After 1 minute' },
  { key: 300, label: 'After 5 minutes' },
  { key: 900, label: 'After 15 minutes' },
  { key: 3600, label: 'After 1 hour' },
];
export const DEFAULT_LOCK_AFTER = 60;

/** Should the app lock now, having been hidden since `hiddenAt`? */
export function shouldRelock({ enabled, lockAfter = DEFAULT_LOCK_AFTER }, hiddenAt, now = Date.now()) {
  if (!enabled || !hiddenAt) return false;
  return now - hiddenAt >= lockAfter * 1000;
}
