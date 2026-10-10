// ─── useFirestoreData hook ───────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
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
import { getSavedTheme, saveTheme } from "../utils/storage";

const DEFAULT_SETTINGS = { theme: getSavedTheme() };

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

  // Repair accounts that never got a user doc (keep this device's theme)
  useEffect(() => {
    if (!uid) return;
    ensureUserDoc(uid, email, { theme: getSavedTheme() })
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
        if (s.theme) saveTheme(s.theme);
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
    setWriteError(`Couldn't ${action}: ${err?.message || 'unknown error'}. Your change was not saved.`);
  }, []);
  const clearWriteError = useCallback(() => setWriteError(null), []);

  /* ── Transactions ── */

  const addTransaction = useCallback(async (txn) => {
    if (!uidRef.current) return false;
    setTransactions(prev => [...prev, txn]);
    try {
      await fsAddTxn(uidRef.current, txn);
      return true;
    } catch (err) {
      reportError('add the transaction', err);
      setTransactions(prev => prev.filter(t => t.id !== txn.id));
      return false;
    }
  }, [reportError]);

  const updateTransaction = useCallback(async (updated) => {
    if (!uidRef.current) return false;
    const previous = txnsRef.current.find(t => t.id === updated.id);
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    try {
      await fsUpdateTxn(uidRef.current, updated);
      return true;
    } catch (err) {
      reportError('update the transaction', err);
      if (previous) setTransactions(prev => prev.map(t => t.id === updated.id ? previous : t));
      return false;
    }
  }, [reportError]);

  const deleteTransaction = useCallback(async (id) => {
    if (!uidRef.current) return false;
    const found = txnsRef.current.find(t => t.id === id);
    if (!found) return false;
    setTransactions(prev => prev.filter(t => t.id !== id));
    try {
      // Atomic: copy to Recently Deleted + delete original in one batch
      await trashTransaction(uidRef.current, found);
      return true;
    } catch (err) {
      reportError('delete the transaction', err);
      setTransactions(prev => prev.some(t => t.id === id) ? prev : [...prev, found]);
      return false;
    }
  }, [reportError]);

  /* ── Income ── */

  const addIncome = useCallback(async (entry) => {
    if (!uidRef.current) return false;
    setIncome(prev => [...prev, entry]);
    try {
      await fsAddIncome(uidRef.current, entry);
      return true;
    } catch (err) {
      reportError('add the income entry', err);
      setIncome(prev => prev.filter(i => i.id !== entry.id));
      return false;
    }
  }, [reportError]);

  const updateIncome = useCallback(async (updated) => {
    if (!uidRef.current) return false;
    const previous = incomeRef.current.find(i => i.id === updated.id);
    setIncome(prev => prev.map(i => i.id === updated.id ? updated : i));
    try {
      await fsUpdateIncome(uidRef.current, updated);
      return true;
    } catch (err) {
      reportError('update the income entry', err);
      if (previous) setIncome(prev => prev.map(i => i.id === updated.id ? previous : i));
      return false;
    }
  }, [reportError]);

  const deleteIncome = useCallback(async (id) => {
    if (!uidRef.current) return false;
    const found = incomeRef.current.find(i => i.id === id);
    if (!found) return false;
    setIncome(prev => prev.filter(i => i.id !== id));
    try {
      // Atomic: copy to Recently Deleted + delete original in one batch
      await trashIncome(uidRef.current, found);
      return true;
    } catch (err) {
      reportError('delete the income entry', err);
      setIncome(prev => prev.some(i => i.id === id) ? prev : [...prev, found]);
      return false;
    }
  }, [reportError]);

  /* ── Settings ── */

  const saveSettings = useCallback(async (newSettings) => {
    if (!uidRef.current) return false;
    const previous = settingsRef.current;
    setSettings(newSettings);
    if (newSettings?.theme) saveTheme(newSettings.theme);
    try {
      await fsUpdateSettings(uidRef.current, newSettings);
      return true;
    } catch (err) {
      reportError('save settings', err);
      setSettings(previous);
      return false;
    }
  }, [reportError]);

  /** Merge a partial update into settings (budgets, categoryRules, goals …). */
  const patchSettings = useCallback(async (patch) => {
    const previous = settingsRef.current;
    const next = { ...previous, ...patch };
    setSettings(next);
    try {
      await fsUpdateSettings(uidRef.current, next);
      return true;
    } catch (err) {
      reportError('save settings', err);
      setSettings(previous);
      return false;
    }
  }, [reportError]);

  /* ── Recently Deleted ── */

  const restoreDeletedItem = useCallback(async (item) => {
    if (!uidRef.current || !item) return false;
    try {
      // Atomic: re-create original + remove trash entry in one batch
      await restoreFromRecentlyDeleted(uidRef.current, item);
      return true;
    } catch (err) {
      reportError('restore the item', err);
      return false;
    }
  }, [reportError]);

  const permanentlyDeleteRecentlyDeletedItem = useCallback(async (id) => {
    if (!uidRef.current || !id) return false;
    try {
      await permanentlyDeleteFromRecentlyDeleted(uidRef.current, id);
      return true;
    } catch (err) {
      reportError('permanently delete the item', err);
      return false;
    }
  }, [reportError]);

  const emptyTrash = useCallback(async () => {
    if (!uidRef.current) return false;
    try {
      await emptyRecentlyDeleted(uidRef.current);
      return true;
    } catch (err) {
      reportError('empty Recently Deleted', err);
      return false;
    }
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
