// ─── Payment capture (Android) ────────────────────────────────────
// Bridge to PaymentCapturePlugin / PaymentListenerService. Elsewhere
// (web, desktop) everything here is a harmless no-op.
import { registerPlugin } from '@capacitor/core';
import { platform } from './index';

const Native = registerPlugin('PaymentCapture');
export const captureSupported = platform === 'android';

const off = { enabled: false, allowed: false };
// An app installed before 3.13 has no native side for this yet
const missing = { ...off, missing: true };
/** This install can capture: an app from 3.13 on, and a build that has the
    listener (the Play Store build — the website APK leaves it out, since Play
    Protect blocks sideloaded apps that read notifications). 3.13.0 didn't
    report `available`; it had the listener. */
export const captureUsable = (s) => !s.missing && s.available !== false;
export const captureStatus = () => (captureSupported ? Native.status().catch(() => missing) : Promise.resolve(off));
export const setCaptureEnabled = (enabled) => (captureSupported ? Native.setEnabled({ enabled }).catch(() => off) : Promise.resolve(off));
/** Bank SMS on/off (Play build). Turning it on shows Android's SMS permission prompt once; `denied` when refused. */
export const setSmsCapture = (enabled) => (captureSupported ? Native.setSms({ enabled }).catch(() => off) : Promise.resolve(off));
export const openAppSettings = () => (captureSupported ? Native.openAppSettings().catch(() => {}) : Promise.resolve());
export const openCaptureSettings = () => (captureSupported ? Native.openSettings().catch(() => {}) : Promise.resolve());
export const capturedNotifications = () => (captureSupported ? Native.pending().then((r) => r.items ?? []).catch(() => []) : Promise.resolve([]));
export const forgetCaptured = (ids) => (captureSupported && ids.length ? Native.remove({ ids }).catch(() => {}) : Promise.resolve());

/** Live: a payment notification arrived while the app is open. */
export function onCaptured(fn) {
  if (!captureSupported) return () => {};
  const h = Native.addListener('payment', fn);
  return () => { Promise.resolve(h).then((x) => x?.remove?.()); };
}

/** True when this app was installed from the Google Play Store. */
let playInstall = null;
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.thrishank.expensetracker';
export async function installedFromPlay() {
  if (platform !== 'android') return false;
  if (playInstall === null) playInstall = await Native.installSource().then((r) => !!r.play).catch(() => false);
  return playInstall;
}
