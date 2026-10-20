// ─── What an entry is, in plain words ────────────────────────────
// History lists both stores (transactions + money in) in one list. Each
// entry gets one kind: its label, its colour, and whether money came in (+)
// or went out (−). Colours match the Debt form (utils/debts.js DEBT_MOVES).
import { incomeKind } from './finance';

export const ENTRY_KINDS = {
  income:    { label: 'Income',    tone: 'income',        sign: +1 },
  borrowed:  { label: 'Borrowed',  tone: 'borrowed',      sign: +1 },
  got_back:  { label: 'Got back',  tone: 'income',        sign: +1 },
  billing:   { label: 'Billing',   tone: 'external',      sign: +1 },
  expense:   { label: 'Expense',   tone: 'expense',       sign: -1 },
  given:     { label: 'Given',     tone: 'given',         sign: -1 },
  lent:      { label: 'Lent',      tone: 'lent',          sign: -1 },
  paid_back: { label: 'Paid back', tone: 'repayment-rec', sign: -1 },
  savings:   { label: 'Savings',   tone: 'savings',       sign: -1 },
  // Cash taken out of the account: it moves to your wallet — neither in nor out
  withdrawal: { label: 'Withdrew cash', tone: 'lent',       sign: 0 },
};
/* Filter chip order: money in first, then money out */
export const ENTRY_KIND_ORDER = ['income', 'borrowed', 'got_back', 'billing', 'expense', 'given', 'lent', 'paid_back', 'savings', 'withdrawal'];

const PERSON_KIND = { lent: 'lent', repaid: 'paid_back', given_gift: 'given', borrowed: 'borrowed', repayment: 'got_back' };

/** The kind of a stored entry. `source` is 'transaction' | 'income'. */
export function entryKind(entry, source = 'transaction') {
  if (source === 'income') {
    const k = incomeKind(entry);
    return k === 'repayment' ? 'got_back' : k === 'borrowed' ? 'borrowed' : 'income';
  }
  if (entry?.type === 'person') return PERSON_KIND[entry.direction ?? 'lent'] ?? 'lent';
  if (entry?.type === 'savings') return 'savings';
  if (entry?.type === 'external') return 'billing';
  if (entry?.type === 'cash') return 'withdrawal';
  return 'expense';
}

/** Debts stay "open" until the person's balance is back to zero. */
export const isDebtKind = (kind) => kind === 'lent' || kind === 'borrowed' || kind === 'got_back' || kind === 'paid_back';
