// ─── usePaymentCapture ────────────────────────────────────────────
// Detected UPI / bank payments waiting for a tap: Add puts them in the
// ledger (expense for money out, income for money in), Ignore forgets them.
// Refreshes when the app opens, comes back to the front, or a payment
// notification arrives while it's open.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { captureSupported, captureStatus, capturedNotifications, forgetCaptured, onCaptured } from '../native/paymentCapture';
import { parsePayment, mergeDetections, detectionToEntry, withoutKnown } from '../utils/paymentCapture';
import { inferCategory } from '../utils/categories';

export function usePaymentCapture({ transactions = [], income = [], onAddExpense, onAddIncome, rules } = {}) {
  const [status, setStatus] = useState({ enabled: false, allowed: false });
  const [raw, setRaw] = useState([]);

  const refresh = useCallback(async () => {
    if (!captureSupported) return;
    const [s, items] = await Promise.all([captureStatus(), capturedNotifications()]);
    setStatus(s); setRaw(items);
  }, []);

  useEffect(() => {
    if (!captureSupported) return undefined;
    Promise.resolve().then(refresh);
    const stop = onCaptured(() => refresh());
    const h = CapApp.addListener('resume', refresh);
    return () => { stop(); Promise.resolve(h).then((x) => x?.remove?.()); };
  }, [refresh]);

  // Already in the ledger → not offered again: added from here (same id), or
  // typed by hand / imported (same amount within a day). One ledger, never doubles.
  const detections = useMemo(() => {
    const parsed = raw.map((n) => { const d = parsePayment(n); return d ? { ...d, id: n.id } : null; }).filter(Boolean);
    return withoutKnown(mergeDetections(parsed), { transactions, income });
  }, [raw, transactions, income]);

  // Notifications that weren't payments, or were added elsewhere: forget them quietly
  useEffect(() => {
    if (!raw.length) return;
    const keep = new Set(detections.flatMap((d) => d.ids));
    const junk = raw.map((n) => n.id).filter((id) => !keep.has(id));
    if (junk.length) forgetCaptured(junk).then(() => setRaw((r) => r.filter((n) => keep.has(n.id))));
  }, [raw, detections]);

  const dismiss = useCallback(async (d) => {
    setRaw((r) => r.filter((n) => !d.ids.includes(n.id)));
    await forgetCaptured(d.ids);
  }, []);

  const add = useCallback(async (d, edits = {}) => {
    const { kind, entry } = detectionToEntry({ ...d, ...edits }, { inferCategory: (n) => inferCategory(n, rules) });
    if (kind === 'income') await onAddIncome?.(entry);
    else await onAddExpense?.(entry);
    await dismiss(d);
    return entry;
  }, [onAddExpense, onAddIncome, dismiss, rules]);

  return { supported: captureSupported, status, detections, add, dismiss, refresh };
}
