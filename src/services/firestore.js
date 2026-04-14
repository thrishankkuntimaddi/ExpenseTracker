// ─── Firestore CRUD Layer ────────────────────────────────────────
import {
  doc, collection, updateDoc, deleteDoc,
  onSnapshot, query, serverTimestamp, setDoc, getDoc, deleteField, getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { loadState } from "../utils/storage";

/* ── Document refs ── */
const userRef   = (uid)     => doc(db, "users", uid);
const txnsRef   = (uid)     => collection(db, "users", uid, "transactions");
const txnRef    = (uid, id) => doc(db, "users", uid, "transactions", id);
const incRef    = (uid)     => collection(db, "users", uid, "income");
const incDocRef = (uid, id) => doc(db, "users", uid, "income", id);

/* ── Strip undefined values — Firestore rejects them ── */
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

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

  // Transactions sub-collection — include pending writes so optimistic updates show immediately
  const unsubTxns = onSnapshot(
    query(txnsRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => console.error("[Firestore] txns error", err)
  );

  // Income sub-collection
  const unsubInc = onSnapshot(
    query(incRef(uid)),
    { includeMetadataChanges: false },
    (snap) => {
      incomes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
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
    wasteAmount: wasteAmount === undefined ? deleteField() : wasteAmount,
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

export async function deleteIncome(uid, entryId) {
  await deleteDoc(incDocRef(uid, entryId));
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
    const { id, ...data } = txn;
    batch.push(setDoc(txnRef(uid, id), { ...data, updatedAt: serverTimestamp() }));
  }
  for (const entry of local.income) {
    const { id, ...data } = entry;
    batch.push(setDoc(incDocRef(uid, id), { ...data, updatedAt: serverTimestamp() }));
  }
  if (local.settings) {
    batch.push(updateDoc(userRef(uid), { settings: { ...local.settings, password: null }, updatedAt: serverTimestamp() }));
  }

  await Promise.all(batch);
  return { transactions: local.transactions.length, income: local.income.length };
}

/* ── Delete ALL documents for a user (Reset All Data) ──
   Enumerates both subcollections and deletes every document.
   Firestore client SDK does not support collection-level delete,
   so we fetch all doc refs then delete them in parallel.
─────────────────────────────────────────────────────────────────── */
export async function deleteAllUserData(uid) {
  const [txnSnap, incSnap] = await Promise.all([
    getDocs(query(txnsRef(uid))),
    getDocs(query(incRef(uid))),
  ]);
  await Promise.all([
    ...txnSnap.docs.map((d) => deleteDoc(d.ref)),
    ...incSnap.docs.map((d) => deleteDoc(d.ref)),
  ]);
}

