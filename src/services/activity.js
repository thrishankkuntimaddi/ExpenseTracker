// ─── Usage activity (for the app's owner) ────────────────────────
// user_activity/{uid}: a tiny record each app keeps about its OWN account —
//   email, name, createdAt, lastOpenedAt, lastEntryAt, entries (a count),
//   opens, platform, version.
// No amounts, names of entries or anything else from your money: only that
// you use the app and when. Only you can write yours; only the owner's
// account can read them (firestore.rules). Shown in Profile → Admin sees.
import { doc, setDoc, getDocs, collection, deleteDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { platform } from '../native';

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

/** On opening the app (with data loaded): who, when, how many entries. */
export async function recordOpen(user, { entries, lastEntryAt }) {
  if (!db || !user?.uid) return;
  if (Date.now() - since(user.uid, 'open') < OPEN_EVERY) return;
  mark(user.uid, 'open');
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
  }, { merge: true });
}

/** After adding entries: the new count and the time. */
export async function recordEntry(user, entries, lastEntryAt) {
  if (!db || !user?.uid) return;
  if (Date.now() - since(user.uid, 'entry') < ENTRY_EVERY) return;
  mark(user.uid, 'entry');
  await setDoc(doc(db, COLL, user.uid), { lastEntryAt: lastEntryAt ?? Date.now(), entries: Math.max(0, Math.round(entries || 0)), lastOpenedAt: Date.now() }, { merge: true });
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
export async function askAccount(uid, state, note) {
  const data = { state, requestedAt: Date.now(), ...(note ? { note: String(note).slice(0, 300) } : {}) };
  await setDoc(doc(db, 'account_admin', uid), data, { merge: true });
  return data;
}
