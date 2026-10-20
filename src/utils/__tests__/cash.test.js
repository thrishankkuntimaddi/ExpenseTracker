import { describe, it, expect } from 'vitest';
import { cashSummary, isCashSpend } from '../cash';
import { computeStats } from '../finance';

const d = (day) => new Date(2026, 9, day, 12).toISOString();
const txns = [
  { id: 'w1', type: 'cash', name: 'ATM', amount: 2000, date: d(1) },
  { id: 'e1', type: 'expense', name: 'Vegetables', amount: 300, paidWith: 'cash', date: d(2) },
  { id: 'e2', type: 'expense', name: 'Swiggy', amount: 450, date: d(2) },                      // UPI
  { id: 'g1', type: 'person', direction: 'given_gift', name: 'Maid', amount: 500, paidWith: 'cash', date: d(3) },
  { id: 'l1', type: 'person', direction: 'lent', name: 'Ravi', amount: 100, paidWith: 'cash', date: d(3) }, // not spending
];

describe('cash in hand', () => {
  it('is withdrawn minus what was spent in cash', () => {
    const c = cashSummary(txns, '2026-10');
    expect(c.used).toBe(true);
    expect(c.withdrawn).toBe(2000);
    expect(c.spent).toBe(800);
    expect(c.inHand).toBe(1200);
    expect(c.monthSpent).toBe(800);
  });

  it('only expenses and gifts count as cash spending', () => {
    expect(txns.filter(isCashSpend).map((t) => t.id)).toEqual(['e1', 'g1']);
  });

  it('shows nothing for an account that never used cash', () => {
    expect(cashSummary([{ id: 'e', type: 'expense', name: 'x', amount: 5, date: d(1) }]).used).toBe(false);
  });

  it('a withdrawal changes neither spending, savings nor the balance', () => {
    const inc = [{ id: 'i', name: 'Salary', amount: 10000, date: d(1) }];
    const without = computeStats(txns.filter((t) => t.type !== 'cash'), inc, {});
    const withIt = computeStats(txns, inc, {});
    expect(withIt.balance).toBe(without.balance);
    expect(withIt.totalExpense).toBe(without.totalExpense);
    expect(withIt.totalSavings).toBe(0);
  });
});
