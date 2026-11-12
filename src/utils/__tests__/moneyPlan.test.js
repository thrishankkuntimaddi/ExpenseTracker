import { describe, it, expect } from 'vitest';
import { computeMoneyPlan, bucketTotals, isEmiEntry, emergencyCover } from '../moneyPlan';

const iso = (k) => `${k}T10:00:00.000Z`;
const M = '2026-10';
const txns = [
  { id: 1, type: 'expense', name: 'House rent', amount: 10000, date: iso('2026-10-05') },        // essentials
  { id: 2, type: 'expense', name: 'Groceries', amount: 3000, date: iso('2026-10-06') },          // essentials
  { id: 3, type: 'expense', name: 'Swiggy', amount: 3000, date: iso('2026-10-07') },             // lifestyle
  { id: 4, type: 'expense', name: 'Personal loan EMI', amount: 30000, date: iso('2026-10-08') }, // emi
  { id: 5, type: 'expense', name: 'Dad loan', amount: 2000, date: iso('2026-10-09'), category: 'responsibility', responsibilityId: 'r' }, // emi
  { id: 6, type: 'savings', name: 'SIP', amount: 5000, date: iso('2026-10-10') },                // investments
  { id: 7, type: 'person', direction: 'repaid', name: 'Ravi', amount: 1000, date: iso('2026-10-11') }, // emi
  { id: 8, type: 'person', direction: 'lent', name: 'Kiran', amount: 4000, date: iso('2026-10-12') },  // not counted
  { id: 9, type: 'expense', name: 'FD broke for laptop', amount: 50000, date: iso('2026-10-13'), paidFrom: 'savings' }, // skipped
  { id: 10, type: 'cash', name: 'ATM', amount: 2000, date: iso('2026-10-14') },                  // neutral
  { id: 11, type: 'expense', name: 'Rent', amount: 9000, date: iso('2026-09-05') },              // other month
];
const income = [
  { id: 'i1', amount: 60000, date: iso('2026-10-01') },
  { id: 'i2', amount: 5000, isBorrowed: true, date: iso('2026-10-02') },
];

describe('money plan', () => {
  it('detects EMIs', () => {
    expect(isEmiEntry({ type: 'expense', name: 'Car loan EMI' })).toBe(true);
    expect(isEmiEntry({ type: 'expense', name: 'Bike instalment' })).toBe(true);
    expect(isEmiEntry({ type: 'expense', name: 'Lemon' })).toBe(false);
    expect(isEmiEntry({ type: 'savings', name: 'Loan fund' })).toBe(false);
  });
  it('sorts the month into buckets', () => {
    expect(bucketTotals(txns, M)).toEqual({ essentials: 13000, lifestyle: 3000, emis: 33000, investments: 5000, lent: 4000 });
  });
  it('compares each bucket with income (borrowed money is not income)', () => {
    const p = computeMoneyPlan({ transactions: txns, income, monthKey: M });
    expect(p.income).toBe(60000);
    expect(p.leftover).toBe(6000);
    const row = Object.fromEntries(p.rows.map((r) => [r.key, r]));
    expect(row.essentials.pct).toBeCloseTo(21.67, 1);
    expect(row.essentials.ok).toBe(true);
    expect(row.emis.pct).toBeCloseTo(55, 6);
    expect(row.emis.ok).toBe(false);
    expect(row.investments.ok).toBe(false);
    expect(row.leftover.text).toMatch(/emergency/);
    expect(p.score).toBe(2);
  });
  it('can use the expected salary instead', () => {
    expect(computeMoneyPlan({ transactions: txns, income: [], monthKey: M, incomeBase: 100000 }).income).toBe(100000);
  });
  it('overspending shows as a negative leftover', () => {
    const p = computeMoneyPlan({ transactions: txns, income: [{ amount: 40000, date: iso('2026-10-01') }], monthKey: M });
    expect(p.leftover).toBe(-14000);
    expect(p.rows.at(-1).ok).toBe(false);
  });
  it('emergency fund cover in months', () => {
    const e = emergencyCover(txns, M);
    expect(e.saved).toBe(0); // 5000 saved − 50000 taken out → floored at 0
    const e2 = emergencyCover([...txns, { type: 'savings', amount: 200000, date: iso('2026-01-01') }], M);
    expect(e2.monthlyNeed).toBeCloseTo((46000 + 9000) / 2, 0);
    expect(e2.months).toBeCloseTo(155000 / 27500, 2);
  });
});
