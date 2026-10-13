import { describe, it, expect } from 'vitest';
import { computeBudgetStatus, hasAnyBudget, monthPlan } from '../budget';

const now = new Date(2026, 9, 10, 12); // 10 Oct 2026 (31-day month)
const d = (day) => new Date(2026, 9, day, 12).toISOString();

describe('computeBudgetStatus', () => {
  const budgets = { total: 30000, categories: { food: 6000, transport: 2000 } };
  const txns = [
    { type: 'expense', name: 'Swiggy', amount: 2500, date: d(2) },
    { type: 'expense', name: 'Zomato', amount: 3000, date: d(8) },
    { type: 'expense', name: 'Uber',   amount: 500,  date: d(10) },
    { type: 'expense', name: 'Rent',   amount: 10000, date: d(1) },
    { type: 'savings', name: 'SIP',    amount: 5000, date: d(1) },
    { type: 'expense', name: 'Old',    amount: 9999, date: new Date(2026, 8, 20).toISOString() },
  ];
  const s = computeBudgetStatus({ budgets, transactions: txns, monthKey: '2026-10', now });

  it('tracks the month only and ignores savings', () => {
    expect(s.total.spent).toBe(16000);
    expect(s.total.remaining).toBe(14000);
    expect(s.daysElapsed).toBe(10);
    expect(s.daysLeft).toBe(21);
  });
  it('projects month-end from the daily run-rate', () => {
    expect(Math.round(s.total.projected)).toBe(49600); // 16000/10*31
    expect(s.total.status).toBe('pace');
  });
  it('computes safe-to-spend today including today\'s spend', () => {
    // (14000 + 500 today) / (21 + 1)
    expect(Math.round(s.total.safeToday)).toBe(659);
  });
  it('flags category budgets', () => {
    const food = s.categories.find((c) => c.key === 'food');
    expect(food.spent).toBe(5500);
    expect(food.status).toBe('warn');
    expect(s.alerts.map((a) => a.key)).toContain('food');
  });
  it('handles past months as fully elapsed and no budget gracefully', () => {
    const past = computeBudgetStatus({ budgets, transactions: txns, monthKey: '2026-09', now });
    expect(past.daysElapsed).toBe(30);
    expect(past.total.safeToday).toBeNull();
    expect(hasAnyBudget({ total: null, categories: {} })).toBe(false);
    expect(computeBudgetStatus({ budgets: null, transactions: txns, monthKey: '2026-10', now }).hasBudget).toBe(false);
  });
});

describe('monthPlan', () => {
  const at = (d) => new Date(2026, 9, d, 12).toISOString();
  const rules = [
    { id: 'rent', name: 'Rent', amount: 13000, kind: 'expense', frequency: 'monthly', dayOfMonth: 5, startDate: '2026-01-01', active: true },
    { id: 'sip', name: 'SIP', amount: 5000, kind: 'savings', frequency: 'monthly', dayOfMonth: 10, startDate: '2026-01-01', active: true },
    { id: 'sal', name: 'Salary', amount: 60000, kind: 'income', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: true },
  ];
  const budgets = { total: 20000, deductions: [{ id: 'd1', name: 'PF', amount: 1800 }, { id: 'd2', name: 'TDS', amount: 3200 }] };
  it('income − fixed payments − spending budget = what is left; deductions only shown', () => {
    const p = monthPlan({ budgets, rules, transactions: [], income: [{ id: 'i', type: 'income', name: 'Salary', amount: 55000, date: at(1) }], monthKey: '2026-10', todayKey: '2026-10-13' });
    expect(p).toMatchObject({ incomeBase: 55000, useExpected: false, fixed: 18000, fixedSavings: 5000, spendBudget: 20000, free: 17000, deductionTotal: 5000, gross: 60000 });
    expect(p.fixedItems.map((i) => i.rule.name)).toEqual(['Rent', 'SIP']);
  });
  it('falls back to the expected salary before it arrives; borrowed money is not income', () => {
    const p = monthPlan({ budgets: null, rules, income: [{ id: 'b', type: 'income', name: 'Amma', amount: 9000, isBorrowed: true, date: at(2) }], monthKey: '2026-10', todayKey: '2026-10-13' });
    expect(p).toMatchObject({ incomeBase: 60000, useExpected: true, spendBudget: null, free: 42000 });
  });
});
