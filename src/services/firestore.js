// ─── Firestore CRUD Layer ────────────────────────────────────────
import {
  doc, collection, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, serverTimestamp, setDoc, getDoc,
  getDocs, where,
} from "firebase/firestore";
import { db } from "./firebase";
import { loadState } from "../utils/storage";

/* ── User document ref ── */
const userRef = (uid) => doc(db, "users", uid);
const txnsRef  = (uid) => collection(db, "users", uid, "transactions");
const incRef   = (uid) => collection(db, "users", uid, "income");

/* ── Real-time listener ───────────────────────────────────────────
   Fires onData({ transactions[], income[], settings{} }) on change.
   Returns unsubscribe fn.
─────────────────────────────────────────────────────────────────── */
export function subscribeToUserData(uid, onData) {
  let txns     = [];
  let incomes  = [];
  let settings = {};

  function emit() {
    onData({ transactions: txns, income: incomes, settings });
  }

  // Transactions sub-collection
  const unsubTxns = onSnapshot(
    query(txnsRef(uid)),
    (snap) => {
      if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
      txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => console.error("[Firestore] txns error", err)
  );

  // Income sub-collection
  const unsubInc = onSnapshot(
    query(incRef(uid)),
    (snap) => {
      if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
      incomes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => console.error("[Firestore] income error", err)
  );

  // User document (settings)
  const unsubUser = onSnapshot(
    userRef(uid),
    (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
      settings = snap.data()?.settings || {};
      emit();
    },
    (err) => console.error("[Firestore] user error", err)
  );

  return () => { unsubTxns(); unsubInc(); unsubUser(); };
}

/* ── Ensure user doc exists ── */
export async function ensureUserDoc(uid, email) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email,
      createdAt: serverTimestamp(),
      settings: { theme: "light", googleSheetUrl: "" },
    });
  }
}

/* ── Transactions ── */
export async function addTransaction(uid, txn) {
  const { id: _id, ...data } = txn; // Firestore generates id
  await addDoc(txnsRef(uid), { ...data, _clientId: txn.id, updatedAt: serverTimestamp() });
}

export async function updateTransaction(uid, txn) {
  // Find doc by _clientId field
  const snap = await _findDocByClientId(txnsRef(uid), txn.id);
  if (!snap) return;
  await updateDoc(snap.ref, { ...txn, updatedAt: serverTimestamp() });
}

export async function deleteTransaction(uid, txnId) {
  const snap = await _findDocByClientId(txnsRef(uid), txnId);
  if (!snap) return;
  await deleteDoc(snap.ref);
}

/* ── Income ── */
export async function addIncome(uid, entry) {
  const { id: _id, ...data } = entry;
  await addDoc(incRef(uid), { ...data, _clientId: entry.id, updatedAt: serverTimestamp() });
}

export async function deleteIncome(uid, entryId) {
  const snap = await _findDocByClientId(incRef(uid), entryId);
  if (!snap) return;
  await deleteDoc(snap.ref);
}

/* ── Settings ── */
export async function updateSettings(uid, settings) {
  await updateDoc(userRef(uid), { settings, updatedAt: serverTimestamp() });
}

/* ── Migration helper ── */
export async function migrateFromLocalStorage(uid) {
  const local = loadState();
  const batch = [];

  for (const txn of local.transactions) {
    const { id: _id, ...data } = txn;
    batch.push(addDoc(txnsRef(uid), { ...data, _clientId: txn.id, updatedAt: serverTimestamp() }));
  }
  for (const entry of local.income) {
    const { id: _id, ...data } = entry;
    batch.push(addDoc(incRef(uid), { ...data, _clientId: entry.id, updatedAt: serverTimestamp() }));
  }
  if (local.settings) {
    batch.push(updateDoc(userRef(uid), { settings: { ...local.settings, password: null }, updatedAt: serverTimestamp() }));
  }

  await Promise.all(batch);
  return { transactions: local.transactions.length, income: local.income.length };
}

/* ── Internal helper ── */
async function _findDocByClientId(colRef, clientId) {
  const q = query(colRef, where("_clientId", "==", clientId));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
}
