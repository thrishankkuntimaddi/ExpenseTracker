// ─── Usage activity (for the app's owner) ────────────────────────
// user_activity/{uid}: a tiny record each app keeps about its OWN account —
//   email, name, createdAt, lastOpenedAt, lastEntryAt, entries (a count),
//   opens, platform, version.
// No amounts, names of entries or anything else from your money: only that
// you use the app and when. Only you can write yours; only the owner's
// account can read them (firestore.rules). Shown in Profile → Admin sees.
import { doc, setDoc, getDocs, collection, deleteDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { platform } from '../native';
import { getLang } from '../i18n';

const COLL = 'user_activity';
const OPEN_EVERY = 15 * 60 * 1000;    // count an "open" at most every 15 minutes
const ENTRY_EVERY = 60 * 1000;
const lastKey = (uid, kind) => `et_activity_${kind}_${uid}`;
const since = (uid, kind) => { try { return Number(localStorage.getItem(lastKey(uid, kind))) || 0; } catch { return 0; } };
const mark = (uid, kind) => { try { localStorage.setItem(lastKey(uid, kind), String(Date.now())); } catch { /* storage unavailable */ } };

const ms = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
};

/** When an entry was last added: its save time if known, else its date (never in the future). */
export function lastEntryTime(entries = [], now = Date.now()) {
  let best = 0;
  for (const e of entries) {
    const t = ms(e.createdAt) || ms(e.updatedAt) || Math.min(ms(e.date), now);
    if (t > best) best = t;
  }
  return best || null;
}

/** How they use the app — sign-in method, devices, switches. Never amounts or entries. */
function details(user, extra = {}) {
  const { devices, rules, theme, lockOn } = extra;
  const ids = user.providerData?.map((p) => p.providerId) ?? [];
  const out = {
    provider: ids.map((p) => (p === 'google.com' ? 'google' : p === 'password' ? 'email' : p)).join('+').slice(0, 40) || 'unknown',
    verified: !!user.emailVerified || ids.includes('google.com'),
    lang: String(getLang() ?? 'en').slice(0, 8),
  };
  if (Number.isFinite(devices)) out.devices = Math.max(0, Math.min(50, Math.round(devices)));
  if (Number.isFinite(rules)) out.rules = Math.max(0, Math.round(rules));
  if (typeof theme === 'string') out.theme = theme.slice(0, 12);
  if (typeof lockOn === 'boolean') out.lockOn = lockOn;
  // Which features are in use — counts and switches only (Admin sees → Insights).
  // Sent once the saved settings have loaded, so an empty start never reads as "wiped".
  if (Number.isFinite(extra.accounts)) out.accounts = Math.max(0, Math.min(99, Math.round(extra.accounts)));
  if (Number.isFinite(extra.goals)) out.goals = Math.max(0, Math.min(999, Math.round(extra.goals)));
  if (typeof extra.budget === 'boolean') out.budget = extra.budget;
  if (typeof extra.carry === 'boolean') out.carry = extra.carry;
  if (typeof extra.look === 'string') out.look = extra.look.slice(0, 12);
  if (Number.isFinite(extra.settingsKeys)) out.settingsKeys = Math.max(0, Math.min(999, Math.round(extra.settingsKeys)));
  return out;
}

const DETAILS_EVERY = 60 * 1000;
export async function recordDetails(user, extra) {
  if (!db || !user?.uid) return;
  if (Date.now() - since(user.uid, 'details') < DETAILS_EVERY) return;
  mark(user.uid, 'details');
  await setDoc(doc(db, COLL, user.uid), details(user, extra), { merge: true });
}

/** On opening the app (with data loaded): who, when, how many entries. */
export async function recordOpen(user, { entries, lastEntryAt, ...extra }) {
  if (!db || !user?.uid) return;
  if (Date.now() - since(user.uid, 'open') < OPEN_EVERY) return;
  mark(user.uid, 'open');
  // A new day it was opened on (this device's count; enough to see habits)
  const day = new Date().toDateString();
  let newDay = false;
  try { newDay = localStorage.getItem(lastKey(user.uid, 'day')) !== day; localStorage.setItem(lastKey(user.uid, 'day'), day); } catch { /* storage unavailable */ }
  const created = Date.parse(user.metadata?.creationTime ?? '') || null;
  await setDoc(doc(db, COLL, user.uid), {
    email: String(user.email ?? '').slice(0, 200),
    name: String(user.displayName ?? '').slice(0, 120),
    createdAt: created,
    lastOpenedAt: Date.now(),
    lastEntryAt: lastEntryAt ?? null,
    entries: Math.max(0, Math.round(entries || 0)),
    opens: increment(1),
    platform,
    version: String(import.meta.env.VITE_APP_VERSION ?? '').slice(0, 20),
    ...details(user, extra),
    ...(newDay ? { activeDays: increment(1) } : {}),
  }, { merge: true });
}

/** After adding entries: the new count and the time. */
export async function recordEntry(user, entries, lastEntryAt) {
  if (!db || !user?.uid) return;
  if (Date.now() - since(user.uid, 'entry') < ENTRY_EVERY) return;
  mark(user.uid, 'entry');
  await setDoc(doc(db, COLL, user.uid), { lastEntryAt: lastEntryAt ?? Date.now(), entries: Math.max(0, Math.round(entries || 0)), lastOpenedAt: Date.now() }, { merge: true });
}

const PROBLEM_EVERY = 60 * 1000;
/**
 * Something went wrong on this device (a save refused, a list that couldn't
 * load, a crash): count it on the person's activity so the owner sees who is
 * having trouble (Admin sees → Insights). Only a short code — never data.
 */
export async function recordProblem(kind, code) {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return;
  if (Date.now() - since(uid, 'problem') < PROBLEM_EVERY) return;
  mark(uid, 'problem');
  await setDoc(doc(db, COLL, uid), {
    errCount: increment(1), lastErrAt: Date.now(),
    lastErr: `${String(kind).slice(0, 12)}: ${String(code ?? '').slice(0, 100)}`.slice(0, 120),
  }, { merge: true }).catch(() => {});
}

/** Owner only (rules refuse anyone else). */
export async function listActivity() {
  const snap = await getDocs(collection(db, COLL));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function deleteActivity(uid) {
  if (!db || !uid) return;
  await deleteDoc(doc(db, COLL, uid));
}

/* ── Closing / restoring accounts (owner only; the notifier carries it out) ──
   account_admin/{uid}: { state, requestedAt, note?, …what the notifier reports } */
export async function listAccountAdmin() {
  const snap = await getDocs(collection(db, 'account_admin'));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

/** state: 'delete_requested' | 'restore_requested' | 'purge_requested' | 'cancelled' */
export async function askAccount(uid, state, note, { force = false } = {}) {
  const data = { state, requestedAt: Date.now(), force: !!force, ...(note ? { note: String(note).slice(0, 300) } : {}) };
  await setDoc(doc(db, 'account_admin', uid), data, { merge: true });
  return data;
}
