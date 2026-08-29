// ─── useFirestoreData hook ───────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToUserData,
  addTransaction as fsAddTxn,
  updateTransaction as fsUpdateTxn,
  deleteTransaction as fsDeleteTxn,
  addIncome as fsAddIncome,
  updateIncome as fsUpdateIncome,
  deleteIncome as fsDeleteIncome,
  updateSettings as fsUpdateSettings,
  subscribeToRecentlyDeleted,
  moveToRecentlyDeleted,
  permanentlyDeleteFromRecentlyDeleted,
  emptyRecentlyDeleted,
  upsertExternalTransaction,
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
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);

  const uidRef = useRef(uid);
  uidRef.current = uid;

  // Internal ref for optimistic delete rollback
  const deletedTxnRef = useRef(null);
  const deletedIncRef = useRef(null);

  useEffect(() => {
    if (!uid) return;

    const unsubUser = subscribeToUserData(uid, ({ transactions: t, income: i, settings: s }) => {
      setTransactions(t);
      setIncome(i);
      if (s && Object.keys(s).length) setSettings(prev => ({ ...prev, ...s }));
      // Keep localStorage as offline cache
      saveState({ transactions: t, income: i, settings: s });
    });

    const unsubRecently = subscribeToRecentlyDeleted(uid, (items) => {
      setRecentlyDeleted(items);
    });

    return () => {
      unsubUser();
      unsubRecently();
    };
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
    let found = null;
    setTransactions(prev => {
      found = prev.find(t => t.id === id);
      if (found) deletedTxnRef.current = found;
      return prev.filter(t => t.id !== id);
    });
    try {
      if (found) {
        await moveToRecentlyDeleted(uidRef.current, 'expense', found);
      }
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

  const updateIncome = useCallback(async (updated) => {
    if (!uidRef.current) return;
    setIncome(prev => prev.map(i => i.id === updated.id ? updated : i));
    try {
      await fsUpdateIncome(uidRef.current, updated);
    } catch (err) {
      console.error('[updateIncome] Firestore write failed:', err?.code, err?.message, err);
    }
  }, []);

  const deleteIncome = useCallback(async (id) => {
    if (!uidRef.current) return;
    let found = null;
    setIncome(prev => {
      found = prev.find(i => i.id === id);
      if (found) deletedIncRef.current = found;
      return prev.filter(i => i.id !== id);
    });
    try {
      if (found) {
        await moveToRecentlyDeleted(uidRef.current, 'income', found);
      }
      await fsDeleteIncome(uidRef.current, id);
    } catch (err) {
      console.error('[deleteIncome] Firestore write failed:', err?.code, err?.message, err);
      setIncome(prev =>
        deletedIncRef.current ? [...prev, deletedIncRef.current] : prev
      );
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

  /* ── Recently Deleted Handlers ── */

  const restoreDeletedItem = useCallback(async (item) => {
    if (!uidRef.current || !item) return;
    const { itemType, originalData, id } = item;
    try {
      if (itemType === 'income') {
        await fsAddIncome(uidRef.current, originalData);
      } else if (itemType === 'billing') {
        await upsertExternalTransaction(uidRef.current, originalData);
      } else {
        // default: expense / transaction
        await fsAddTxn(uidRef.current, originalData);
      }
      await permanentlyDeleteFromRecentlyDeleted(uidRef.current, id);
    } catch (err) {
      console.error('[restoreDeletedItem] Restore failed:', err);
    }
  }, []);

  const permanentlyDeleteRecentlyDeletedItem = useCallback(async (id) => {
    if (!uidRef.current || !id) return;
    try {
      await permanentlyDeleteFromRecentlyDeleted(uidRef.current, id);
    } catch (err) {
      console.error('[permanentlyDeleteRecentlyDeletedItem] Failed:', err);
    }
  }, []);

  const emptyTrash = useCallback(async () => {
    if (!uidRef.current) return;
    try {
      await emptyRecentlyDeleted(uidRef.current);
    } catch (err) {
      console.error('[emptyTrash] Failed:', err);
    }
  }, []);

  // Batch update (used by import/reset)
  const handleDataChange = useCallback(({ transactions: t, income: i }) => {
    setTransactions(t);
    setIncome(i);
  }, []);

  return {
    transactions, income, settings, recentlyDeleted,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    saveSettings, handleDataChange,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  };
}

