// ─── Billing session helpers (pure) ──────────────────────────────
import { generateId } from '../../../utils/storage';

export function calcTotals(items, received) {
  const totalSpent    = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalReceived = received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netBalance    = totalReceived - totalSpent;
  return { totalSpent, totalReceived, netBalance };
}

export function newItemRow()     { return { id: generateId(), name: '', amount: '' }; }
export function newReceivedRow() { return { id: generateId(), person: '', amount: '' }; }

/* The overview's numbers: closed billings (the month on screen) as spent / got back, open and drafts apart */
export function billingTotals(closed = [], pending = []) {
  const sum = (list, k) => Math.round(list.reduce((t, s) => t + (Number(s[k]) || 0), 0) * 100) / 100;
  return {
    spent: sum(closed, 'total_spent'),
    back: sum(closed, 'total_received'),
    out: Math.round(closed.reduce((t, s) => t + Math.max(0, -(Number(s.net_balance) || 0)), 0) * 100) / 100,
    pendingSpent: sum(pending, 'total_spent'),
    open: pending.length, closed: closed.length,
  };
}
