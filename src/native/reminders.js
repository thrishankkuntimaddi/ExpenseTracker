// ─── Reminders: delivery ─────────────────────────────────────────
//   android  OS-scheduled local notifications — fire even when the app is
//            closed. LOW-importance channel: no sound, no pop-up.
//   desktop  handed to the app's own scheduler (src-tauri/src/reminders.rs),
//            which keeps running from the menu bar / system tray.
//   web      only while the page is open — browsers can't schedule offline.
// Reminder settings sync across devices; whether THIS device delivers them
// is a per-device switch, so they don't arrive everywhere at once.
import { LocalNotifications } from '@capacitor/local-notifications';
import { invoke } from '@tauri-apps/api/core';
import { platform } from './index';
import { buildSchedule, previewReminder } from '../utils/reminders';

const DEVICE_KEY = 'et_reminders_device';      // 'on' | 'off'
const BUDGET_KEY = 'et_budget_alerts';         // { 'YYYY-MM:80': epochMs }
const CHANNEL = 'reminders';
const HOLD_MS = 15 * 60 * 1000;                // nothing this soon while the app is on screen

const isAndroid = platform === 'android';

/** What this platform can honestly do — shown in Settings. */
export const DELIVERY_NOTE = {
  android: 'Quiet notifications (no sound), even when the app is closed.',
  desktop: 'Shown by the app from the menu bar / system tray — keep it running (turn on “Open at login”).',
  web: 'Only while this page is open — browsers can’t notify you later. Install the Android or desktop app for reminders that always arrive.',
  ios: 'Only while the web app is open.',
}[platform];

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const deviceDelivery = {
  get: () => read(DEVICE_KEY, 'off') === 'on',
  set: (on) => { write(DEVICE_KEY, on ? 'on' : 'off'); syncReminders(); },
};

/* ── Permission ─────────────────────────────────────────────── */
export async function notificationPermission() {
  if (isAndroid) {
    const p = await LocalNotifications.checkPermissions().catch(() => null);
    return !p ? 'unsupported' : p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  }
  if (platform === 'desktop') return 'granted';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestNotificationPermission() {
  if (isAndroid) {
    const p = await LocalNotifications.requestPermissions().catch(() => null);
    return p?.display === 'granted' ? 'granted' : 'denied';
  }
  if (platform === 'desktop') return 'granted';
  if (typeof Notification === 'undefined') return 'unsupported';
  const p = await Notification.requestPermission();
  return p === 'default' ? 'prompt' : p;
}

/* ── Delivery ───────────────────────────────────────────────── */
let channelReady = false;
async function ensureChannel() {
  if (!isAndroid || channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL, name: 'Reminders', importance: 2, // LOW: no sound, no pop-up
    description: 'Gentle spending reminders', vibration: false, visibility: 1,
  }).catch(() => {});
  channelReady = true;
}

const toAndroid = (item) => ({
  id: item.id,
  title: item.title,
  body: item.body,
  schedule: { at: new Date(item.at), allowWhileIdle: true },
  // Inexact is fine for a reminder and, unlike an exact alarm, never sends
  // the user to the "Alarms & reminders" settings screen.
  isExactNotification: false,
  channelId: CHANNEL,
  smallIcon: 'ic_stat_expensetracker',
  iconColor: '#12995A',
  autoCancel: true,
  extra: { route: item.route },
});

let tapHandler = null;
/** Called with the screen to open ('today' | 'plan' | 'stats') when a reminder is tapped. */
export const onReminderTap = (fn) => { tapHandler = fn; };

const busyInApp = () => typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();

function showWeb(item, { force = false } = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  if (!force && busyInApp()) return false;           // never while the user is in the app
  const opts = { body: item.body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: `reminder-${item.type}`, silent: true, data: { route: item.route } };
  const plain = () => {
    const n = new Notification(item.title, opts);
    n.onclick = () => { window.focus(); tapHandler?.(item.route); n.close(); };
  };
  // Prefer the service worker (works for installed PWAs on Android); without
  // one (dev, some browsers) fall back to a plain Notification.
  const getReg = navigator.serviceWorker?.getRegistration?.();
  if (!getReg) { plain(); return true; }
  getReg.then((reg) => (reg ? reg.showNotification(item.title, opts) : plain())).catch(plain);
  return true;
}

/** Send one right now (the "Send a test" button). Returns true if handed to the OS. */
export async function sendTest(type, cfg, data) {
  const p = previewReminder(type, cfg, data);
  const item = { ...p, id: 999001, at: Date.now() + 1500, route: p.route ?? 'today', type };
  if (isAndroid) {
    if ((await notificationPermission()) !== 'granted') return false;
    await ensureChannel();
    // No schedule = shown right away (an inexact alarm could take minutes)
    const { schedule: _later, ...now } = toAndroid(item);
    await LocalNotifications.schedule({ notifications: [now] });
    return true;
  }
  if (platform === 'desktop') return invoke('show_notification', { title: item.title, body: item.body }).then(() => true, () => false);
  return showWeb(item, { force: true });
}

/* ── Planning + handing over ─────────────────────────────────── */
let input = null;           // { cfg, data } from the app
let webTimers = [];
let syncing = null, again = false;

/** The latest plan (for the Settings "next reminder" line). */
export let lastPlan = [];

export function updateReminderInput(next) { input = next; return syncReminders(); }

export function syncReminders() {
  if (syncing) { again = true; return syncing; }
  syncing = (async () => {
    try {
      const enabled = deviceDelivery.get() && input;
      const now = Date.now();
      const budgetAt = read(BUDGET_KEY, {});
      let items = enabled ? buildSchedule(now, input.cfg, { ...input.data, budgetAt }) : [];
      // Remember when each budget alert was planned so it fires exactly once
      const nextBudget = { ...budgetAt };
      items.filter((i) => i.type === 'budget' && nextBudget[i.key] == null).forEach((i) => { nextBudget[i.key] = i.at; });
      if (JSON.stringify(nextBudget) !== JSON.stringify(budgetAt)) write(BUDGET_KEY, nextBudget);
      // While the app is on screen, hold anything about to fire (re-planned on leaving)
      if (isAndroid && typeof document !== 'undefined' && document.visibilityState === 'visible') items = items.filter((i) => i.at > now + HOLD_MS);
      lastPlan = items;

      if (isAndroid) {
        const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
        if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) }).catch(() => {});
        if (items.length && (await notificationPermission()) === 'granted') {
          await ensureChannel();
          await LocalNotifications.schedule({ notifications: items.map(toAndroid) });
        }
      } else if (platform === 'desktop') {
        await invoke('set_reminders', { items: items.map(({ id, at, title, body }) => ({ id, at, title, body })) }).catch(() => {});
      } else {
        webTimers.forEach(clearTimeout);
        webTimers = items.filter((i) => i.at - now < 24 * 3600e3).map((i) => setTimeout(() => showWeb(i), i.at - now));
      }
    } catch (err) {
      console.warn('[reminders] sync failed (will retry on the next change):', err);
    } finally {
      syncing = null;
      if (again) { again = false; syncReminders(); }
    }
  })();
  return syncing;
}

/* ── Wiring (once) ──────────────────────────────────────────── */
let wired = false;
export function initReminders() {
  if (wired) return; wired = true;
  if (isAndroid) {
    LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const route = e.notification?.extra?.route;
      if (route) tapHandler?.(route);
    });
  }
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'reminder-tap') tapHandler?.(e.data.route);
  });
  // Leaving / returning: re-plan (Android drops its hold; a new day starts)
  document.addEventListener('visibilitychange', () => syncReminders());
}
