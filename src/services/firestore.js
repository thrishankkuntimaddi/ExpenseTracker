// ─── Firestore CRUD Layer ────────────────────────────────────────
import {
  doc, collection, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc,
  deleteField, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/* ── Document refs ── */
const userRef      = (uid)          => doc(db, "users", uid);
const txnsRef      = (uid)          => collection(db, "users", uid, "transactions");
const txnRef       = (uid, id)      => doc(db, "users", uid, "transactions", id);
const incRef       = (uid)          => collection(db, "users", uid, "income");
const incDocRef    = (uid, id)      => doc(db, "users", uid, "income", id);

/* ── Strip undefined values (Firestore rejects them) and normalise money ── */
const MONEY_FIELDS = ["amount", "wasteAmount", "settlement"];

export function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, MONEY_FIELDS.includes(k) && typeof v === "number" ? roundMoney(v) : v])
  );
}

/* Firestore batches are capped at 500 writes — commit in chunks. */
const BATCH_LIMIT = 450;
async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

/* ── Real-time listener ───────────────────────────────────────────
   Fires onData({ transactions[], income[], settings{} }) on change.
   Returns unsubscribe fn.
─────────────────────────────────────────────────────────────────── */
export function subscribeToUserData(uid, onData) {
  let txns     = [];
  let incomes  = [];
  let settings = {};

  function emit(source) {
    onData({ transactions: txns, income: incomes, settings, source });
  }

  // Transactions sub-collection
  const unsubTxns = onSnapshot(
    query(txnsRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit('transactions');
    },
    (err) => console.error("[Firestore] txns error", err)
  );

  // Income sub-collection
  const unsubInc = onSnapshot(
    query(incRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      incomes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit('income');
    },
    (err) => console.error("[Firestore] income error", err)
  );

  // User document (settings)
  const unsubUser = onSnapshot(
    userRef(uid),
    { includeMetadataChanges: false },
    (snap) => {
      if (!snap.exists()) return;
      settings = snap.data()?.settings || {};
      emit('settings');
    },
    (err) => console.error("[Firestore] user error", err)
  );

  return () => { unsubTxns(); unsubInc(); unsubUser(); };
}

/* ── Ensure user doc exists ──
   Called at sign-up and on every sign-in: older accounts were created
   without a user doc, which left their settings unsaveable. */
export async function ensureUserDoc(uid, email, defaultSettings = {}) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: email ?? null,
      createdAt: serverTimestamp(),
      settings: { theme: "light", googleSheetUrl: "", ...defaultSettings },
    }, { merge: true });
  }
}

/* ── Transactions ──
   Client ID is used as the Firestore document ID so that
   snapshot d.id === txn.id — no _clientId lookup needed.
─────────────────────────────────────────────────────────────────── */
export async function addTransaction(uid, txn) {
  const { id, ...data } = txn;
  await setDoc(txnRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() });
}

export async function updateTransaction(uid, txn) {
  const { id, wasteAmount, ...data } = txn;
  // Use deleteField() when wasteAmount is undefined so Firestore removes the field (not just skips it)
  await updateDoc(txnRef(uid, id), {
    ...clean(data),
    wasteAmount: wasteAmount === undefined ? deleteField() : roundMoney(wasteAmount),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTransaction(uid, txnId) {
  await deleteDoc(txnRef(uid, txnId));
}

/* ── Income ── */
export async function addIncome(uid, entry) {
  const { id, ...data } = entry;
  await setDoc(incDocRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() });
}

export async function updateIncome(uid, entry) {
  const { id, ...data } = entry;
  await updateDoc(incDocRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() });
}

export async function deleteIncome(uid, entryId) {
  await deleteDoc(incDocRef(uid, entryId));
}

/* ── Settings ── */
export async function updateSettings(uid, settings) {
  // setDoc+merge (not updateDoc) so this also works for accounts whose user
  // doc was never created, e.g. ones that predate ensureUserDoc().
  await setDoc(userRef(uid), { settings, updatedAt: serverTimestamp() }, { merge: true });
}

/* ── Bulk import ──
   Writes many transactions / income entries in batched commits (≤450 per
   batch). Uses set() so re-importing records with the same id overwrites
   instead of duplicating. Throws if any batch fails.
─────────────────────────────────────────────────────────────────── */
export async function bulkImport(uid, { transactions = [], income = [] }) {
  const ops = [
    ...transactions.map(({ id, ...data }) => (b) =>
      b.set(txnRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() })),
    ...income.map(({ id, ...data }) => (b) =>
      b.set(incDocRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() })),
  ];
  await commitInChunks(ops);
}

