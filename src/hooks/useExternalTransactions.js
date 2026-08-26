// ─── useExternalTransactions hook ────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToExternalTransactions,
  upsertExternalTransaction,
  closeExternalTransaction,
  deleteExternalTransaction,
} from "../services/firestore";
import { generateId } from "../utils/storage";
import { todayInputValue, dateInputToISO, isoToMonth } from "../utils/dateHelpers";

const DEBOUNCE_MS = 600;

/**
 * Real-time hook for the External / Proxy Spending ledger.
 * Supports multiple independent billing sessions.
 *
 * Exposes:
 *   sessions          — all external_transaction docs (latest first)
 *   saving            — true while a debounced write is in-flight
 *   createSession(name, dateStr)   — creates a new 'open' session
 *   updateSession(patch)           — debounced merge into any session by id
 *   saveDraftSession(id)           — sets status to 'draft'
 *   closeSession(id, finalData, onAddIncome, onAddTransaction) — closes session
 *   discardSession(id)             — sets status to 'discarded'
 *   deleteSession(id)              — permanently deletes
 */
export function useExternalTransactions(uid) {
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving]     = useState(false);

  const uidRef        = useRef(uid);
  uidRef.current      = uid;
  const debounceTimer = useRef(null);

  /* ── Subscribe to Firestore ── */
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToExternalTransactions(uid, (docs) => {
      setSessions(docs);
    });
    return unsub;
  }, [uid]);

  /* ── Create a fresh open session ── */
  const createSession = useCallback(async (name = 'New Billing', dateStr = null) => {
    if (!uidRef.current) return null;
    const isoDate = dateStr ? dateInputToISO(dateStr) : new Date().toISOString();
    const session = {
      id:             generateId(),
      name:           name.trim() || 'Unnamed Billing',
      date:           isoDate,
      month:          isoToMonth(isoDate),
      items:          [{ id: generateId(), name: '', amount: null }],
      received:       [{ id: generateId(), person: '', amount: null }],
      total_received: 0,
      total_spent:    0,
      net_balance:    0,
      status:         'open',
      createdAt:      new Date().toISOString(),
    };
    // Optimistic local update
    setSessions((prev) => [session, ...prev]);
    try {
      await upsertExternalTransaction(uidRef.current, session);
      return session.id;
    } catch (err) {
      console.error('[createSession] Firestore write failed:', err);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      return null;
    }
  }, []);

  /* ── Debounced update — merges patch into any session by id ── */
  const updateSession = useCallback((patch) => {
    if (!uidRef.current || !patch.id) return;

    // Optimistic local update immediately
    setSessions((prev) =>
      prev.map((s) => (s.id === patch.id ? { ...s, ...patch } : s))
    );

    // Debounce the Firestore write
    clearTimeout(debounceTimer.current);
    setSaving(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        await upsertExternalTransaction(uidRef.current, patch);
      } catch (err) {
        console.error('[updateSession] Firestore write failed:', err);
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  /* ── Save as draft ── */
  const saveDraftSession = useCallback(async (id) => {
    if (!uidRef.current) return;
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'draft' } : s));
    try {
      await upsertExternalTransaction(uidRef.current, { id, status: 'draft' });
    } catch (err) {
      console.error('[saveDraftSession] Firestore write failed:', err);
    }
  }, []);

  /* ── Discard session ── */
  const discardSession = useCallback(async (id, { onDeleteIncome, onDeleteTransaction } = {}) => {
    if (!uidRef.current) return;
    const session = sessions.find((s) => s.id === id);
    if (session?.settlementId) {
      if (session.settlementType === 'income' && onDeleteIncome) {
        onDeleteIncome(session.settlementId);
      } else if (session.settlementType === 'expense' && onDeleteTransaction) {
        onDeleteTransaction(session.settlementId);
      }
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteExternalTransaction(uidRef.current, id);
    } catch (err) {
      console.error('[discardSession] Firestore delete failed:', err);
    }
  }, [sessions]);

  /* ── Close session + settle into income/expense idempotently ── */
  const closeSession = useCallback(
    async (
      sessionId,
      { netBalance, items, received, total_received, total_spent, sessionDate, sessionName },
      { onAddIncome, onUpdateIncome, onDeleteIncome, onAddTransaction, onUpdateTransaction, onDeleteTransaction }
    ) => {
      if (!uidRef.current) return;

      const session = sessions.find((s) => s.id === sessionId);
      const existingSettlementId = session?.settlementId;
      const existingSettlementType = session?.settlementType;

      // Build person label (comma-separated if multiple)
      const persons = received
        .filter((r) => r.person?.trim() && r.amount > 0)
        .map((r) => r.person.trim())
        .join(', ') || sessionName || 'External';

      const dateForEntry = sessionDate || new Date().toISOString();
      const month = isoToMonth(dateForEntry);

      let settlementId = existingSettlementId || null;
      let settlementType = existingSettlementType || null;

      if (netBalance > 0) {
        // PROFIT → Income tab
        const incomeData = {
          name: persons,
          amount: netBalance,
          type: 'income',
          tag: 'External Settlement',
          date: dateForEntry,
          month,
          externalSessionId: sessionId,
        };

        if (existingSettlementId && existingSettlementType === 'income') {
          settlementId = existingSettlementId;
          settlementType = 'income';
          if (onUpdateIncome) {
            await onUpdateIncome({ id: settlementId, ...incomeData });
          }
        } else {
          if (existingSettlementId && existingSettlementType === 'expense' && onDeleteTransaction) {
            await onDeleteTransaction(existingSettlementId);
          }
          settlementId = generateId();
          settlementType = 'income';
          if (onAddIncome) {
            await onAddIncome({ id: settlementId, ...incomeData });
          }
        }
      } else if (netBalance < 0) {
        // LOSS → Expense tab
        const expenseData = {
          name: `External – ${persons}`,
          amount: Math.abs(netBalance),
          type: 'expense',
          category: 'External',
          date: dateForEntry,
          month,
          externalSessionId: sessionId,
        };

        if (existingSettlementId && existingSettlementType === 'expense') {
          settlementId = existingSettlementId;
          settlementType = 'expense';
          if (onUpdateTransaction) {
            await onUpdateTransaction({ id: settlementId, ...expenseData });
          }
        } else {
          if (existingSettlementId && existingSettlementType === 'income' && onDeleteIncome) {
            await onDeleteIncome(existingSettlementId);
          }
          settlementId = generateId();
          settlementType = 'expense';
          if (onAddTransaction) {
            await onAddTransaction({ id: settlementId, ...expenseData });
          }
        }
      } else {
        // netBalance === 0 → Perfectly settled
        if (existingSettlementId) {
          if (existingSettlementType === 'income' && onDeleteIncome) {
            await onDeleteIncome(existingSettlementId);
          } else if (existingSettlementType === 'expense' && onDeleteTransaction) {
            await onDeleteTransaction(existingSettlementId);
          }
        }
        settlementId = null;
        settlementType = null;
      }

      const finalPatch = {
        items,
        received,
        total_received,
        total_spent,
        net_balance: netBalance,
        settlementId,
        settlementType,
        closedAt: new Date().toISOString(),
      };

      try {
        await closeExternalTransaction(uidRef.current, sessionId, finalPatch);
      } catch (err) {
        console.error('[closeSession] Firestore close failed:', err);
        throw err;
      }
    },
    [sessions]
  );

  /* ── Delete session ── */
  const deleteSession = useCallback(
    async (id, { onDeleteIncome, onDeleteTransaction } = {}) => {
      if (!uidRef.current) return;
      const session = sessions.find((s) => s.id === id);
      if (session?.settlementId) {
        if (session.settlementType === 'income' && onDeleteIncome) {
          onDeleteIncome(session.settlementId);
        } else if (session.settlementType === 'expense' && onDeleteTransaction) {
          onDeleteTransaction(session.settlementId);
        }
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        await deleteExternalTransaction(uidRef.current, id);
      } catch (err) {
        console.error('[deleteSession] Firestore delete failed:', err);
      }
    },
    [sessions]
  );

  /* ── Reopen a closed/draft session for editing (set back to open) ── */
  const reopenSession = useCallback(async (id) => {
    if (!uidRef.current) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'open' } : s)));
    try {
      await upsertExternalTransaction(uidRef.current, { id, status: 'open' });
    } catch (err) {
      console.error('[reopenSession] Firestore write failed:', err);
    }
  }, []);

  return {
    sessions,
    saving,
    createSession,
    updateSession,
    saveDraftSession,
    discardSession,
    closeSession,
    deleteSession,
    reopenSession,
  };
}
