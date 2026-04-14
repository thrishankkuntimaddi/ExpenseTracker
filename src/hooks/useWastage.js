// ─── useWastage hook ─────────────────────────────────────────────
// Centralises wastage double-tap logic that was duplicated between
// HistoryTab and DesktopDashboard.
import { useState, useRef, useCallback } from "react";

/**
 * @param {Function} onUpdateTransaction
 * @returns {object} wastage state + handlers
 */
export function useWastage(onUpdateTransaction) {
  const [editingWaste, setEditingWaste] = useState(null);
  const [wasteInput, setWasteInput]     = useState("");
  const wasteInputRef = useRef(null);
  const lastTapRef    = useRef({});

  /** Single tap = toggle full waste; double-tap = open custom input */
  const handleTxnTap = useCallback((txn) => {
    if (txn.type !== "expense") return;
    const now = Date.now();
    const last = lastTapRef.current[txn.id] || 0;
    const D = 400;

    if (now - last < D) {
      // Double-tap → open input
      lastTapRef.current[txn.id] = 0;
      setEditingWaste(txn.id);
      setWasteInput(txn.wasteAmount != null ? String(txn.wasteAmount) : "");
      setTimeout(() => wasteInputRef.current?.focus(), 80);
    } else {
      // Single tap — wait to distinguish from double
      lastTapRef.current[txn.id] = now;
      setTimeout(() => {
        if (lastTapRef.current[txn.id] !== now) return;
        onUpdateTransaction({
          ...txn,
          wasteAmount: txn.wasteAmount === txn.amount ? undefined : txn.amount,
        });
      }, D);
    }
  }, [onUpdateTransaction]);

  const saveWaste = useCallback((txn) => {
    const val = parseFloat(wasteInput);
    onUpdateTransaction({
      ...txn,
      wasteAmount: (!isNaN(val) && val > 0 && val <= txn.amount) ? val : undefined,
    });
    setEditingWaste(null);
    setWasteInput("");
  }, [wasteInput, onUpdateTransaction]);

  const cancelWaste = useCallback(() => {
    setEditingWaste(null);
    setWasteInput("");
  }, []);

  return {
    editingWaste, wasteInput, wasteInputRef,
    handleTxnTap, saveWaste, cancelWaste,
    setWasteInput,
  };
}
