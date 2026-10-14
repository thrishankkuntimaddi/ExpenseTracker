// ─── Notifier: the app's only server-side job ────────────────────
// Runs every ~10 minutes from GitHub Actions (.github/workflows/notifier.yml),
// free on the Firebase Spark plan. It decides nothing about anyone's money —
// it only delivers what the apps already wrote:
//
//   1. Website reminders. Each app uploads its reminder plan to
//      users/{uid}/push_plan/current; due items are pushed to that account's
//      browsers that turned reminders on (push_tokens with reminders: true).
//      Android and desktop apps schedule their own and are never sent these.
//   2. Security alerts. New users/{uid}/security_events (wrong PINs, lock
//      changes) are pushed to the account's other devices and emailed to
//      the account's address (when SMTP is configured).
//
// Environment:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON (required)
//   SMTP_URL                  e.g. smtps://you%40gmail.com:app-password@smtp.gmail.com:465 (optional)
//   MAIL_FROM                 "Expense Tracker <you@gmail.com>" (optional)
//   APP_URL                   link in emails (default: the GitHub Pages site)
//   DRY_RUN=1                 log only
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

const DRY = process.env.DRY_RUN === '1';
const APP_URL = process.env.APP_URL || 'https://thrishankkuntimaddi.github.io/ExpenseTracker/';
const LATE_LIMIT = 3 * 3600e3;      // a reminder more than 3 h late is dropped, not sent stale
const ALERT_TYPES = new Set(['wrong_pins', 'locked_out', 'lock_off', 'pin_reset_started']);

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.log('FIREBASE_SERVICE_ACCOUNT is not set — nothing to do.'); process.exit(0); }
initializeApp({ credential: cert(JSON.parse(sa)) });
const db = getFirestore();
const fcm = getMessaging();

const now = Date.now();
const stats = { plans: 0, reminders: 0, alerts: 0, emails: 0, dropped: 0, badTokens: 0 };

/* ── helpers ── */
const uidOf = (ref) => ref.parent.parent.id;

async function tokensFor(uid, pick) {
  const snap = await db.collection('users').doc(uid).collection('push_tokens').get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })).filter((t) => t.token && pick(t));
}

/** Send one message to several tokens; forget tokens that are gone. */
async function push(tokens, { title, body, route, tag, type }) {
  if (!tokens.length) return 0;
  const data = { title, body, route: route ?? 'today', tag: tag ?? type ?? 'et', type: type ?? 'reminder' };
  if (DRY) { console.log('[dry] push', tokens.length, data); return tokens.length; }
  const res = await fcm.sendEach(tokens.map((t) => (t.platform === 'android'
    ? { token: t.token, notification: { title, body }, data, android: { priority: 'high', notification: { channelId: type === 'security' ? 'security' : 'reminders_alert', tag: data.tag } } }
    : { token: t.token, data, webpush: { headers: { Urgency: 'high', TTL: '3600' } } })));
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error?.code ?? '';
    if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
      stats.badTokens++;
      return tokens[i].ref.delete().catch(() => {});
    }
    return null;
  }));
  return res.successCount;
}

/* ── 1. Website reminders ── */
async function reminders() {
  let docs;
  try {
    docs = (await db.collectionGroup('push_plan').where('nextAt', '<=', now).get()).docs;
  } catch (err) {
    // The collection-group index isn't deployed yet (firestore.indexes.json): read them all
    console.warn('push_plan query needs its index; scanning instead:', err.message);
    docs = (await db.collectionGroup('push_plan').get()).docs.filter((d) => (d.data().nextAt ?? Infinity) <= now);
  }
  for (const doc of docs) {
    stats.plans++;
    const plan = doc.data();
    const uid = uidOf(doc.ref);
    const sentUpTo = plan.sentUpTo ?? now - LATE_LIMIT;
    const due = (plan.items ?? []).filter((i) => i.at > sentUpTo && i.at <= now);
    const fresh = due.filter((i) => now - i.at <= LATE_LIMIT);
    stats.dropped += due.length - fresh.length;
    if (fresh.length) {
      const tokens = await tokensFor(uid, (t) => t.platform === 'web' && t.reminders);
      for (const item of fresh) stats.reminders += await push(tokens, { ...item, tag: `reminder-${item.type}` });
    }
    const later = (plan.items ?? []).filter((i) => i.at > now).map((i) => i.at);
    if (!DRY) await doc.ref.update({ sentUpTo: now, nextAt: later.length ? Math.min(...later) : 8.64e15 });
  }
}

/* ── 2. Security alerts ── */
let mailer = null;
async function mail(to, subject, text) {
  if (!process.env.SMTP_URL || !to) return false;
  if (DRY) { console.log('[dry] mail', to, subject); return true; }
  if (!mailer) {
    const { default: nodemailer } = await import('nodemailer');
    mailer = nodemailer.createTransport(process.env.SMTP_URL);
  }
  await mailer.sendMail({ from: process.env.MAIL_FROM || 'Expense Tracker', to, subject, text });
  return true;
}

function describe(e) {
  switch (e.type) {
    case 'wrong_pins': return { title: `${e.count} wrong PINs on ${e.device}`, body: 'Someone may be trying to open your Expense Tracker. If it wasn’t you, lock or sign out that device from Profile → Security.' };
    case 'locked_out': return { title: `Expense Tracker locked on ${e.device}`, body: 'Too many wrong PINs — it now needs your account sign-in to open. If it wasn’t you, sign that device out from Profile → Security.' };
    case 'lock_off': return { title: 'App lock was turned off', body: `On ${e.device}. If it wasn’t you, turn it back on and change your PIN.` };
    case 'pin_reset_started': return { title: 'Your app lock PIN is being reset', body: `Someone signed in again on ${e.device} to choose a new PIN. If it wasn’t you, change your account password.` };
    default: return null;
  }
}

async function alerts() {
  let docs;
  try {
    docs = (await db.collectionGroup('security_events').where('notified', '==', false).get()).docs;
  } catch (err) {
    console.warn('security_events query needs its index; scanning instead:', err.message);
    docs = (await db.collectionGroup('security_events').get()).docs.filter((d) => d.data().notified === false);
  }
  for (const doc of docs) {
    const e = doc.data();
    const uid = uidOf(doc.ref);
    const text = ALERT_TYPES.has(e.type) && now - (e.at ?? 0) < 24 * 3600e3 ? describe(e) : null;
    if (text) {
      const tokens = await tokensFor(uid, (t) => t.security !== false && t.id !== e.deviceId);
      stats.alerts += await push(tokens, { ...text, route: 'profile', type: 'security', tag: `security-${doc.id}` });
      let email = null;
      try { email = (await getAuth().getUser(uid)).email; } catch { /* account gone */ }
      const when = new Date(e.at).toUTCString();
      if (await mail(email, `Expense Tracker: ${text.title}`, `${text.body}\n\nWhen: ${when}\nDevice: ${e.device}\n\nOpen the app: ${APP_URL}\n\nYou get this because app lock is on for your Expense Tracker account.`)) stats.emails++;
    }
    if (!DRY) await doc.ref.update({ notified: true, notifiedAt: FieldValue.serverTimestamp() });
  }
}

try {
  await reminders();
  await alerts();
  console.log('done', JSON.stringify(stats));
} catch (err) {
  console.error(err);
  process.exit(1);
}
