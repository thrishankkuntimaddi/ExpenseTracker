// ─── Google Drive backup ─────────────────────────────────────────
// Like WhatsApp's backup: a full copy of your data, on a schedule you pick,
// in YOUR Google Drive — in its hidden app storage (appDataFolder), which
// doesn't show up as files in Drive and only this app can read. One copy:
// each backup replaces the last (the new one is saved before the old one
// goes). The copy is encrypted (utils/backupCrypto.js) with a key kept in
// your account, so the file alone is unreadable. We never hold a copy or
// your Google tokens on a server; the app talks to Drive directly.
//
// Access: "drive.appdata" (its own hidden storage) + "drive.file" (only
// files it created — used to clear out the old visible "Expense Tracker
// backups" folder). Nothing else in your Drive is visible to it.
// Android apps from before 3.13 can only get drive.file: they keep one
// encrypted copy in that folder until the app is updated.
//
// Getting a token, per platform:
//   android  Google's AuthorizationClient (GoogleDrivePlugin.java) — after
//            the first OK it is silent, so scheduled backups just run
//   desktop  browser + loopback once, then a refresh token kept on this
//            computer — silent afterwards
//   web      Google Identity Services (needs VITE_GOOGLE_WEB_CLIENT_ID), or
//            for Google accounts a Firebase re-auth popup with the Drive scope.
//            Browsers need a click for these, so a due backup waits for one.
//
// Which Google account: the one you sign in with, unless you pick another
// ("Change account" — settings.driveBackup.account, shared by your devices).
// Every token is checked against it, so no device backs up to an old account.
import { registerPlugin } from '@capacitor/core';
import { doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from './firebase';
import { platform } from '../native';
import { desktopOAuth, desktopRefresh } from '../native/googleSignIn';
import { exportAllUserData } from './firestore';
import { newBackupKey, encryptBackup, decryptBackup } from '../utils/backupCrypto';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPES = `${APPDATA_SCOPE} ${DRIVE_SCOPE}`;
export const FOLDER_NAME = 'Expense Tracker backups';     // the old, visible place (cleared out)
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime';
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
const DESKTOP_RT_KEY = 'et_drive_rt';
const TOKEN_KEY = 'et_drive_token';          // { token, exp } — web/desktop, this session

const GoogleDrive = registerPlugin('GoogleDrive');

export const FREQUENCIES = [
  { key: 'daily', label: 'Every day', ms: 24 * 3600e3 },
  { key: 'weekly', label: 'Every week', ms: 7 * 24 * 3600e3 },
  { key: 'monthly', label: 'Every month', ms: 30 * 24 * 3600e3 },
];
export const DEFAULT_DRIVE = { enabled: false, frequency: 'daily', account: null };
// One copy, always (older settings carried a "keep" count)
export const driveSettings = (settings) => ({ ...DEFAULT_DRIVE, ...(settings?.driveBackup ?? {}), keep: 1 });

/** Is a backup due? (pure) */
export function backupDue(cfg, lastAt, now = Date.now()) {
  if (!cfg?.enabled) return false;
  const period = FREQUENCIES.find((f) => f.key === cfg.frequency)?.ms ?? FREQUENCIES[0].ms;
  // a little slack so "daily" at 9 pm doesn't drift later every day
  return !lastAt || now - lastAt >= period - 2 * 3600e3;
}

/** Which old backups to delete, keeping the newest `keep` (pure). */
export function backupsToPrune(files, keep) {
  const sorted = [...files].sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime)));
  return sorted.slice(Math.max(1, keep));
}

