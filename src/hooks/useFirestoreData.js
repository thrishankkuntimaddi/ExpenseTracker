// ─── useFirestoreData hook ───────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { background, readableFirestoreError } from "../services/sync";
import {
  subscribeToUserData,
  addTransaction as fsAddTxn,
  updateTransaction as fsUpdateTxn,
  trashTransaction,
  addIncome as fsAddIncome,
  updateIncome as fsUpdateIncome,
  trashIncome,
  updateSettings as fsUpdateSettings,
  subscribeToRecentlyDeleted,
  ensureUserDoc,
  restoreFromRecentlyDeleted,
  permanentlyDeleteFromRecentlyDeleted,
  emptyRecentlyDeleted,
} from "../services/firestore";

// Theme is a per-device setting (utils/theme.js), not part of synced settings.
const DEFAULT_SETTINGS = {};

/**
 * Real-time Firestore data for the authenticated user.
 *
 * Offline support comes from Firestore's persistent IndexedDB cache
 * (see services/firebase.js): snapshots fire from disk immediately and
 * writes queue while offline.
 *
 * Every mutation updates the UI optimistically and rolls back if the write
 * is rejected; the failure is surfaced through `writeError`.
 */
export function useFirestoreData(uid, email) {
  const [transactions, setTransactions] = useState([]);
  const [income, setIncome]             = useState([]);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [writeError, setWriteError]     = useState(null);
  const [loaded, setLoaded]             = useState(false); // first ledger snapshot received

  // Latest values, readable from stable callbacks without re-creating them
  const uidRef      = useRef(uid);
  const txnsRef     = useRef(transactions);
  const incomeRef   = useRef(income);
  const settingsRef = useRef(settings);
  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => { txnsRef.current = transactions; }, [transactions]);
  useEffect(() => { incomeRef.current = income; }, [income]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Repair accounts that never got a user doc
  useEffect(() => {
    if (!uid) return;
    ensureUserDoc(uid, email)
      .catch((err) => console.warn('[ensureUserDoc] failed:', err?.message));
  }, [uid, email]);

  useEffect(() => {
    if (!uid) return;

    let gotTxns = false, gotIncome = false;
    const unsubUser = subscribeToUserData(uid, ({ transactions: t, income: i, settings: s, source }) => {
      setTransactions(t);
      setIncome(i);
      if (source === 'transactions') gotTxns = true;
      if (source === 'income') gotIncome = true;
      if (gotTxns && gotIncome) setLoaded(true);
      if (s && Object.keys(s).length) {
        setSettings(prev => ({ ...prev, ...s }));
      }
    });

    const unsubRecently = subscribeToRecentlyDeleted(uid, setRecentlyDeleted);

    return () => {
      unsubUser();
      unsubRecently();
      setLoaded(false);
    };
  }, [uid]);

  const reportError = useCallback((action, err) => {
    console.error(`[${action}] Firestore write failed:`, err?.code, err?.message, err);
    setWriteError(`${readableFirestoreError(err, action)} Your change was undone.`);
  }, []);
  const clearWriteError = useCallback(() => setWriteError(null), []);

  /* ── Transactions ── */

  const addTransaction = useCallback(async (txn) => {
    if (!uidRef.current) return false;
    setTransactions(prev => [...prev, txn]);
    background(fsAddTxn(uidRef.current, txn), (err) => {
      reportError('add the transaction', err);
      setTransactions(prev => prev.filter(t => t.id !== txn.id));
    });
    return true;
  }, [reportError]);

  const updateTransaction = useCallback(async (updated) => {
    if (!uidRef.current) return false;
    const previous = txnsRef.current.find(t => t.id === updated.id);
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    background(fsUpdateTxn(uidRef.current, updated), (err) => {
      reportError('update the transaction', err);
      if (previous) setTransactions(prev => prev.map(t => t.id === updated.id ? previous : t));
    });
    return true;
  }, [reportError]);

  const deleteTransaction = useCallback(async (id) => {
    if (!uidRef.current) return false;
    const found = txnsRef.current.find(t => t.id === id);
    if (!found) return false;
    setTransactions(prev => prev.filter(t => t.id !== id));
    // Atomic: copy to Recently Deleted + delete original in one batch
    background(trashTransaction(uidRef.current, found), (err) => {
      reportError('delete the transaction', err);
      setTransactions(prev => prev.some(t => t.id === id) ? prev : [...prev, found]);
    });
    return true;
  }, [reportError]);

  /* ── Income ── */

  const addIncome = useCallback(async (entry) => {
    if (!uidRef.current) return false;
    setIncome(prev => [...prev, entry]);
    background(fsAddIncome(uidRef.current, entry), (err) => {
      reportError('add the income entry', err);
      setIncome(prev => prev.filter(i => i.id !== entry.id));
    });
    return true;
  }, [reportError]);

  const updateIncome = useCallback(async (updated) => {
    if (!uidRef.current) return false;
    const previous = incomeRef.current.find(i => i.id === updated.id);
    setIncome(prev => prev.map(i => i.id === updated.id ? updated : i));
    background(fsUpdateIncome(uidRef.current, updated), (err) => {
      reportError('update the income entry', err);
      if (previous) setIncome(prev => prev.map(i => i.id === updated.id ? previous : i));
    });
    return true;
  }, [reportError]);

  const deleteIncome = useCallback(async (id) => {
    if (!uidRef.current) return false;
    const found = incomeRef.current.find(i => i.id === id);
    if (!found) return false;
    setIncome(prev => prev.filter(i => i.id !== id));
    // Atomic: copy to Recently Deleted + delete original in one batch
    background(trashIncome(uidRef.current, found), (err) => {
      reportError('delete the income entry', err);
      setIncome(prev => prev.some(i => i.id === id) ? prev : [...prev, found]);
    });
    return true;
  }, [reportError]);

  /* ── Settings ── */

  const saveSettings = useCallback(async (newSettings) => {
    if (!uidRef.current) return false;
    const previous = settingsRef.current;
    setSettings(newSettings);
    background(fsUpdateSettings(uidRef.current, newSettings), (err) => {
      reportError('save settings', err);
      setSettings(previous);
    });
    return true;
  }, [reportError]);

  /** Merge a partial update into settings (budgets, categoryRules, goals …). */
  const patchSettings = useCallback(async (patch) => {
    const previous = settingsRef.current;
    const next = { ...previous, ...patch };
    setSettings(next);
    background(fsUpdateSettings(uidRef.current, next), (err) => {
      reportError('save settings', err);
      setSettings(previous);
    });
    return true;
  }, [reportError]);

  /* ── Recently Deleted ── */

  const restoreDeletedItem = useCallback(async (item) => {
    if (!uidRef.current || !item) return false;
    // Atomic: re-create original + remove trash entry in one batch
    background(restoreFromRecentlyDeleted(uidRef.current, item), (err) => {
      reportError('restore the item', err);
    });
    return true;
  }, [reportError]);

  const permanentlyDeleteRecentlyDeletedItem = useCallback(async (id) => {
    if (!uidRef.current || !id) return false;
    background(permanentlyDeleteFromRecentlyDeleted(uidRef.current, id), (err) => {
      reportError('permanently delete the item', err);
    });
    return true;
  }, [reportError]);

  const emptyTrash = useCallback(async () => {
    if (!uidRef.current) return false;
    background(emptyRecentlyDeleted(uidRef.current), (err) => {
      reportError('empty Recently Deleted', err);
    });
    return true;
  }, [reportError]);

  return {
    transactions, income, settings, recentlyDeleted, loaded,
    writeError, clearWriteError, reportError,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    saveSettings, patchSettings,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  };
}
