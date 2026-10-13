import { describe, it, expect } from 'vitest';
import { debtLedger, debtTotals, debtMoveOf, debtEntryFields } from '../debts';

const d = (day) => new Date(2026, 9, day, 12).toISOString();
const tx = (name, direction, amount, day, extra = {}) => ({ id: `t-${name}-${direction}-${day}`, type: 'person', name, direction, amount, date: d(day), ...extra });
const inc = (name, kind, amount, day) => ({ id: `i-${name}-${kind}-${day}`, type: 'income', name, amount, date: d(day), isBorrowed: kind === 'borrowed', isRepaymentRec: kind === 'repayment' });

describe('debts', () => {
  it('money paid back to you (recorded as income) settles what you lent', () => {
    const ledger = debtLedger([tx('Ravi', 'lent', 500, 1)], [inc('ravi ', 'repayment', 500, 5)]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ name: 'Ravi', net: 0, settled: true, lent: 500, gotBack: 500 });
    expect(ledger[0].entries.map((e) => e.move)).toEqual(['got_back', 'lent']);
  });
  it('borrowed (income) minus paid back (transaction) is what you owe', () => {
    const [p] = debtLedger([tx('Amma', 'repaid', 1000, 9)], [inc('Amma', 'borrowed', 3000, 2)]);
    expect(p).toMatchObject({ net: -2000, iOwe: 2000, settled: false });
  });
  it('gifts are spending, never debts', () => {
    expect(debtLedger([tx('Sita', 'given_gift', 200, 3)], [])).toEqual([]);
    expect(debtMoveOf({ type: 'person', direction: 'given_gift' }, 'transaction')).toBeNull();
    expect(debtMoveOf({ name: 'Salary' }, 'income')).toBeNull();
  });
  it('totals and ordering: biggest open balance first', () => {
    const ledger = debtLedger([tx('A', 'lent', 100, 1), tx('B', 'lent', 900, 2)], [inc('C', 'borrowed', 300, 3)]);
    expect(ledger.map((p) => p.name)).toEqual(['B', 'C', 'A']);
    expect(debtTotals(ledger)).toEqual({ owedToYou: 1000, youOwe: 300 });
  });
  it('carry-forward lines are not debts; paise stay exact', () => {
    const ledger = debtLedger([tx('X', 'lent', 0.1, 1), tx('X', 'lent', 0.2, 2)], [{ ...inc('X', 'repayment', 0.3, 3), isCarryForward: true }]);
    expect(ledger[0].net).toBe(0.3);
  });
  it('each move is stored where the rest of the app expects it', () => {
    expect(debtEntryFields('lent')).toEqual({ store: 'transaction', fields: { type: 'person', direction: 'lent' } });
    expect(debtEntryFields('paid_back').fields.direction).toBe('repaid');
    expect(debtEntryFields('borrowed')).toMatchObject({ store: 'income', fields: { isBorrowed: true } });
    expect(debtEntryFields('got_back')).toMatchObject({ store: 'income', fields: { isRepaymentRec: true } });
  });
});