export const backupFileName = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `expense-tracker-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
};

/* ── Tokens ─────────────────────────────────────────────────── */
function cached() {
  try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); if (t && t.exp > Date.now() + 60e3) return t.token; } catch { /* storage unavailable */ }
  return null;
}
function remember(token, seconds = 3500) {
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + seconds * 1000 })); } catch { /* storage unavailable */ }
  return token;
}

let gisLoading = null;
function loadGis() {
  gisLoading ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gisLoading = null; reject(new Error('Could not load Google sign-in. Check your connection.')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

const sameEmail = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

/**
 * An access token for Drive. `interactive: false` never shows anything and
 * throws { code: 'consent-required' } when a tap is needed.
 * `account`: the Google account backups go to (a token for any other is
 * refused). `choose`: show Google's account picker and use whichever is picked.
 */
export async function driveToken({ interactive = true, hint, account = null, choose = false } = {}) {
  const opts = { interactive, hint: account ?? hint, account: choose ? null : account, choose };
  let token = await rawToken(opts);
  if (choose || !account) return token;
  let got = await tokenAccount(token);
  if (!got || sameEmail(got, account)) return token;
  // This device still holds access for another account: forget it and ask
  // once more (Google preselects the right one)
  disconnectDrive();
  if (interactive && platform !== 'android') {
    token = await rawToken(opts);
    got = await tokenAccount(token);
    if (!got || sameEmail(got, account)) return token;
    disconnectDrive();
  }
  throw Object.assign(new Error(platform === 'android' && !nativePicksAccount()
    ? `Backups go to ${account} — install the new app so this phone can use that account.`
    : `Backups go to ${account}, but Google gave access for ${got}. Tap “Back up now” and pick ${account}.`),
  { code: interactive ? 'wrong-account' : 'consent-required' });
}

/** Can this app pick the Google account? (Android apps from before 3.14.3 can't.) */
export function nativePicksAccount() {
  if (platform !== 'android') return true;
  const h = window.Capacitor?.PluginHeaders?.find((p) => p.name === 'GoogleDrive');
  return !!h?.methods?.some((m) => m.name === 'chooseAccount');
}
export const canChooseAccount = () => (platform === 'web' ? !!WEB_CLIENT_ID : nativePicksAccount());

async function rawToken({ interactive, hint, account, choose }) {
  const need = () => Object.assign(new Error('Tap “Back up now” to connect Google Drive.'), { code: 'consent-required' });
  if (platform === 'android') {
    try {
      let pick = account;
      if (choose) {
        if (!nativePicksAccount()) throw Object.assign(new Error('Changing the Google account needs the new Android app. Install it (your data stays), then try again.'), { code: 'native-needed' });
        pick = (await GoogleDrive.chooseAccount()).email;
      }
      const r = await GoogleDrive.authorize({ interactive, scopes: SCOPES.split(' '), ...(pick ? { account: pick } : {}) });
      return r.accessToken;
    } catch (err) {
      if (err?.code === 'consent-required') throw need();
      if (err?.code === 'cancelled') throw Object.assign(new Error(choose ? 'No account was picked — backups stay where they were.' : 'Google Drive access was not given.'), { code: 'cancelled' });
      throw err;
    }
  }
  if (choose) disconnectDrive();
  const c = cached();
  if (c && (await grantedScopes(c)).has(APPDATA_SCOPE)) return c;
  if (platform === 'desktop') {
    let rt = null;
    try { rt = localStorage.getItem(DESKTOP_RT_KEY); } catch { /* storage unavailable */ }
    if (rt) {
      try {
        const r = await desktopRefresh(rt);
        // Granted before hidden backups existed: ask again (once) for the new scope
        if ((await grantedScopes(r.access_token)).has(APPDATA_SCOPE)) return remember(r.access_token, r.expires_in);
        if (!interactive) throw need();
      } catch (err) {
        if (err.code === 'consent-required') throw err;
        if (err.code !== 'invalid_grant') throw err;
        try { localStorage.removeItem(DESKTOP_RT_KEY); } catch { /* storage unavailable */ }
      }
    }
    if (!interactive) throw need();
    const r = await desktopOAuth({ scope: `openid email ${SCOPES}`, extra: { access_type: 'offline', prompt: choose ? 'select_account consent' : 'consent', ...(hint && !choose ? { login_hint: hint } : {}) } });
    if (!r) throw Object.assign(new Error('Google Drive access was not given.'), { code: 'cancelled' });
    if (r.refresh_token) { try { localStorage.setItem(DESKTOP_RT_KEY, r.refresh_token); } catch { /* storage unavailable */ } }
    return remember(r.access_token, r.expires_in);
  }
  // web
  if (!interactive) throw need();
  if (WEB_CLIENT_ID) {
    await loadGis();
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: WEB_CLIENT_ID, scope: SCOPES, ...(choose ? {} : { hint }),
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(remember(r.access_token, Number(r.expires_in) || 3500))),
        error_callback: (e) => reject(Object.assign(new Error(e?.type === 'popup_closed' ? 'Google Drive access was not given (the Google window was closed — if it said “Access blocked”, the app’s Google sign-in isn’t fully set up yet).' : (e?.message || 'Google sign-in failed.')), { code: 'cancelled' })),
      });
      client.requestAccessToken({ prompt: choose ? 'select_account' : '' });
    });
  }
  // No web client configured: Google accounts can grant Drive through a Firebase re-auth popup
  if (choose) throw Object.assign(new Error('Changing the Google account isn’t available on this website. Use the Android or desktop app.'), { code: 'unsupported' });
  const user = auth?.currentUser;
  if (!user?.providerData?.some((p) => p.providerId === 'google.com')) {
    throw Object.assign(new Error('Drive backup on the website needs a Google account here. Use the Android or desktop app, or sign in with Google.'), { code: 'unsupported' });
  }
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.addScope(APPDATA_SCOPE);
  provider.setCustomParameters({ login_hint: user.email ?? '' });
  const result = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error('Google did not give Drive access. Try again.');
  return remember(token);
}

/** Forget this device's Drive access (desktop refresh token, cached token). */
export function disconnectDrive() {
  try { localStorage.removeItem(DESKTOP_RT_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

/* ── Drive REST ─────────────────────────────────────────────── */
async function api(token, url, init = {}) {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (res.status === 401) {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
    throw Object.assign(new Error('Google Drive access expired. Tap “Back up now” to reconnect.'), { code: 'consent-required' });
  }
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* not JSON */ }
    if (res.status === 403 && /storage|quota/i.test(msg)) throw new Error('Your Google Drive is full. Free some space, then try again.');
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg)) {
      throw new Error('Google Drive isn’t switched on for this app yet. It needs the Drive API enabled in its Google Cloud project — try again later.');
    }
    throw new Error(`Google Drive: ${msg}`);
  }
  return res;
}

/** Which Drive scopes a token carries (tokeninfo; remembered per token). */
const scopeCache = new Map();
export async function grantedScopes(token) {
  if (scopeCache.has(token)) return scopeCache.get(token);
  let set = new Set();
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (r.ok) set = new Set(String((await r.json()).scope ?? '').split(' '));
  } catch { /* offline: treat as unknown */ }
  scopeCache.set(token, set);
  return set;
}

/** The Google account a token belongs to (Drive "about"; remembered per token). */
const accountCache = new Map();
export async function tokenAccount(token) {
  if (accountCache.has(token)) return accountCache.get(token);
  let email = null;
  try { email = (await (await api(token, '/about?fields=user(emailAddress)')).json()).user?.emailAddress ?? null; } catch { /* unknown */ }
  if (email) accountCache.set(token, email);
  return email;
}

/* The old visible folder (only looked up, never created any more — except
   by Android apps that can't use hidden storage yet) */
async function legacyFolderId(token, { create = false } = {}) {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await (await api(token, `/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  if (found.files?.[0]) return found.files[0].id;
  if (!create) return null;
  const made = await (await api(token, '/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', description: 'Encrypted backup made by the Expense Tracker app. Restore it from the app: Profile → Google Drive backup.' }),
  })).json();
  return made.id;
}

