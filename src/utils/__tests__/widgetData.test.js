import { describe, it, expect } from 'vitest';
import { widgetData, queuedEntries } from '../widgetData';

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
    expect(w.bigLabel).toBe('Balance');                             // no budget → the Home balance
    expect(w).toMatchObject({ bigValue: '−₹16000', sideLabel: 'Spent', sideValue: '₹16000' });
    expect(w.raw).toMatchObject({ symbol: '₹', big: -16000, bigMode: 'balance', side: 16000, sideMode: 'spent', today: 200 });
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
  it('balance counts income and what was carried in; spent as the headline puts balance beside it', () => {
    const income = [{ id: 'i', type: 'income', name: 'Salary', amount: 30000, date: iso('2026-11-01') }, { id: 'o', type: 'income', name: 'Oct', amount: 2000, date: iso('2026-10-02') }];
    const w = widgetData({ transactions: txns, income, settings: { widgets: { headline: 'spent' } }, now, money });
    // October: 2000 − 999 = 1001 carried in; November: 30000 − 16000
    expect(w).toMatchObject({ bigLabel: 'Spent this month', bigValue: '₹16000', sideLabel: 'Balance', sideValue: '₹15001' });
  });
  it('entries typed on the home screen become ledger entries with fixed ids', () => {
    const at = new Date(2026, 10, 12, 9).getTime();
    const q = queuedEntries([
      { id: 'a-1', kind: 'expense', amount: 120.456, name: ' Tea ', at },
      { id: 'b', kind: 'income', amount: 500, name: '', at },
      { id: 'c', kind: 'savings', amount: 1000, name: 'Gold', at },
      { id: 'bad', kind: 'expense', amount: 0, name: 'x', at },
      { kind: 'expense', amount: 5 },
    ]);
    expect(q.ids).toEqual(['a-1', 'b', 'c', 'bad']);
    expect(q.transactions).toEqual([
      expect.objectContaining({ id: 'w_a-1', type: 'expense', name: 'Tea', amount: 120.46, month: '2026-11' }),
      expect.objectContaining({ id: 'w_c', type: 'savings', name: 'Gold', savingsType: 'other' }),
    ]);
    expect(q.income).toEqual([expect.objectContaining({ id: 'w_b', type: 'income', name: 'Money in', amount: 500 })]);
    expect(queuedEntries(null)).toEqual({ transactions: [], income: [], ids: [] });
  });
});
