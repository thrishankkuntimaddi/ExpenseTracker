// ─── Google sign-in inside the apps ──────────────────────────────
// Google blocks its sign-in page in embedded web views, so the browser popup
// used on the website can't work in the apps:
//   android  native Google sign-in (Credential Manager) via @capacitor-firebase/authentication
//   desktop  the user's own browser + a loopback redirect (src-tauri/src/oauth.rs), with PKCE
// Both return a Google ID token, which signs in to Firebase with signInWithCredential.
import { invoke } from '@tauri-apps/api/core';
import { platform } from './index';

const DESKTOP_CLIENT_ID     = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
// Google: secrets of "Desktop app" clients are not confidential (they ship in every copy)
const DESKTOP_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET;

export const googleSignInAvailable =
  platform === 'web' || platform === 'android' ||
  (platform === 'desktop' && !!DESKTOP_CLIENT_ID && !!DESKTOP_CLIENT_SECRET);

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** Google authorization URL; `__REDIRECT_URI__` is filled in by the desktop shell. */
export function buildDesktopAuthUrl({ clientId, challenge, state }) {
  const p = new URLSearchParams({
    client_id: clientId, response_type: 'code', scope: 'openid email profile',
    code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=__REDIRECT_URI__&${p}`;
}

/** What came back on the loopback: { code } | { cancelled: true }; throws on anything else. */
export function parseLoopbackQuery(query, expectedState) {
  const q = new URLSearchParams(query);
  if (q.get('error')) {
    if (q.get('error') === 'access_denied') return { cancelled: true };
    throw new Error(`Google sign-in failed: ${q.get('error')}`);
  }
  if (q.get('state') !== expectedState) throw new Error('Google sign-in was interrupted (state mismatch). Try again.');
  if (!q.get('code')) throw new Error('Google sign-in returned no code. Try again.');
  return { code: q.get('code') };
}

async function desktopIdToken() {
  const verifier = randomString(48), state = randomString(16);
  const authUrl = buildDesktopAuthUrl({ clientId: DESKTOP_CLIENT_ID, challenge: await pkceChallenge(verifier), state });
  const { redirectUri, query } = await invoke('google_oauth_loopback', { authUrl });
  const result = parseLoopbackQuery(query, state);
  if (result.cancelled) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DESKTOP_CLIENT_ID, client_secret: DESKTOP_CLIENT_SECRET, code: result.code,
      code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.id_token) throw new Error(`Google sign-in failed: ${json.error_description || json.error || res.status}`);
  return json.id_token;
}

/** The user backed out of the account picker (Credential Manager or the classic one: status 12501). */
export const isCancelledSignIn = (err) => /cancel|12501/i.test(`${err?.message ?? ''} ${err?.code ?? ''}`);

/* Android's newer Credential Manager fails on some phones ("No credentials
   available" — older Play services, some vivo/iQOO, Oppo, Xiaomi builds, or no
   Google account added yet), so on any failure other than a cancel, try
   Google's classic account picker, which can also add an account. */
async function androidIdToken() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  try {
    const r = await FirebaseAuthentication.signInWithGoogle();
    return r.credential?.idToken ?? null;
  } catch (err) {
    if (isCancelledSignIn(err)) return null;
    console.warn('[google] Credential Manager failed, trying the classic picker:', err?.message);
  }
  try {
    const r = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
    return r.credential?.idToken ?? null;
  } catch (err) {
    if (isCancelledSignIn(err)) return null;
    throw new Error(androidSignInHelp(err));
  }
}

/** What to tell someone whose phone refused Google sign-in both ways. */
export function androidSignInHelp(err) {
  const msg = err?.message ?? '';
  const base = 'Google sign-in isn’t working on this phone';
  if (/no credential|no account/i.test(msg)) {
    return `${base}: no Google account was offered. Add one in Settings → Accounts (or Passwords & accounts), update “Google Play services” from the Play Store, then try again — or sign in with email and password.`;
  }
  if (/network|7:/i.test(msg)) return `${base}: it couldn’t reach Google. Check the connection and try again.`;
  return `${base} (${msg || 'unknown error'}). Update “Google Play services” from the Play Store and try again, or sign in with email and password.`;
}

/** A Google ID token for this user, or null if they cancelled. Apps only. */
export function nativeGoogleIdToken() {
  if (platform === 'android') return androidIdToken();
  if (platform === 'desktop') return desktopIdToken();
  throw new Error('nativeGoogleIdToken is only for the apps');
}