/* ── Delete ALL documents for a user (Reset All Data) ──
   Enumerates every ExpenseTracker subcollection and deletes all docs in
   batched commits. The client SDK has no collection-level delete.
─────────────────────────────────────────────────────────────────── */
export async function deleteAllUserData(uid) {
  const snaps = await Promise.all([
    getDocs(query(txnsRef(uid))),
    getDocs(query(incRef(uid))),
    getDocs(query(extRef(uid))),
    getDocs(query(recentlyDeletedRef(uid))),
    getDocs(query(recurringRef(uid))),
  ]);
  const ops = snaps.flatMap((snap) => snap.docs.map((d) => (b) => b.delete(d.ref)));
  await commitInChunks(ops);
}

/* ═══════════════════════════════════════════════════════════════════
   EXTERNAL TRANSACTIONS (Proxy / Billing ledger)
   Collection: users/{uid}/external_transactions
═══════════════════════════════════════════════════════════════════ */

/* ── Ref helpers ── */
const extRef    = (uid)     => collection(db, "users", uid, "external_transactions");
const extDocRef = (uid, id) => doc(db, "users", uid, "external_transactions", id);

/* ── Real-time listener ──
   Fires onData(session[]) on any change.
   Returns unsubscribe fn.
─────────────────────────────────────────────────────────────────── */
export function subscribeToExternalTransactions(uid, onData) {
  const q = query(extRef(uid), orderBy("date", "desc"));
  return onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snap) => {
      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(sessions);
    },
    (err) => console.error("[Firestore] external_transactions error", err)
  );
}

