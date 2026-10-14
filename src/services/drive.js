// ─── Google Drive backup ─────────────────────────────────────────
// Like WhatsApp's backup: a full copy of your data, on a schedule you pick,
// in YOUR Google Drive — a folder "Expense Tracker backups" you can open,
// download or delete yourself. We never hold a copy or your Google tokens on
// a server; the app talks to Drive directly.
//
// Access is the narrow "drive.file" scope: the app sees only the files it
// created, nothing else in your Drive.
//
// Getting a token, per platform:
//   android  Google's AuthorizationClient (GoogleDrivePlugin.java) — after
//            the first OK it is silent, so scheduled backups just run
//   desktop  browser + loopback once, then a refresh token kept on this
//            computer — silent afterwards
//   web      Google Identity Services (needs VITE_GOOGLE_WEB_CLIENT_ID), or
//            for Google accounts a Firebase re-auth popup with the Drive scope.
//            Browsers need a click for these, so a due backup waits for one.
import { registerPlugin } from '@capacitor/core';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from './firebase';
import { platform } from '../native';
import { desktopOAuth, desktopRefresh } from '../native/googleSignIn';
import { exportAllUserData } from './firestore';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FOLDER_NAME = 'Expense Tracker backups';
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
export const DEFAULT_DRIVE = { enabled: false, frequency: 'daily', keep: 10 };
export const driveSettings = (settings) => ({ ...DEFAULT_DRIVE, ...(settings?.driveBackup ?? {}) });

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

/**
 * An access token for Drive. `interactive: false` never shows anything and
 * throws { code: 'consent-required' } when a tap is needed.
 */
export async function driveToken({ interactive = true, hint } = {}) {
  const need = () => Object.assign(new Error('Tap “Back up now” to connect Google Drive.'), { code: 'consent-required' });
  if (platform === 'android') {
    try {
      const r = await GoogleDrive.authorize({ interactive });
      return r.accessToken;
    } catch (err) {
      if (err?.code === 'consent-required') throw need();
      if (err?.code === 'cancelled') throw Object.assign(new Error('Google Drive access was not given.'), { code: 'cancelled' });
      throw err;
    }
  }
  const c = cached();
  if (c) return c;
  if (platform === 'desktop') {
    let rt = null;
    try { rt = localStorage.getItem(DESKTOP_RT_KEY); } catch { /* storage unavailable */ }
    if (rt) {
      try { const r = await desktopRefresh(rt); return remember(r.access_token, r.expires_in); } catch (err) {
        if (err.code !== 'invalid_grant') throw err;
        try { localStorage.removeItem(DESKTOP_RT_KEY); } catch { /* storage unavailable */ }
      }
    }
    if (!interactive) throw need();
    const r = await desktopOAuth({ scope: `openid email ${DRIVE_SCOPE}`, extra: { access_type: 'offline', prompt: 'consent', ...(hint ? { login_hint: hint } : {}) } });
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
        client_id: WEB_CLIENT_ID, scope: DRIVE_SCOPE, hint,
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(remember(r.access_token, Number(r.expires_in) || 3500))),
        error_callback: (e) => reject(Object.assign(new Error(e?.type === 'popup_closed' ? 'Google Drive access was not given (the Google window was closed — if it said “Access blocked”, the app’s Google sign-in isn’t fully set up yet).' : (e?.message || 'Google sign-in failed.')), { code: 'cancelled' })),
      });
      client.requestAccessToken({ prompt: '' });
    });
  }
  // No web client configured: Google accounts can grant Drive through a Firebase re-auth popup
  const user = auth?.currentUser;
  if (!user?.providerData?.some((p) => p.providerId === 'google.com')) {
    throw Object.assign(new Error('Drive backup on the website needs a Google account here. Use the Android or desktop app, or sign in with Google.'), { code: 'unsupported' });
  }
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
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

async function folderId(token) {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await (await api(token, `/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  if (found.files?.[0]) return found.files[0].id;
  const made = await (await api(token, '/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', description: 'Backups made by the Expense Tracker app. Restore one from the app: Profile → Google Drive backup.' }),
  })).json();
  return made.id;
}

export async function listBackups(token) {
  const id = await folderId(token);
  const q = encodeURIComponent(`'${id}' in parents and trashed=false and mimeType='application/json'`);
  const r = await (await api(token, `/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)&pageSize=100`)).json();
  return { folderId: id, files: r.files ?? [] };
}

export async function downloadBackup(token, fileId) {
  return (await api(token, `/files/${fileId}?alt=media`)).text();
}

async function upload(token, parent, name, text) {
  const boundary = `et${Math.random().toString(36).slice(2)}`;
  const meta = { name, parents: [parent], mimeType: 'application/json', appProperties: { app: 'expensetracker', kind: 'backup' } };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  return (await api(token, UPLOAD, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
}

/* ── Backup state (shared by your devices, so one backs up per period) ── */
const stateRef = (uid) => doc(db, 'users', uid, 'drive_backup', 'state');
export function subscribeBackupState(uid, cb) {
  return onSnapshot(stateRef(uid), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
}

/**
 * Back up now: export everything, upload, keep the newest `keep`.
 * Returns the new file. Throws (code 'consent-required' when not interactive).
 */
export async function backupNow({ uid, email, keep = DEFAULT_DRIVE.keep, interactive = true, deviceName }) {
  const token = await driveToken({ interactive, hint: email });
  const data = await exportAllUserData(uid, email);
  const text = JSON.stringify(data);
  const { folderId: parent, files } = await listBackups(token);
  const file = await upload(token, parent, backupFileName(), text);
  const old = backupsToPrune([file, ...files], keep);
  await Promise.all(old.map((f) => api(token, `/files/${f.id}`, { method: 'DELETE' }).catch(() => {})));
  await setDoc(stateRef(uid), { lastAt: Date.now(), lastFile: { id: file.id, name: file.name, size: Number(file.size) || text.length }, lastDevice: deviceName ?? null, error: null }, { merge: true });
  return file;
}

export function noteBackupError(uid, message) {
  return setDoc(stateRef(uid), { error: { message, at: Date.now() } }, { merge: true }).catch(() => {});
}

export const folderUrl = (id) => `https://drive.google.com/drive/folders/${id}`;
