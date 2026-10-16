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
//      changes, a sign-in on a new device) are pushed to the account's other
//      devices and emailed to the account's address (when SMTP is
//      configured) — once per event, see alerts().
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
const ALERT_TYPES = new Set(['wrong_pins', 'locked_out', 'lock_off', 'pin_reset_started']);   // + new_device (see alerts)

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
    if (/registration-token-not-registered|invalid-registration-token/.test(code)) {   // not invalid-argument: that is a payload problem, the token is fine
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

/* ── 2. Security alerts ──
   At most one email (and one push) per real event, ever:
   • an event is claimed ("sending") in a transaction before anything is
     sent, so a crash, timeout or overlapping run can't send it twice
   • answered already in the app ("It was me", Lock, Sign out) → not sent
   • one incident, one email: "5 wrong PINs" followed by "locked" — and the
     PIN reset that follows a lockout — go out as a single email
   • no more than one email of a kind per account per hour
   • a send that fails is retried on the next runs, three times at most */
const STALE_AFTER = 72 * 3600e3;    // GitHub can pause schedules; older than this isn't news
const INCIDENT_MS = 2 * 3600e3;
const MAIL_GAP_MS = 3600e3;
let mailer = null;
async function mail(to, { subject, text, html, id }) {
  if (!process.env.SMTP_URL || !to) return false;
  if (DRY) { console.log('[dry] mail', to, subject); return true; }
  if (!mailer) {
    const { default: nodemailer } = await import('nodemailer');
    // Short timeouts: a send must never outlive the 5-minute job (and be resent)
    const url = new URL(process.env.SMTP_URL);
    url.searchParams.set('connectionTimeout', '10000');
    url.searchParams.set('greetingTimeout', '10000');
    url.searchParams.set('socketTimeout', '20000');
    mailer = nodemailer.createTransport(url.toString());
  }
  await mailer.sendMail({ from: process.env.MAIL_FROM || 'Expense Tracker', to, subject, text, html, messageId: `<${id}@expensetracker.app>` });
  return true;
}

function describe(e) {
  switch (e.type) {
    case 'wrong_pins': return { title: `${e.count ?? 'Several'} wrong PINs on ${e.device}`, body: 'Someone may be trying to open your Expense Tracker on that device.', act: 'If it wasn’t you, lock or sign out that device from Profile → Security.' };
    case 'locked_out': return { title: `Expense Tracker locked on ${e.device}`, body: 'Too many wrong PINs — it now needs your account sign-in to open.', act: 'If it wasn’t you, sign that device out from Profile → Security and change your password.' };
    case 'lock_off': return { title: 'App lock was turned off', body: `On ${e.device}.`, act: 'If it wasn’t you, turn it back on in Profile → Security and change your PIN.' };
    case 'pin_reset_started': return { title: 'Your app lock PIN is being reset', body: `Someone signed in again on ${e.device} to choose a new PIN.`, act: 'If it wasn’t you, change your account password.' };
    case 'new_device': return { title: 'New sign-in to your Expense Tracker', body: `${e.device ?? 'A new device'} signed in to your account for the first time.`, act: 'If it wasn’t you, sign it out from Profile → Security and change your password.' };
    default: return null;
  }
}
const ALERT_EMAIL_TYPES = new Set([...ALERT_TYPES, 'new_device']);

function emailOf(text, e, extra, tz) {
  const when = new Date(e.at).toLocaleString('en-IN', { timeZone: tz || 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const lines = [text.body, ...extra, '', `When: ${when}`, `Device: ${e.device ?? 'unknown'}`, '', text.act, 'If this was you, there’s nothing to do.', '', `Open Expense Tracker: ${APP_URL}`];
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a2e">
  <div style="font-size:13px;font-weight:700;color:#6d5df6;letter-spacing:.04em;text-transform:uppercase">Expense Tracker · Security</div>
  <h1 style="font-size:20px;margin:10px 0 12px">${esc(text.title)}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 6px">${esc(text.body)}</p>
  ${extra.map((x) => `<p style="font-size:15px;line-height:1.5;margin:0 0 6px">${esc(x)}</p>`).join('')}
  <table style="font-size:14px;color:#555;margin:14px 0"><tr><td style="padding:2px 12px 2px 0">When</td><td>${esc(when)}</td></tr><tr><td style="padding:2px 12px 2px 0">Device</td><td>${esc(e.device ?? 'unknown')}</td></tr></table>
  <p style="font-size:14px;line-height:1.5;margin:0 0 4px"><b>${esc(text.act)}</b></p>
  <p style="font-size:14px;color:#666;margin:0 0 20px">If this was you, there’s nothing to do.</p>
  <a href="${esc(APP_URL)}" style="display:inline-block;background:#6d5df6;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700;font-size:14px">Open Expense Tracker</a>
  <p style="font-size:12px;color:#999;margin-top:24px">Security emails are sent once per event, at most once an hour of each kind.</p></div>`;
  return { subject: `Expense Tracker: ${text.title}`, text: lines.join('\n'), html };
}

/** Claim the event for this run; false if another run (or an earlier one) has it. */
async function claim(ref) {
  return db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists || cur.data().notified !== false) return false;
    tx.update(ref, { notified: 'sending', claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

async function alerts() {
  let docs;
  try {
    docs = (await db.collectionGroup('security_events').where('notified', '==', false).get()).docs;
  } catch (err) {
    console.warn('security_events query needs its index; scanning instead:', err.message);
    docs = (await db.collectionGroup('security_events').get()).docs.filter((d) => d.data().notified === false);
  }
  // Per account, oldest first, so an incident is seen whole
  const byUid = new Map();
  docs.forEach((d) => { const uid = uidOf(d.ref); byUid.set(uid, [...(byUid.get(uid) ?? []), d]); });
  for (const [uid, list] of byUid) {
    list.sort((a, b) => (a.data().at ?? 0) - (b.data().at ?? 0));
    const events = list.map((d) => ({ ref: d.ref, id: d.id, ...d.data() }));
    const lockouts = events.filter((e) => e.type === 'locked_out');
    const metaRef = db.collection('users').doc(uid).collection('security').doc('notifier');
    let meta = {};
    try { meta = (await metaRef.get()).data() ?? {}; } catch { /* first time */ }
    let tz = null;
    try { tz = (await db.collection('users').doc(uid).collection('push_plan').doc('current').get()).data()?.tz ?? null; } catch { /* none */ }
    let email;
    for (const e of events) {
      const done = (fields) => (DRY ? null : e.ref.update(fields).catch(() => {}));
      try {
        const text = ALERT_EMAIL_TYPES.has(e.type) ? describe(e) : null;
        if (!text) { await done({ notified: true, notifiedAt: FieldValue.serverTimestamp(), skipped: 'not-emailed' }); continue; }
        if (now - (e.at ?? 0) > STALE_AFTER) { await done({ notified: 'stale' }); console.warn('dropped stale', e.id); continue; }
        if (e.dismissedAt) { await done({ notified: true, notifiedAt: FieldValue.serverTimestamp(), skipped: 'answered-in-app' }); continue; }
        // Part of a lockout in this batch: that email tells the whole story
        const lockout = e.type !== 'locked_out' && lockouts.find((l) => l.device === e.device && Math.abs((l.at ?? 0) - (e.at ?? 0)) < INCIDENT_MS);
        if (lockout && ['wrong_pins', 'pin_reset_started'].includes(e.type)) { await done({ notified: true, notifiedAt: FieldValue.serverTimestamp(), skipped: `merged:${lockout.id}` }); continue; }
        if (now - (meta.lastMail?.[e.type] ?? 0) < MAIL_GAP_MS) { await done({ notified: true, notifiedAt: FieldValue.serverTimestamp(), skipped: 'rate-limited' }); continue; }
        if (!DRY && !(await claim(e.ref))) continue;

        const extra = [];
        if (e.type === 'locked_out') {
          const reset = events.find((x) => x.type === 'pin_reset_started' && x.device === e.device && (x.at ?? 0) >= (e.at ?? 0) && x.at - e.at < INCIDENT_MS);
          if (reset) extra.push('Then someone signed in again on that device to choose a new PIN.');
        }
        if (!e.pushedAt) {
          const tokens = await tokensFor(uid, (t) => t.security !== false && t.id !== e.deviceId);
          stats.alerts += await push(tokens, { title: text.title, body: `${text.body} ${text.act}`, route: 'profile', type: 'security', tag: `security-${e.id}` });
          if (!DRY) await e.ref.update({ pushedAt: FieldValue.serverTimestamp() });
        }
        if (email === undefined) { try { email = (await getAuth().getUser(uid)).email ?? null; } catch { email = null; } }
        try {
          if (await mail(email, { ...emailOf(text, e, extra, tz), id: `${uid}-${e.id}` })) {
            stats.emails++;
            meta = { ...meta, lastMail: { ...(meta.lastMail ?? {}), [e.type]: now } };
            if (!DRY) await metaRef.set({ lastMail: { [e.type]: now } }, { merge: true });
          }
          await done({ notified: true, notifiedAt: FieldValue.serverTimestamp() });
        } catch (err) {
          const attempts = (e.attempts ?? 0) + 1;
          console.error('mail failed', e.id, err.message);
          await done({ notified: attempts >= 3 ? 'failed' : false, attempts, lastError: String(err.message).slice(0, 300) });
        }
      } catch (err) {
        console.error('alert failed', e.id, err.message);   // the next event still goes
      }
    }
  }
}

// Each part on its own: a failure in one (e.g. a quota error) must not stop the other
let failed = false;
for (const [name, run] of [['reminders', reminders], ['alerts', alerts]]) {
  try { await run(); } catch (err) { failed = true; console.error(`${name} failed:`, err); }
}
console.log('done', JSON.stringify(stats));
if (failed) process.exit(1);
