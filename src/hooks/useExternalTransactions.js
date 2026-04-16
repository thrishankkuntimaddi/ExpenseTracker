// ─── useExternalTransactions hook ────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToExternalTransactions,
  upsertExternalTransaction,
  closeExternalTransaction,
  deleteExternalTransaction,
} from "../services/firestore";
import { generateId } from "../utils/storage";

const DEBOUNCE_MS = 500;

/**
 * Real-time hook for the External / Proxy Spending ledger.
 *
 * Exposes:
 *   sessions        — all external_transaction docs (latest first)
 *   activeSession   — the current "open" session (if any)
 *   createSession() — starts a brand-new open session
 *   updateSession(patch) — debounced merge into the active session
 *   closeSession(sessionId, settlementEntry, onAddIncome, onAddTransaction)
 *   deleteSession(id)
 *   saving          — true while a debounced write is in-flight
 */
export function useExternalTransactions(uid) {
  const [sessions, setSessions]   = useState([]);
  const [saving, setSaving]       = useState(false);

  const uidRef         = useRef(uid);
  uidRef.current       = uid;
  const debounceTimer  = useRef(null);

  /* ── Subscribe to Firestore ── */
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToExternalTransactions(uid, (docs) => {
      setSessions(docs);
    });
    return unsub;
  }, [uid]);

  /* ── Derived: the one open session ── */
  const activeSession = sessions.find((s) => s.status === "open") ?? null;

  /* ── Create a fresh open session ── */
  const createSession = useCallback(async () => {
    if (!uidRef.current) return;
    const now = new Date().toISOString();
    const session = {
      id: generateId(),
      date: now,
      items:          [{ id: generateId(), name: "", amount: null }],
      received:       [{ id: generateId(), person: "", amount: null }],
      total_received: 0,
      total_spent:    0,
      net_balance:    0,
      status:         "open",
    };
    // Optimistic local update
    setSessions((prev) => [session, ...prev]);
    try {
      await upsertExternalTransaction(uidRef.current, session);
    } catch (err) {
      console.error("[createSession] Firestore write failed:", err);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    }
  }, []);

  /* ── Debounced update — merges patch into the active session ── */
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
        console.error("[updateSession] Firestore write failed:", err);
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  /* ── Close session + settle into income/expense ── */
  const closeSession = useCallback(
    async (sessionId, { netBalance, items, received, total_received, total_spent }, onAddIncome, onAddTransaction) => {
      if (!uidRef.current) return;

      // Build person label (comma-separated if multiple)
      const persons = received
        .filter((r) => r.person?.trim() && r.amount > 0)
        .map((r) => r.person.trim())
        .join(", ") || "External";

      const finalPatch = {
        items,
        received,
        total_received,
        total_spent,
        net_balance: netBalance,
      };

      try {
        await closeExternalTransaction(uidRef.current, sessionId, finalPatch);
      } catch (err) {
        console.error("[closeSession] Firestore close failed:", err);
        throw err; // re-throw so UI can handle
      }

      const now   = new Date().toISOString();
      const month = now.slice(0, 7);

      if (netBalance > 0) {
        // PROFIT → Income tab
        onAddIncome({
          id:     generateId(),
          name:   persons,
          amount: netBalance,
          type:   "income",
          tag:    "External Settlement",
          date:   now,
          month,
        });
      } else if (netBalance < 0) {
        // LOSS → Expense tab
        onAddTransaction({
          id:       generateId(),
          name:     `External – ${persons}`,
          amount:   Math.abs(netBalance),
          type:     "expense",
          category: "External",
          date:     now,
          month,
        });
      }
      // net_balance === 0 → perfectly settled; no entry needed
    },
    []
  );

  /* ── Delete session ── */
  const deleteSession = useCallback(async (id) => {
    if (!uidRef.current) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteExternalTransaction(uidRef.current, id);
    } catch (err) {
      console.error("[deleteSession] Firestore delete failed:", err);
    }
  }, []);

  return {
    sessions,
    activeSession,
    saving,
    createSession,
    updateSession,
    closeSession,
    deleteSession,
  };
}
