// ─── Cloud push (Firebase Cloud Messaging) ───────────────────────
// For what a device can't do on its own while the app is closed:
//   website / installed web app  reminders (browsers can't schedule them)
//   every device                 security alerts (wrong PINs elsewhere)
// The Android and desktop apps schedule their own reminders, so they only
// ask the cloud for security alerts — no doubled reminders.
//
// No server of ours decides anything: the app uploads its own reminder plan
// (users/{uid}/push_plan/current — what buildSchedule() already computed)
// and a small scheduled job (scripts/notifier/, GitHub Actions) sends
// whatever is due to this account's devices, and emails security alerts.
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import app, { db } from '../services/firebase';
import { platform } from './index';

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const PLAN_KEY = 'et_push_plan_hash';

/** Can this device receive cloud push at all? */
export const pushSupported = platform === 'android'
  || (platform === 'web' && !!VAPID && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);

async function webToken() {
  if (Notification.permission !== 'granted') return null;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const reg = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg });
}

async function androidToken() {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  const p = await FirebaseMessaging.checkPermissions();
  if (p.receive !== 'granted') return null;      // asked for with the reminders permission
  const { token } = await FirebaseMessaging.getToken();
  return token;
}

/**
 * Register (or refresh) this device for push. `reminders`: also send it
 * reminders (website only). Quietly does nothing if permission isn't given.
 */
export async function registerPush(uid, deviceId, { reminders = false } = {}) {
  if (!pushSupported || !uid || !db) return false;
  try {
    const token = platform === 'android' ? await androidToken() : await webToken();
    if (!token) return false;
    await setDoc(doc(db, 'users', uid, 'push_tokens', deviceId), {
      token, platform, reminders: platform === 'web' && reminders, security: true,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[push] registration failed:', err?.message);
    return false;
  }
}

export function unregisterPush(uid, deviceId) {
  if (!uid || !db) return Promise.resolve();
  return deleteDoc(doc(db, 'users', uid, 'push_tokens', deviceId)).catch(() => {});
}

/**
 * Upload the reminder plan (only when it changed). Items:
 * [{ id, at, title, body, route, type }] for the next days.
 */
export async function uploadPlan(uid, items) {
  if (!uid || !db) return;
  const plan = items.map(({ id, at, title, body, route, type }) => ({ id, at, title, body, route: route ?? 'today', type }));
  const hash = JSON.stringify(plan);
  try { if (localStorage.getItem(PLAN_KEY) === hash) return; } catch { /* storage unavailable */ }
  const nextAt = plan.length ? Math.min(...plan.map((i) => i.at)) : 8.64e15;
  await setDoc(doc(db, 'users', uid, 'push_plan', 'current'), { items: plan, nextAt, updatedAt: Date.now(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  try { localStorage.setItem(PLAN_KEY, hash); } catch { /* storage unavailable */ }
}
