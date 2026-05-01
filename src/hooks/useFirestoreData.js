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

/**
 * Real-time Firestore data for the authenticated user.
 * Falls back to localStorage cache while offline.
 */
export function useFirestoreData(uid) {
  // Seed from localStorage cache so the UI is instant on load
  const cached = loadState();
  const [transactions, setTransactions] = useState(cached.transactions);
  const [income, setIncome]             = useState(cached.income);
  const [settings, setSettings]         = useState(cached.settings);

  const uidRef = useRef(uid);
  uidRef.current = uid;

  // Internal ref for optimistic delete rollback
  const deletedTxnRef = useRef(null);

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
    if (!uidRef.current) {
      console.error('[addTransaction] No UID — user not logged in?');
      return;
    }
    setTransactions(prev => [...prev, txn]);
    try {
      await fsAddTxn(uidRef.current, txn);
    } catch (err) {
      console.error('[addTransaction] Firestore write failed:', err?.code, err?.message, err);
      setTransactions(prev => prev.filter(t => t.id !== txn.id));
    }
  }, []);

  const updateTransaction = useCallback(async (updated) => {
    if (!uidRef.current) return;
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    try {
      await fsUpdateTxn(uidRef.current, updated);
    } catch (err) {
      console.error('[updateTransaction] Firestore write failed:', err?.code, err?.message, err);
    }
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    if (!uidRef.current) return;
    setTransactions(prev => {
      const found = prev.find(t => t.id === id);
      if (found) deletedTxnRef.current = found;
      return prev.filter(t => t.id !== id);
    });
    try {
      await fsDeleteTxn(uidRef.current, id);
    } catch (err) {
      console.error('[deleteTransaction] Firestore write failed:', err?.code, err?.message, err);
      setTransactions(prev =>
        deletedTxnRef.current ? [...prev, deletedTxnRef.current] : prev
      );
    }
  }, []);

  const addIncome = useCallback(async (entry) => {
    if (!uidRef.current) return;
    setIncome(prev => [...prev, entry]);
    try {
      await fsAddIncome(uidRef.current, entry);
    } catch (err) {
      console.error('[addIncome] Firestore write failed:', err?.code, err?.message, err);
      setIncome(prev => prev.filter(i => i.id !== entry.id));
    }
  }, []);

  const deleteIncome = useCallback(async (id) => {
    if (!uidRef.current) return;
    setIncome(prev => prev.filter(i => i.id !== id));
    try {
      await fsDeleteIncome(uidRef.current, id);
    } catch (err) {
      console.error('[deleteIncome] Firestore write failed:', err?.code, err?.message, err);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
    if (!uidRef.current) return;
    setSettings(newSettings);
    const raw = loadState();
    saveState({ ...raw, settings: newSettings });
    try {
      await fsUpdateSettings(uidRef.current, newSettings);
    } catch (err) {
      console.error('[saveSettings] Firestore write failed:', err?.code, err?.message, err);
    }
  }, []);

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
