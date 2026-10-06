import { describe, it, expect } from 'vitest';
import { generateInsights } from '../insights';
import { computeBudgetStatus } from '../budget';

const now = new Date(2026, 9, 15, 12); // 15 Oct 2026
const oct = (day, extra = {}) => ({ type: 'expense', date: new Date(2026, 9, day, 12).toISOString(), ...extra });
const sep = (day, extra = {}) => ({ type: 'expense', date: new Date(2026, 8, day, 12).toISOString(), ...extra });

describe('generateInsights', () => {
  const transactions = [
    oct(1, { name: 'Swiggy', amount: 400 }), oct(3, { name: 'Swiggy', amount: 350 }), oct(9, { name: 'Swiggy', amount: 450 }),
    oct(5, { name: 'Uber', amount: 300 }), oct(12, { name: 'Rent', amount: 10000, wasteAmount: 0 }),
    oct(14, { name: 'Zomato', amount: 600, wasteAmount: 600 }),
    sep(2, { name: 'Swiggy', amount: 300 }), sep(10, { name: 'Rent', amount: 10000 }), sep(20, { name: 'Shoes', amount: 2000 }),
    { type: 'savings', name: 'SIP', amount: 10000, date: new Date(2026, 9, 2).toISOString() },
    { type: 'person', direction: 'lent', name: 'Ravi', amount: 1500, date: new Date(2026, 8, 1).toISOString() },
  ];
  const income = [{ name: 'Salary', amount: 50000, date: new Date(2026, 9, 1).toISOString() }];

  it('produces the core observations, sorted by priority', () => {
    const list = generateInsights({ transactions, income, now, limit: 20 });
    const ids = list.map((i) => i.id);
    expect(ids).toContain('mtd-vs-last');
    expect(ids).toContain('top-category');
    expect(ids).toContain('top-merchant');
    expect(ids).toContain('no-spend');
    expect(ids).toContain('savings-rate');
    expect(ids).toContain('owed');
    expect(ids).toContain('waste');
    for (let i = 1; i < list.length; i++) expect(list[i].priority).toBeGreaterThanOrEqual(list[i - 1].priority);
  });

  it('reports the merchant seen most often', () => {
    const m = generateInsights({ transactions, income, now, limit: 20 }).find((i) => i.id === 'top-merchant');
    expect(m.title).toMatch(/Swiggy ×3/);
  });

  it('reports a healthy savings rate as good', () => {
    const s = generateInsights({ transactions, income, now }).find((i) => i.id === 'savings-rate');
    expect(s.tone).toBe('good');
    expect(s.title).toMatch(/20%/);
  });

  it('surfaces budget alerts first', () => {
    const budgetStatus = computeBudgetStatus({ budgets: { total: 11000, categories: {} }, transactions, monthKey: '2026-10', now });
    const list = generateInsights({ transactions, income, now, budgetStatus });
    expect(list[0].id).toBe('budget-over');
  });

  it('is quiet on an empty ledger', () => {
    expect(generateInsights({ transactions: [], income: [], now })).toEqual([]);
  });
});
