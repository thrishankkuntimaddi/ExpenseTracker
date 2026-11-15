// ─── Links that open the app ─────────────────────────────────────
// A trip invite is https://<web app>/join?trip=<id>. On a phone with the
// Android app installed, Android hands that link straight to the app (App
// Links: AndroidManifest.xml + /.well-known/assetlinks.json on the website).
// Without the app it simply opens the website, which works the same.
// The website also offers "Open in the app" (an intent:// link that falls
// back to the website) for phones where Android didn't verify the link.
//
// In the app, the link arrives as appUrlOpen (while running) or as the
// launch URL (cold start). Either way the invite is kept like a web one
// (trips/invite) and an "et:invite" event takes the app to Trips.
import { App as CapApp } from '@capacitor/app';
import { isNative, platform } from './index';
import { parseInvite, rememberInvite } from '../features/trips/invite';

export const ANDROID_PACKAGE = 'com.thrishank.expensetracker';

function handle(url) {
  const id = parseInvite(url ?? '');
  if (!id) return;
  rememberInvite(id);
  window.dispatchEvent(new CustomEvent('et:invite', { detail: id }));
}

export function initDeepLinks() {
  if (!isNative || platform === 'desktop') return;
  try {
    CapApp.getLaunchUrl?.().then((r) => handle(r?.url)).catch(() => {});
    CapApp.addListener('appUrlOpen', ({ url }) => handle(url));
  } catch { /* an older app without the plugin */ }
}

/** Website on Android: an intent link that opens the app, or stays on the website if it isn't installed. */
export function openInAppUrl(tripId) {
  const back = typeof window !== 'undefined' ? window.location.href : '';
  return `intent://join?trip=${encodeURIComponent(tripId)}#Intent;scheme=expensetracker;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(back)};end`;
}

export const isAndroidBrowser = () => !isNative && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
