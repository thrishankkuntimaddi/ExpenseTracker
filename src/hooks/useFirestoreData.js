// ─── useFirestoreData hook ───────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToUserData,
  addTransaction as fsAddTxn,
  updateTransaction as fsUpdateTxn,
  deleteTransaction as fsDeleteTxn,
  addIncome as fsAddIncome,
  deleteIncome as fsDeleteIncome,
  updateSettings as fsUpdateSettings,
} from "../services/firestore";
import { saveState, loadState } from "../utils/storage";
import { getDefaultPeriod } from "../utils/periodHelpers";

/**
 * Real-time Firestore data for the authenticated user.
 * Falls back to localStorage cache while offline.
 *
 * Returns the full app data state + mutation handlers.
 */
export function useFirestoreData(uid) {
  // Seed from localStorage cache so the UI is instant on load
  const cached = loadState();
  const [transactions, setTransactions] = useState(cached.transactions);
  const [income, setIncome]             = useState(cached.income);
  const [settings, setSettings]         = useState(cached.settings);

  const uidRef = useRef(uid);
  uidRef.current = uid;

  useEffect(() => {
    if (!uid) return;

    const unsub = subscribeToUserData(uid, ({ transactions: t, income: i, settings: s }) => {
      setTransactions(t);
      setIncome(i);
      if (s && Object.keys(s).length) setSettings(prev => ({ ...prev, ...s }));

      // Keep localStorage as offline cache
      saveState({ transactions: t, income: i, settings: s });
    });

    return unsub;
  }, [uid]);

  /* ── Mutation handlers ── */
  const addTransaction = useCallback(async (txn) => {
    setTransactions(prev => [...prev, txn]); // optimistic
    try { await fsAddTxn(uidRef.current, txn); }
    catch { setTransactions(prev => prev.filter(t => t.id !== txn.id)); }
  }, []);

  const updateTransaction = useCallback(async (updated) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    try { await fsUpdateTxn(uidRef.current, updated); }
    catch (e) { console.error("updateTransaction failed", e); }
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    setTransactions(prev => {
      const removed = prev.find(t => t.id === id);
      _deletedRef.current = removed;
      return prev.filter(t => t.id !== id);
    });
    try { await fsDeleteTxn(uidRef.current, id); }
    catch { setTransactions(prev => _deletedRef.current ? [...prev, _deletedRef.current] : prev); }
  }, []);

  const addIncome = useCallback(async (entry) => {
    setIncome(prev => [...prev, entry]);
    try { await fsAddIncome(uidRef.current, entry); }
    catch { setIncome(prev => prev.filter(i => i.id !== entry.id)); }
  }, []);

  const deleteIncome = useCallback(async (id) => {
    setIncome(prev => prev.filter(i => i.id !== id));
    try { await fsDeleteIncome(uidRef.current, id); }
    catch (e) { console.error("deleteIncome failed", e); }
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    saveState({ transactions, income, settings: newSettings });
    try { await fsUpdateSettings(uidRef.current, newSettings); }
    catch (e) { console.error("saveSettings failed", e); }
  }, [transactions, income]);

  // Batch update (used by import/reset)
  const handleDataChange = useCallback(({ transactions: t, income: i }) => {
    setTransactions(t);
    setIncome(i);
  }, []);

  return {
    transactions, income, settings,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, deleteIncome,
    saveSettings, handleDataChange,
  };
}

// Internal ref for optimistic delete rollback
const _deletedRef = { current: null };
