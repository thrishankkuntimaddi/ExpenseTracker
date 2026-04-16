// ─── Firestore CRUD Layer ────────────────────────────────────────
import {
  doc, collection, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, setDoc, getDoc,
  deleteField, getDocs, runTransaction, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { loadState } from "../utils/storage";

/* ── Document refs ── */
const userRef      = (uid)          => doc(db, "users", uid);
const txnsRef      = (uid)          => collection(db, "users", uid, "transactions");
const txnRef       = (uid, id)      => doc(db, "users", uid, "transactions", id);
const incRef       = (uid)          => collection(db, "users", uid, "income");
const incDocRef    = (uid, id)      => doc(db, "users", uid, "income", id);
const summaryRef   = (uid)          => collection(db, "users", uid, "monthly_summaries");
const summaryDocRef = (uid, yyyyMM) => doc(db, "users", uid, "monthly_summaries", yyyyMM);

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

/* ── One-time purge: delete all carry_forward income entries ── */
export async function purgeCarryForwards(uid) {
  const snap = await getDocs(query(incRef(uid), where('type', '==', 'carry_forward')));
  if (snap.empty) return;
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  console.info(`[purgeCarryForwards] Deleted ${snap.size} carry_forward entries.`);
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
   MONTHLY SUMMARIES — source of truth for carry-forward rollover
   Collection: users/{uid}/monthly_summaries/{YYYY-MM}
   Each doc:
     total_income        number
     total_expense       number
     closing_balance     number
     is_closed           boolean
     rollover_processed  boolean
     processed_at        Timestamp | null
═══════════════════════════════════════════════════════════════════ */

/** Read a single month's summary (returns null if missing) */
export async function getMonthlySummary(uid, yyyyMM) {
  const snap = await getDoc(summaryDocRef(uid, yyyyMM));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Upsert a monthly summary from live income + transaction arrays.
 * Called after every data mutation so the numbers stay current.
 *
 * CRITICAL: never overwrites is_closed / rollover_processed if the doc already exists.
 * We read-then-write to leave close/rollover state untouched.
 */
export async function upsertMonthlySummary(uid, yyyyMM, allIncome, allTransactions) {
  const monthIncome = allIncome
    .filter(i => i.date?.slice(0, 7) === yyyyMM)
    .reduce((s, i) => s + (i.amount || 0), 0);

  const monthExpense = allTransactions
    .filter(t => t.date?.slice(0, 7) === yyyyMM && ['expense', 'savings', 'person'].includes(t.type))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const closing_balance = monthIncome - monthExpense;

  const ref  = summaryDocRef(uid, yyyyMM);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Doc exists — update only the financial totals; preserve is_closed / rollover_processed
    const existing = snap.data();
    await setDoc(ref, {
      ...existing,
      total_income:    monthIncome,
      total_expense:   monthExpense,
      closing_balance,
    });
  } else {
    // New doc — safe to seed defaults
    await setDoc(ref, {
      total_income:    monthIncome,
      total_expense:   monthExpense,
      closing_balance,
      is_closed:          false,
      rollover_processed: false,
    });
  }
}

/**
 * Returns all monthly_summaries docs where:
 *  - is_closed == false
 *  - rollover_processed == false
 *  - month < currentMonth  (handled in JS after fetch for simplicity)
 */
export async function getPendingRolloverMonths(uid, currentMonth) {
  const snap = await getDocs(
    query(
      summaryRef(uid),
      where('is_closed', '==', false),
      where('rollover_processed', '==', false),
    )
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.id < currentMonth)   // only past months
    .sort((a, b) => a.id.localeCompare(b.id)); // oldest first
}

/**
 * Atomic carry-forward transaction.
 *
 * Inside a Firestore runTransaction:
 *  1. Re-read fromMonth summary (idempotency guard)
 *  2. Compute closing_balance
 *  3. Write carry-forward income or expense entry in toMonth
 *  4. Mark fromMonth: is_closed=true, rollover_processed=true
 *
 * The carry-forward doc ID is deterministic: `cf_{fromMonth}_{toMonth}`
 * so a duplicate run of setDoc is a safe no-op overwrite.
 */
export async function runCarryForwardTransaction(uid, fromMonth, toMonth) {
  const summaryFrom = summaryDocRef(uid, fromMonth);
  const cfId        = `cf_${fromMonth}_${toMonth}`;
  const cfIncDoc    = incDocRef(uid, cfId);
  const cfTxnDoc    = txnRef(uid, cfId);

  // Human-readable month label, e.g. "Feb 2025"
  const [y, m] = fromMonth.split('-');
  const monthLabel = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  await runTransaction(db, async (t) => {
    const snap = await t.get(summaryFrom);

    // ── Idempotency guard: bail if already processed ──
    if (!snap.exists() || snap.data().rollover_processed === true) {
      return;
    }

    const { total_income = 0, total_expense = 0 } = snap.data();
    const closing_balance = total_income - total_expense;

    // ── First day of toMonth (ISO string) ──
    const [ty, tm] = toMonth.split('-');
    const firstDay = new Date(Number(ty), Number(tm) - 1, 1).toISOString();

    if (closing_balance > 0) {
      // Positive: create income entry in next month
      t.set(cfIncDoc, {
        name:   `Carry Forward (${monthLabel})`,
        amount: closing_balance,
        type:   'carry_forward',
        date:   firstDay,
        month:  toMonth,
        system: true,
        updatedAt: serverTimestamp(),
      });
    } else if (closing_balance < 0) {
      // Negative: create expense transaction in next month
      t.set(cfTxnDoc, {
        name:   `Carry Forward Deficit (${monthLabel})`,
        amount: Math.abs(closing_balance),
        type:   'carry_forward_deficit',
        date:   firstDay,
        month:  toMonth,
        system: true,
        updatedAt: serverTimestamp(),
      });
    }
    // If closing_balance === 0 → write nothing, just close the month

    // ── Mark the source month as closed ──
    t.set(summaryFrom, {
      closing_balance,
      is_closed:         true,
      rollover_processed: true,
      processed_at:      Timestamp.now(),
    }, { merge: true });
  });
}

/** Real-time listener for monthly_summaries (used for locked-month UI indicators) */
export function subscribeToMonthlySummaries(uid, onData) {
  const q = query(summaryRef(uid), orderBy('__name__', 'desc'));
  return onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snap) => {
      const summaries = {};
      snap.docs.forEach(d => { summaries[d.id] = { id: d.id, ...d.data() }; });
      onData(summaries);
    },
    (err) => console.error('[Firestore] monthly_summaries error', err)
  );
}
