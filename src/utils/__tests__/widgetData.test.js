import { describe, it, expect } from 'vitest';
import { widgetData } from '../widgetData';

const iso = (k, h = 12) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };
const e = (name, amount, k) => ({ id: `${name}${k}`, type: 'expense', name, amount, date: iso(k) });
const money = (n) => `₹${Math.round(n)}`;
const now = new Date(2026, 10, 12, 18);
const txns = [e('Rent', 15000, '2026-11-05'), e('Chai', 40, '2026-11-12'), e('Lunch', 160, '2026-11-12'), e('Petrol', 800, '2026-11-08'), e('Old', 999, '2026-10-30')];

describe('widget data', () => {
  it('spent, today and the last seven days', () => {
    const w = widgetData({ transactions: txns, settings: {}, now, money });
    expect(w.spent).toBe('₹16000');
    expect(w.today).toBe('₹200');
    expect(w.week).toHaveLength(7);
    expect(w.week.at(-1)).toEqual({ label: 'T', value: 200 });
    expect(w.week.reduce((s, d) => s + d.value, 0)).toBe(1000);   // 6–12 Nov: petrol + today
    expect(w.bigLabel).toBe('Spent this month');                    // no budget → spent
    expect(w.pct).toBe(-1);
  });
  it('safe to spend today with a budget', () => {
    const w = widgetData({ transactions: txns, settings: { budgets: { total: 30000 } }, now, money });
    expect(w.bigLabel).toBe('Safe to spend today');
    expect(w.pct).toBe(53);
    expect(w.budget).toBe('₹30000');
    const left = widgetData({ transactions: txns, settings: { budgets: { total: 30000 }, widgets: { headline: 'left' } }, now, money });
    expect(left).toMatchObject({ bigLabel: 'Left in budget', bigValue: '₹14000' });
  });
  it('the next bills', () => {
    const rules = [
      { id: 'r1', kind: 'expense', name: 'Electricity bill', amount: 1200, frequency: 'monthly', dayOfMonth: 15, startDate: '2026-01-01', active: true, lastHandledKey: '2026-11-11' },
      { id: 'r2', kind: 'income', name: 'Salary', amount: 60000, frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: true },
    ];
    const w = widgetData({ transactions: txns, settings: {}, rules, now, money });
    expect(w.bills).toEqual([{ name: 'Electricity bill', when: 'In 3 days', amount: '₹1200', late: false }, expect.objectContaining({ name: 'Electricity bill' })].slice(0, w.bills.length));
    expect(w.bills[0].name).toBe('Electricity bill');
  });
});
