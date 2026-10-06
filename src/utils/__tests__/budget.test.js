import { describe, it, expect } from 'vitest';
import { computeBudgetStatus, hasAnyBudget } from '../budget';

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
