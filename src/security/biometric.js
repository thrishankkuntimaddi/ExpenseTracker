// ─── App lock: fingerprint / face / passkey (this device only) ───
//   android  the phone's fingerprint, face or screen lock (BiometricPlugin.java)
//   web, desktop  a passkey on this device — Touch ID, Windows Hello, a
//            phone's fingerprint in Chrome — via WebAuthn
// It's a quicker way past the lock on a device you've set it up on; the
// account PIN always works too. Enrolment is per device and stored only on
// the device (a passkey's id; nothing to steal from the cloud).
import { registerPlugin } from '@capacitor/core';
import { platform } from '../native';

const Biometric = registerPlugin('Biometric');
const KEY = 'et_lock_bio';                 // 'android' | { credId } (base64url)

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function write(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }

/** What this device offers: { available, label, reason } */
export async function biometricStatus() {
  if (platform === 'android') {
    try {
      const r = await Biometric.status();
      return { available: !!r.available, label: 'Fingerprint or face', reason: r.reason };
    } catch { return { available: false, label: 'Fingerprint', reason: 'unavailable' }; }
  }
  try {
    const ok = typeof window !== 'undefined' && window.isSecureContext && window.PublicKeyCredential
      && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const label = /Mac|iPhone|iPad/.test(ua) ? 'Touch ID or Face ID' : /Windows/.test(ua) ? 'Windows Hello' : 'Fingerprint or face (passkey)';
    return { available: !!ok, label, reason: ok ? 'ok' : 'unavailable' };
  } catch { return { available: false, label: 'Passkey', reason: 'unavailable' }; }
}

export const biometricEnrolled = () => !!read();

/** Set it up on this device (asks for the fingerprint once). */
export async function enrollBiometric({ email = 'you', name = 'Expense Tracker' } = {}) {
  if (platform === 'android') {
    await Biometric.verify({ title: 'Use your fingerprint to unlock', subtitle: 'Expense Tracker' });
    write('android');
    return true;
  }
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Expense Tracker' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: email, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  if (!cred) return false;
  write({ credId: b64url(cred.rawId) });
  return true;
}

export function forgetBiometric() { write(null); }

/**
 * Ask for the fingerprint. Resolves true (verified), false (cancelled);
 * throws on a real failure (sensor locked out, passkey removed).
 */
export async function verifyBiometric() {
  const saved = read();
  if (!saved) return false;
  if (platform === 'android') {
    try { await Biometric.verify({ title: 'Unlock Expense Tracker' }); return true; } catch (err) {
      if (err?.code === 'cancelled') return false;
      throw err;
    }
  }
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64url(saved.credId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!got;
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return false;   // dismissed
    throw err;
  }
}
