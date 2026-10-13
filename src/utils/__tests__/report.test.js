import { describe, it, expect } from 'vitest';
import { latestReportDay, reportWindow, buildReport, windowLabel, getReportSettings, shiftReportDay } from '../report';

const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const salary = (y, m, d, amount = 50000) => ({ id: `sal-${m}-${d}`, type: 'income', name: 'Salary', amount, date: at(y, m, d) });
const spend = (m, d, amount, category = 'food', name = 'x') => ({ id: `e-${m}-${d}-${amount}-${category}`, type: 'expense', name, amount, category, date: at(2026, m, d) });

describe('report day', () => {
  it('the latest report day on or before today', () => {
    expect(latestReportDay(4, '2026-11-10')).toBe('2026-11-04');
    expect(latestReportDay(15, '2026-11-10')).toBe('2026-10-15');
    expect(latestReportDay(1, '2026-01-01')).toBe('2026-01-01');
    expect(shiftReportDay('2026-01-04', 4, -1)).toBe('2025-12-04');
  });
  it('settings are clamped to 1–28', () => {
    expect(getReportSettings({ report: { day: 31 } }).day).toBe(1);
    expect(getReportSettings({ report: { day: 4 } }).day).toBe(4);
    expect(getReportSettings(null).day).toBe(1);
  });
});

describe('report window: salary to salary', () => {
  it('starts on the day last month’s salary arrived', () => {
    const w = reportWindow('2026-11-04', [salary(2026, 10, 5)]);
    expect(w).toMatchObject({ start: '2026-10-05', end: '2026-11-04', last: '2026-11-03', days: 30 });
    expect(windowLabel(w.start, w.last)).toBe('5 Oct – 3 Nov');
  });
  it('ends early when this month’s salary came before the report day', () => {
    const w = reportWindow('2026-11-04', [salary(2026, 10, 1), salary(2026, 11, 1)]);
    expect(w).toMatchObject({ start: '2026-10-01', end: '2026-11-01' });
  });
  it('no income last month → one month back from the report day; the biggest income wins', () => {
    expect(reportWindow('2026-11-04', []).start).toBe('2026-10-04');
    const w = reportWindow('2026-11-04', [{ ...salary(2026, 10, 2, 500), name: 'Parents' }, salary(2026, 10, 7)]);
    expect(w.start).toBe('2026-10-07');
  });
});

describe('buildReport', () => {
  const income = [salary(2026, 9, 1), salary(2026, 10, 1)];
  const transactions = [
    spend(9, 3, 1000, 'food'), spend(9, 4, 2000, 'shopping'), spend(9, 6, 500, 'fuel'), spend(9, 8, 300, 'personal'),
    spend(10, 3, 2000, 'food'), spend(10, 4, 500, 'shopping'), spend(10, 6, 520, 'fuel'), spend(10, 9, 800, 'travel', 'Train'),
    { id: 's1', type: 'savings', amount: 5000, date: at(2026, 10, 2) },
  ];
  const rent = { id: 'rent', name: 'Rent', amount: 13000, kind: 'expense', frequency: 'monthly', dayOfMonth: 5, startDate: '2026-01-01', active: true };
  const r = buildReport({ transactions, income, recurring: [rent], budgets: { categories: { food: 1500 } }, reportKey: '2026-11-01', day: 1, todayKey: '2026-11-02' });

  it('totals for the window', () => {
    expect(r).toMatchObject({ start: '2026-10-01', last: '2026-10-31', income: 50000, spent: 3820, saved: 5000, left: 41180, savingsRate: 10 });
    expect(r.biggest).toMatchObject({ amount: 2000 });
    expect(r.prev.spent).toBe(3800);
  });
  it('what went up, down, stayed the same, started and stopped', () => {
    expect(r.up.map((c) => [c.key, c.change])).toEqual([['food', 'up'], ['travel', 'new']]);
    expect(r.down.map((c) => [c.key, c.change])).toEqual([['shopping', 'down'], ['personal', 'stopped']]);
    expect(r.steady.map((c) => c.key)).toEqual(['fuel']);
  });
  it('bills not paid in the window, and categories over budget', () => {
    expect(r.missed).toEqual([{ name: 'Rent', dateKey: '2026-10-05', amount: 13000, skipped: false }]);
    const paid = buildReport({ transactions: [...transactions, { id: 'rec_rent_2026-10-05', type: 'expense', amount: 13000, date: at(2026, 10, 5) }], income, recurring: [rent], reportKey: '2026-11-01', day: 1, todayKey: '2026-11-02' });
    expect(paid.missed).toEqual([]);
    expect(r.over).toEqual([{ key: 'food', label: 'Food & Dining', limit: 1500, spent: 2000 }]);
  });
});
