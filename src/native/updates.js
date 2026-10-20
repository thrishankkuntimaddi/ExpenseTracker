// ─── Updates ─────────────────────────────────────────────────────
// Nobody should have to reinstall to get fixes:
//   web      the service worker picks up each deploy (checked on open, when
//            the tab comes back, and every 30 min) and refreshes the offline
//            copy in the background. The page is never reloaded mid-use; the
//            new version runs the next time the app is opened.
//   android  over-the-air: every push to main publishes the app's web bundle
//            next to the website (/app/update.json + bundle zip). The app
//            downloads it in the background; it switches when the app is next
//            opened (during the splash), when it goes to the background, or
//            right away with "Restart now" — no reinstall. Only when a bundle
//            needs newer NATIVE code (minNativeBuild) does the user get
//            "install the new app".
//   desktop  Tauri's signed updater (GitHub release latest.json): downloads in
//            the background, then "Restart to update".
// After any update the app says once: "Updated to vX".
import { platform } from './index';
import { App as CapApp } from '@capacitor/app';
import { useSyncExternalStore } from 'react';
import { markQuickBoot } from '../app/quickBoot';

const PAGES = 'https://thrishankkuntimaddi.github.io/ExpenseTracker';
export const OTA_MANIFEST = import.meta.env.VITE_OTA_MANIFEST || `${PAGES}/app/update.json`;   // overridable for tests
// Installers are mirrored on the website (scripts/mirror-release.mjs): some
// networks crawl when downloading from github's file host
export const APK_URL = `${PAGES}/app/files/ExpenseTracker-Android.apk`;
export const THIS_BUILD = Number(import.meta.env.VITE_APP_BUILD) || 0;
export const THIS_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
const SEEN_KEY = 'et_seen_build';
const CHECK_EVERY_MS = 30 * 60 * 1000;
const CHECK_TIMEOUT_MS = 30 * 1000;          // a check that hangs longer is given up (and retried later)
const STUCK_MS = 15 * 60 * 1000;             // a download that never finishes doesn't block checks forever

/* ── Tiny store: what the update banner / Settings show ────────── */
// state.kind: 'idle' | 'checking' | 'current' | 'downloading' | 'ready' | 'native-needed' | 'error' | 'updated'
let state = { kind: 'idle', version: null, message: null };
const subs = new Set();
const set = (next) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
export const useUpdateState = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
export const dismissUpdateNote = () => set({ kind: 'current', message: null });

/** Pure: should this device take the published bundle? */
export function otaDecision(manifest, { build, nativeBuild }) {
  if (!manifest || !Number(manifest.build) || !manifest.url || !manifest.sha256) return 'invalid';
  if (Number(manifest.build) <= build) return 'current';
  if (Number(manifest.minNativeBuild || 0) > Number(nativeBuild || 0)) return 'native-needed';
  return 'download';
}

/**
 * Pure: the downloaded bundle to switch to — the newest one that is newer
 * than the running build and not marked failed. Bundle versions are
 * "<semver>-<build>" (see checkAndroid).
 */
export function pickPendingBundle(bundles = [], { build, currentId } = {}) {
  const buildOf = (b) => Number(String(b?.version ?? '').split('-').pop()) || 0;
  return bundles
    .filter((b) => b && b.status !== 'error' && b.id !== currentId && buildOf(b) > build)
    .sort((a, b) => buildOf(b) - buildOf(a))[0] ?? null;
}

/** Semver "3.2.0" → Android versionCode 30200 (matches android/app/build.gradle). */
export const versionCode = (v) => { const [a = 0, b = 0, c = 0] = String(v).split('.').map(Number); return a * 10000 + b * 100 + c; };

/* ── "Updated to vX" once after any update ─────────────────────── */
function announceIfUpdated() {
  let seen = null;
  try { seen = Number(localStorage.getItem(SEEN_KEY)) || null; localStorage.setItem(SEEN_KEY, String(THIS_BUILD)); } catch { return; }
  if (seen && THIS_BUILD > seen) set({ kind: 'updated', version: THIS_VERSION, message: `Updated to ${THIS_VERSION}` });
}

/* ── Android: over-the-air bundles ─────────────────────────────── */
// Capacitor plugin proxies answer every property — including `then` — so a
// plugin must never be the resolved value of a promise (await would call
// plugin.then() and fail). Hand it out wrapped.
let Updater = null;
async function updater() { Updater ??= (await import('@capgo/capacitor-updater')).CapacitorUpdater; return { u: Updater }; }

/** Call as early as possible on Android: confirms this bundle boots (else the plugin rolls back). */
export async function confirmBundleBoots() {
  if (platform !== 'android') return;
  try { const { u } = await updater(); await u.notifyAppReady(); } catch { /* plugin missing in old shells */ }
}