/* ── Upsert (create-or-update) — used for auto-save ── */
export async function upsertExternalTransaction(uid, session) {
  const { id, ...data } = session;
  await setDoc(extDocRef(uid, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/* ── Close session — atomically mark as closed ── */
export async function closeExternalTransaction(uid, id, patch) {
  await updateDoc(extDocRef(uid, id), {
    ...patch,
    status: "closed",
    updatedAt: serverTimestamp(),
  });
}

/* ── Delete session ── */
export async function deleteExternalTransaction(uid, id) {
  await deleteDoc(extDocRef(uid, id));
}

/* ═══════════════════════════════════════════════════════════════════
   RECENTLY DELETED (Trash collection)
   Collection: users/{uid}/recently_deleted
═══════════════════════════════════════════════════════════════════ */

const recentlyDeletedRef    = (uid)     => collection(db, "users", uid, "recently_deleted");
const recentlyDeletedDocRef = (uid, id) => doc(db, "users", uid, "recently_deleted", id);

export function subscribeToRecentlyDeleted(uid, onData) {
  return onSnapshot(
    query(recentlyDeletedRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort newest deleted first
      items.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
      onData(items);
    },
    (err) => console.error("[Firestore] recently_deleted error", err)
  );
}

function buildTrashItem(itemType, originalData) {
  const id = originalData.id;
  const name = originalData.name || originalData.title || originalData.person || 'Unnamed Item';
  const amount =
    originalData.amount !== undefined && originalData.amount !== null
      ? Number(originalData.amount)
      : originalData.net_balance !== undefined && originalData.net_balance !== null
      ? Math.abs(Number(originalData.net_balance))
      : originalData.total_spent !== undefined && originalData.total_spent !== null
      ? Number(originalData.total_spent)
      : 0;

  const date = originalData.date || originalData.createdAt || new Date().toISOString();
  const category = originalData.category || originalData.type || itemType;

  const item = {
    id,
    itemType, // 'expense' | 'income' | 'billing'
    name,
    amount,
    date,
    category,
    originalData,
    deletedAt: new Date().toISOString(),
  };

  return clean(item);
}

export async function moveToRecentlyDeleted(uid, itemType, originalData) {
  if (!uid || !originalData?.id) return;
  await setDoc(recentlyDeletedDocRef(uid, originalData.id), buildTrashItem(itemType, originalData));
}

/* ── Atomically copy a doc to the trash and delete the original ──
   Both writes succeed or neither does, so an item can never vanish
   without landing in Recently Deleted.
─────────────────────────────────────────────────────────────────── */
async function deleteToTrash(uid, itemType, originalData, originalRef) {
  const batch = writeBatch(db);
  batch.set(recentlyDeletedDocRef(uid, originalData.id), buildTrashItem(itemType, originalData));
  batch.delete(originalRef);
  await batch.commit();
}

export async function trashTransaction(uid, txn) {
  await deleteToTrash(uid, 'expense', txn, txnRef(uid, txn.id));
}

export async function trashIncome(uid, entry) {
  await deleteToTrash(uid, 'income', entry, incDocRef(uid, entry.id));
}

/* ── Restore from trash atomically: re-create original + remove trash entry ── */
export async function restoreFromRecentlyDeleted(uid, item) {
  const { itemType, originalData, id } = item;
  const { id: originalId, ...data } = originalData;
  const target =
    itemType === "income"  ? incDocRef(uid, originalId) :
    itemType === "billing" ? extDocRef(uid, originalId) :
                             txnRef(uid, originalId);
  const batch = writeBatch(db);
  batch.set(target, { ...clean(data), updatedAt: serverTimestamp() }, { merge: itemType === "billing" });
  batch.delete(recentlyDeletedDocRef(uid, id));
  await batch.commit();
}

export async function permanentlyDeleteFromRecentlyDeleted(uid, id) {
  if (!uid || !id) return;
  await deleteDoc(recentlyDeletedDocRef(uid, id));
}

export async function emptyRecentlyDeleted(uid) {
  if (!uid) return;
  const snap = await getDocs(query(recentlyDeletedRef(uid)));
  await commitInChunks(snap.docs.map((d) => (b) => b.delete(d.ref)));
}


/* ═══════════════════════════════════════════════════════════════════
   RECURRING RULES (rent, SIP, salary, subscriptions)
   Collection: users/{uid}/recurring — covered by the catch-all rule.
   Posting an occurrence writes an ordinary transaction / income doc with a
   deterministic id (see utils/recurring.js), so it is idempotent.
═══════════════════════════════════════════════════════════════════ */

const recurringRef    = (uid)     => collection(db, "users", uid, "recurring");
const recurringDocRef = (uid, id) => doc(db, "users", uid, "recurring", id);

export function subscribeToRecurring(uid, onData) {
  return onSnapshot(
    query(recurringRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rules.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onData(rules);
    },
    (err) => console.error("[Firestore] recurring error", err)
  );
}

export async function upsertRecurringRule(uid, rule) {
  const { id, ...data } = rule;
  await setDoc(recurringDocRef(uid, id), { ...clean(data), updatedAt: serverTimestamp() }, { merge: true });
}

/** Partial update (e.g. advance lastHandledKey after posting/skipping). */
export async function patchRecurringRule(uid, id, patch) {
  await updateDoc(recurringDocRef(uid, id), { ...clean(patch), updatedAt: serverTimestamp() });
}

export async function deleteRecurringRule(uid, id) {
  await deleteDoc(recurringDocRef(uid, id));
}
