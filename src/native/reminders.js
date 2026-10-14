// ─── Reminders: delivery ─────────────────────────────────────────
//   android  OS-scheduled local notifications — fire even when the app is
//            closed. They pop up with a sound (or arrive quietly, a choice
//            per device), and can be set to arrive on the minute.
//   desktop  handed to the app's own scheduler (src-tauri/src/reminders.rs),
//            which keeps running from the menu bar / system tray.
//   web      only while the page is open — browsers can't schedule offline.
// Reminder settings sync across devices; whether THIS device delivers them
// is a per-device switch, so they don't arrive everywhere at once.
import { LocalNotifications } from '@capacitor/local-notifications';
import { invoke } from '@tauri-apps/api/core';
import { platform } from './index';
import { buildSchedule, previewReminder } from '../utils/reminders';
import { uploadPlan } from './push';

/* Signed-in account: the reminder plan is also uploaded for cloud push
   (website reminders while the page is closed — see native/push.js). */
let pushUid = null;
export function setPushUser(uid) { pushUid = uid; syncReminders(); }

const DEVICE_KEY = 'et_reminders_device';      // 'on' | 'off' (unset: on for the Android app)
const STYLE_KEY = 'et_reminders_style';        // 'alert' | 'quiet'
const EXACT_KEY = 'et_reminders_exact';        // 'on' | 'off'
const BUDGET_KEY = 'et_budget_alerts';         // { 'YYYY-MM:80': epochMs }
const QUIET_CHANNEL = 'reminders';             // LOW: no sound, no pop-up (Android can't change a channel later,
const ALERT_CHANNEL = 'reminders_alert';       // HIGH: pops up with a sound   so each style has its own)
const HOLD_MS = 15 * 60 * 1000;                // nothing this soon while the app is on screen

const isAndroid = platform === 'android';

/** What this platform can honestly do — shown in Settings. */
export const DELIVERY_NOTE = {
  android: 'Arrive even when the app is closed.',
  desktop: 'Shown by the app from the menu bar / system tray — keep it running (turn on “Open at login”).',
  web: 'Only while this page is open — browsers can’t notify you later. Install the Android or desktop app for reminders that always arrive.',
  ios: 'Only while the web app is open.',
}[platform];

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const deviceDelivery = {
  get: () => read(DEVICE_KEY, isAndroid ? 'on' : 'off') === 'on',
  set: (on) => { write(DEVICE_KEY, on ? 'on' : 'off'); syncReminders(); },
};

/** Pop up with a sound (default) or arrive quietly — per device. */
export const reminderStyle = {
  get: () => read(STYLE_KEY, 'alert'),
  set: (v) => { write(STYLE_KEY, v === 'quiet' ? 'quiet' : 'alert'); syncReminders(); },
};

/** Android: arrive on the minute (needs "Alarms & reminders" permission on Android 12+). */
export const exactTiming = {
  available: isAndroid,
  get: () => read(EXACT_KEY, 'off') === 'on',
  async set(on) {
    if (on && isAndroid) {
      const s = await LocalNotifications.checkExactNotificationSetting().catch(() => null);
      if (s && s.exact_alarm !== 'granted') {
        const after = await LocalNotifications.changeExactNotificationSetting().catch(() => null);
        if (after && after.exact_alarm !== 'granted') return false;
      }
    }
    write(EXACT_KEY, on ? 'on' : 'off');
    syncReminders();
    return true;
  },
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
    id: QUIET_CHANNEL, name: 'Quiet reminders', importance: 2, // LOW: no sound, no pop-up
    description: 'Spending reminders, without sound', vibration: false, visibility: 1,
  }).catch(() => {});
  await LocalNotifications.createChannel({
    id: ALERT_CHANNEL, name: 'Reminders', importance: 4,     // HIGH: heads-up with sound
    description: 'Bills due, daily log, budget and report reminders', vibration: true, visibility: 1, lights: true, lightColor: '#12995A',
  }).catch(() => {});
  await LocalNotifications.createChannel({
    id: 'security', name: 'Security alerts', importance: 5,
    description: 'Wrong PINs and lock changes on your other devices', vibration: true, visibility: 0,
  }).catch(() => {});
  channelReady = true;
}
const channel = () => (reminderStyle.get() === 'quiet' ? QUIET_CHANNEL : ALERT_CHANNEL);

const toAndroid = (item) => ({
  id: item.id,
  title: item.title,
  body: item.body,
  schedule: { at: new Date(item.at), allowWhileIdle: true },
  // Inexact unless "On time" is on (it needs the "Alarms & reminders"
  // permission; phones that deny it fall back to inexact automatically)
  isExactNotification: exactTiming.get(),
  channelId: channel(),
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

/** Show something right away (security alerts). */
export async function notifyNow({ id, title, body, route = 'profile' }) {
  const numeric = typeof id === 'number' ? id : Math.abs([...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1e9;
  try {
    if (isAndroid) {
      if ((await notificationPermission()) !== 'granted') return false;
      await ensureChannel();
      await LocalNotifications.schedule({ notifications: [{ id: numeric, title, body, channelId: 'security', smallIcon: 'ic_stat_expensetracker', iconColor: '#12995A', autoCancel: true, extra: { route } }] });
      return true;
    }
    if (platform === 'desktop') return await invoke('show_notification', { title, body }).then(() => true, () => false);
    return showWeb({ id: numeric, title, body, route, type: 'security' }, { force: true });
  } catch { return false; }
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
      const plan = input ? buildSchedule(now, input.cfg, { ...input.data, budgetAt }) : [];
      if (pushUid && input) uploadPlan(pushUid, plan).catch(() => {});
      let items = enabled ? plan : [];
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