async function checkAndroid() {
  set({ kind: 'checking' });
  const manifest = await fetch(`${OTA_MANIFEST}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
  const nativeBuild = Number((await CapApp.getInfo()).build) || 0;   // versionCode of the installed APK
  const decision = otaDecision(manifest, { build: THIS_BUILD, nativeBuild });
  if (decision === 'current' || decision === 'invalid') return set({ kind: 'current' });
  if (decision === 'native-needed') {
    return set({ kind: 'native-needed', version: manifest.version, message: `Expense Tracker ${manifest.version} needs the new app — install it once, then updates arrive on their own again.` });
  }
  const { u } = await updater();
  const id = `${manifest.version}-${manifest.build}`;
  const { bundles } = await u.list();
  let bundle = bundles.find((b) => b.version === id && b.status !== 'error');
  if (!bundle) {
    set({ kind: 'downloading', version: manifest.version });
    bundle = await u.download({ url: manifest.url, version: id, checksum: manifest.sha256 });
  }
  // Switch when the app goes to the background (the plugin's own trigger).
  // That never fires when the app is swiped away or killed, so the next
  // launch also switches (applyDownloadedUpdate), and "Restart now" does it
  // immediately.
  await u.next({ id: bundle.id });
  pendingAndroid = bundle.id;
  set({ kind: 'ready', version: manifest.version, message: `Update ${manifest.version} is ready — restart now, or it switches the next time you open the app.` });
}

let pendingAndroid = null;
/**
 * Android, at launch: if a newer bundle was downloaded earlier but never
 * switched to (the app was closed by swiping it away), switch now — the
 * splash is still up. A bundle that fails to start is rolled back and
 * marked failed by the plugin, so this can't loop.
 */
async function applyDownloadedUpdate() {
  const { u } = await updater();
  const [{ bundles }, cur] = await Promise.all([u.list(), u.current()]);
  const pending = pickPendingBundle(bundles, { build: THIS_BUILD, currentId: cur?.bundle?.id });
  if (!pending) return false;
  markQuickBoot();                   // the restart below shouldn't replay the intro
  await u.set({ id: pending.id });   // reloads the app into the new bundle
  return true;
}

/* ── Desktop: Tauri updater ────────────────────────────────────── */
let pendingDesktop = null;
/** Give up on a promise that takes too long (a stalled network request). */
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error(`${what} timed out`), { code: 'timeout' })), ms); })])
    .finally(() => clearTimeout(t));
}

async function checkDesktop() {
  set({ kind: 'checking' });
  const { check } = await import('@tauri-apps/plugin-updater');
  // Endpoints: the website mirror first (fast everywhere), GitHub releases as a fallback
  const update = await withTimeout(check({ timeout: CHECK_TIMEOUT_MS }), CHECK_TIMEOUT_MS + 5000, 'Update check');
  if (!update) return set({ kind: 'current' });
  set({ kind: 'downloading', version: update.version });
  await update.download();
  pendingDesktop = update;
  set({ kind: 'ready', version: update.version, message: `Expense Tracker ${update.version} is ready.` });
}

/** Install the downloaded update and restart (desktop and Android). */
export async function restartToUpdate() {
  if (platform === 'android') {
    if (pendingAndroid) { const { u } = await updater(); markQuickBoot(); await u.set({ id: pendingAndroid }); }
    return;
  }
  if (!pendingDesktop) return;
  await pendingDesktop.install();
  markQuickBoot();
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

/* ── Web: service worker ───────────────────────────────────────── */
async function checkWeb() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  // Refreshes the offline copy in the background; the page is never reloaded
  // under you — the next time you open the app it is the new version
  await withTimeout(reg?.update?.() ?? Promise.resolve(), CHECK_TIMEOUT_MS, 'Update check').catch(() => {});
  set({ kind: 'current' });
}

/** Check now (Settings button, launch, every 30 min, coming back to the app). */
let busySince = 0;
export async function checkForUpdates() {
  // One check at a time — but a check stuck on a dead connection must not block the next one forever
  if ((state.kind === 'downloading' || state.kind === 'checking') && Date.now() - busySince < STUCK_MS) return state;
  busySince = Date.now();
  try {
    if (platform === 'android') await checkAndroid();
    else if (platform === 'desktop') await checkDesktop();
    else await checkWeb();
  } catch (err) {
    console.warn('[updates] check failed:', err);
    set({ kind: 'error', message: navigator.onLine === false ? 'You’re offline — will check again later.'
      : err?.code === 'timeout' ? 'The update server is slow to answer — will try again later.' : 'Couldn’t check for updates right now.' });
  }
  return state;
}

// Self-test hook in the apps (desktop selftest.js / Android tests drive real updates)
if (platform !== 'web' && typeof window !== 'undefined') window.__etUpdates = { checkForUpdates, restartToUpdate, state: () => state, build: THIS_BUILD };

let started = false;
export function startAutoUpdates() {
  if (started) return; started = true;
  announceIfUpdated();
  if (import.meta.env.DEV) return;           // never during development
  if (platform === 'android') {
    applyDownloadedUpdate().catch((err) => console.warn('[updates] could not switch to the downloaded update:', err));
  }
  let last = 0;
  const auto = () => {
    if (state.kind === 'ready' || state.kind === 'native-needed' || Date.now() - last < 10 * 60 * 1000) return;
    last = Date.now(); checkForUpdates();
  };
  setTimeout(auto, 5000);                    // after launch settles
  setInterval(auto, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(); });
}
