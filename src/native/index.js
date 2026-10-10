// ─── Native bridge ───────────────────────────────────────────────
// One API over the three shells the same web app runs in:
//   web      — browser / installed PWA (GitHub Pages)
//   android  — Capacitor app
//   desktop  — Tauri app (macOS, Windows, Linux)
// Each call reports what it actually did, so the UI never claims more
// than happened (e.g. a status-bar colour only exists on Android).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { invoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 'web' | 'android' | 'ios' | 'desktop' */
export const platform = isTauri ? 'desktop' : Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
export const isNative = platform !== 'web';

/* Our own Android plugin (android/…/SystemThemePlugin.java) */
const SystemTheme = registerPlugin('SystemTheme');

/* Matches glass.css --backdrop-base, so the system bars blend with the app. */
const BAR = { light: '#E4E5EA', monoflow: '#040405' };

/** Android: colour behind the status/navigation bars + icon contrast for the theme. Returns true if applied. */
export async function setStatusBarTheme(theme) {
  if (platform !== 'android') return false;
  try {
    const { applied } = await SystemTheme.apply({ color: BAR[theme] ?? BAR.light, dark: theme === 'monoflow' });
    return !!applied;
  } catch { return false; }
}

/**
 * Android hardware back. `handler()` returns true when it handled the press
 * (closed a dialog, went to the home tab); otherwise the app is sent to the
 * background — never quit, so it reopens instantly where it was.
 * Returns an unsubscribe function.
 */
export function onBackButton(handler) {
  if (platform !== 'android') return () => {};
  const sub = CapApp.addListener('backButton', () => {
    if (!handler()) CapApp.minimizeApp();
  });
  return () => { sub.then((s) => s.remove()); };
}

/** App version: the native app's own, or the web build's. */
export async function appVersion() {
  try {
    if (platform === 'android') return (await CapApp.getInfo()).version;
    if (platform === 'desktop') return await invoke('app_version');
  } catch { /* fall through */ }
  return import.meta.env.VITE_APP_VERSION ?? 'web';
}


/** Desktop: start with the computer (quietly, in the tray). Returns the state in effect. */
export const autostart = {
  available: platform === 'desktop',
  get: () => (platform === 'desktop' ? invoke('get_autostart').catch(() => false) : Promise.resolve(false)),
  set: (on) => (platform === 'desktop' ? invoke('set_autostart', { on }).catch(() => false) : Promise.resolve(false)),
};

/** The web engine the app runs in (Android: Android System WebView). */
export const engineVersion = (() => {
  const m = typeof navigator !== 'undefined' && /Chrome\/(\d+)/.exec(navigator.userAgent);
  return m ? Number(m[1]) : null;
})();
/* Android System WebView older than this paints glitches (stale "ghost"
   copies after scrolling) and is slower; it updates through the Play Store. */
export const OLD_WEBVIEW = 130;
export const webviewOutdated = platform === 'android' && engineVersion != null && engineVersion < OLD_WEBVIEW;
export const WEBVIEW_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview';
