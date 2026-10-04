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