const FILE_FIELDS = 'files(id,name,size,createdTime)';
/** Backups this app can see: hidden ones, or (older Android apps) the legacy folder's. */
export async function listBackups(token) {
  const scopes = await grantedScopes(token);
  if (scopes.has(APPDATA_SCOPE)) {
    const r = await (await api(token, `/files?spaces=appDataFolder&orderBy=createdTime desc&fields=${FILE_FIELDS}&pageSize=50`)).json();
    return { hidden: true, files: r.files ?? [] };
  }
  return { hidden: false, ...(await listLegacy(token)) };
}
async function listLegacy(token) {
  const id = await legacyFolderId(token);
  if (!id) return { folderId: null, files: [] };
  const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
  const r = await (await api(token, `/files?q=${q}&orderBy=createdTime desc&fields=${FILE_FIELDS}&pageSize=100`)).json();
  return { folderId: id, files: r.files ?? [] };
}

/** The backup's JSON text (decrypted with this account's key). */
export async function downloadBackup(token, fileId, uid) {
  const text = await (await api(token, `/files/${fileId}?alt=media`)).text();
  return decryptBackup(await backupKey(uid), text);
}

async function upload(token, parent, name, text) {
  const boundary = `et${Math.random().toString(36).slice(2)}`;
  const meta = { name, parents: [parent], mimeType: 'application/json', appProperties: { app: 'expensetracker', kind: 'backup', enc: 'aes-gcm' } };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  return (await api(token, UPLOAD, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
}

/* ── The account's backup key ──
   users/{uid}/backup_key/current — made once, shared by your devices. Kept
   by "Delete all my data" (it isn't data, and it's what opens the backups
   that could bring the data back). */
const keyRef = (uid) => doc(db, 'users', uid, 'backup_key', 'current');
let keyCache = null;
export async function backupKey(uid) {
  if (keyCache?.uid === uid) return keyCache.k;
  const k = await runTransaction(db, async (tx) => {
    const cur = await tx.get(keyRef(uid));
    if (cur.exists() && cur.data()?.k) return cur.data().k;
    const fresh = newBackupKey();
    tx.set(keyRef(uid), { k: fresh, alg: 'AES-GCM-256', createdAt: Date.now() });
    return fresh;
  });
  keyCache = { uid, k };
  return k;
}

/* ── Backup state (shared by your devices, so one backs up per period) ── */
const stateRef = (uid) => doc(db, 'users', uid, 'drive_backup', 'state');
export function subscribeBackupState(uid, cb) {
  return onSnapshot(stateRef(uid), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
}

/**
 * Back up now: export everything, encrypt, upload, then remove every older
 * copy (and, once, the old visible folder). Returns the new file.
 * Throws (code 'consent-required' when not interactive).
 */
export async function backupNow({ uid, email, account = null, choose = false, interactive = true, deviceName }) {
  const token = await driveToken({ interactive, hint: email, account, choose });
  const usedAccount = await tokenAccount(token);
  const [data, key] = await Promise.all([exportAllUserData(uid, email), backupKey(uid)]);
  const text = await encryptBackup(key, JSON.stringify(data));
  const scopes = await grantedScopes(token);
  const hidden = scopes.has(APPDATA_SCOPE);
  const before = await listBackups(token);
  const parent = hidden ? 'appDataFolder' : await legacyFolderId(token, { create: true });
  const file = await upload(token, parent, backupFileName(), text);
  // The new copy is safe in Drive: now drop the rest
  const old = backupsToPrune([file, ...before.files], 1);
  await Promise.all(old.map((f) => api(token, `/files/${f.id}`, { method: 'DELETE' }).catch(() => {})));
  // Hidden storage works: the old, readable copies in "Expense Tracker backups" go
  let legacyCleared = false;
  if (hidden && scopes.has(DRIVE_SCOPE)) {
    try {
      const legacy = await listLegacy(token);
      // The app's own old copies: deleted for good. The folder: moved to
      // Drive's trash (not deleted) — in case you kept anything else in it
      await Promise.all(legacy.files.map((f) => api(token, `/files/${f.id}`, { method: 'DELETE' })));
      if (legacy.folderId) await api(token, `/files/${legacy.folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      legacyCleared = true;
    } catch { /* next time */ }
  }
  await setDoc(stateRef(uid), {
    lastAt: Date.now(), lastFile: { id: file.id, name: file.name, size: Number(file.size) || text.length },
    lastDevice: deviceName ?? null, error: null, hidden, encrypted: true, account: usedAccount, ...(legacyCleared ? { legacyCleared: true } : {}),
  }, { merge: true });
  return { ...file, account: usedAccount };
}

export function noteBackupError(uid, message) {
  return setDoc(stateRef(uid), { error: { message, at: Date.now() } }, { merge: true }).catch(() => {});
}

export const folderUrl = (id) => `https://drive.google.com/drive/folders/${id}`;
