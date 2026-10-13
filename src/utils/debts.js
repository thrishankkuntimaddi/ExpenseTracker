// ─── Debts ───────────────────────────────────────────────────────
// Everyone you lent money to or borrowed from, with every entry from BOTH
// stores: lending and paying back are transactions; money borrowed and money
// returned to you are income (cash came in). "Given — no return expected" is
// spending, not a debt, so it never shows up here.
//
// A move is one of:
//   lent       you gave money, expect it back          transaction person/lent
//   got_back   they returned money you lent            income isRepaymentRec  (or legacy person/repayment)
//   borrowed   you took money, owe it back             income isBorrowed      (or legacy person/borrowed)
//   paid_back  you returned money you borrowed         transaction person/repaid
import { incomeKind } from './finance';

export const DEBT_MOVES = {
  lent:      { label: 'Lent',      hint: 'You gave money — they’ll return it', tone: 'lent',          sign: +1 },
  got_back:  { label: 'Got back',  hint: 'They returned money you lent',        tone: 'income',        sign: -1 },
  borrowed:  { label: 'Borrowed',  hint: 'You took money — you’ll return it',   tone: 'borrowed',      sign: -1 },
  paid_back: { label: 'Paid back', hint: 'You returned money you borrowed',     tone: 'repayment-rec', sign: +1 },
};
export const DEBT_MOVE_KEYS = Object.keys(DEBT_MOVES);

const TX_MOVE = { lent: 'lent', repaid: 'paid_back', borrowed: 'borrowed', repayment: 'got_back' };

/** The debt move an entry records, or null. `source` is 'transaction' | 'income'. */
export function debtMoveOf(entry, source) {
  if (!entry) return null;
  if (source === 'income') {
    const k = incomeKind(entry);
    return k === 'repayment' ? 'got_back' : k === 'borrowed' ? 'borrowed' : null;
  }
  if (entry.type !== 'person') return null;
  return TX_MOVE[entry.direction ?? 'lent'] ?? null;   // given_gift → null
}

/** Where a move is stored, and the fields that mark it. */
export function debtEntryFields(move) {
  switch (move) {
    case 'lent':      return { store: 'transaction', fields: { type: 'person', direction: 'lent' } };
    case 'paid_back': return { store: 'transaction', fields: { type: 'person', direction: 'repaid' } };
    case 'borrowed':  return { store: 'income', fields: { type: 'income', isBorrowed: true, isRepaymentRec: false } };
    case 'got_back':  return { store: 'income', fields: { type: 'income', isBorrowed: false, isRepaymentRec: true } };
    default: return null;
  }
}

const paise = (n) => Math.round((Number(n) || 0) * 100);
const norm = (name) => String(name ?? '').trim().toLowerCase();

/**
 * Per person: what is still open, newest activity first within each group.
 * @returns {Array<{ key, name, net, theyOwe, iOwe, lent, gotBack, borrowed, paidBack, entries, lastDate, settled }>}
 *   net > 0 → they owe you; net < 0 → you owe them.
 */
export function debtLedger(transactions = [], income = []) {
  const map = new Map();
  const add = (entry, source) => {
    const move = debtMoveOf(entry, source);
    const key = norm(entry.name);
    if (!move || !key) return;
    if (!map.has(key)) map.set(key, { key, name: entry.name.trim(), sums: { lent: 0, got_back: 0, borrowed: 0, paid_back: 0 }, entries: [] });
    const p = map.get(key);
    p.sums[move] += paise(entry.amount);
    p.entries.push({ id: entry.id, source, move, amount: Number(entry.amount) || 0, date: entry.date, note: entry.note, entry });
  };
  transactions.forEach((t) => add(t, 'transaction'));
  income.forEach((i) => { if (!i.isCarryForward) add(i, 'income'); });

  return [...map.values()].map(({ key, name, sums, entries }) => {
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    const theyOwe = sums.lent - sums.got_back;
    const iOwe = sums.borrowed - sums.paid_back;
    const net = (theyOwe - iOwe) / 100;
    return {
      key, name, net,
      theyOwe: Math.max(0, theyOwe) / 100, iOwe: Math.max(0, iOwe) / 100,
      lent: sums.lent / 100, gotBack: sums.got_back / 100, borrowed: sums.borrowed / 100, paidBack: sums.paid_back / 100,
      entries, lastDate: entries[0]?.date ?? null, settled: Math.abs(net) < 0.005,
    };
  }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || new Date(b.lastDate) - new Date(a.lastDate));
}

/** Totals across everyone: owed to you, you owe. */
export function debtTotals(ledger) {
  return ledger.reduce((s, p) => ({
    owedToYou: s.owedToYou + Math.max(0, p.net),
    youOwe: s.youOwe + Math.max(0, -p.net),
  }), { owedToYou: 0, youOwe: 0 });
}
