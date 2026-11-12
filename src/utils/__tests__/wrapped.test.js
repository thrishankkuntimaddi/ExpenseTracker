import { describe, it, expect } from 'vitest';
import { wrappedStats, wrappedCard, wrappedText, yearWindow } from '../wrapped';

const iso = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).toISOString(); };
const e = (name, amount, k, extra = {}) => ({ id: `${name}${k}${amount}`, type: 'expense', name, amount, date: iso(k), ...extra });
const win = { start: '2026-10-01', last: '2026-10-10', label: '1–10 Oct' };
const txns = [
  e('Swiggy', 400, '2026-10-01', { category: 'food' }), e('Swiggy', 300, '2026-10-02', { category: 'food' }), e('Swiggy', 300, '2026-10-05', { category: 'food' }),
  e('Rent', 9000, '2026-10-03'), { id: 's', type: 'savings', name: 'SIP', amount: 6000, date: iso('2026-10-04') },
  e('Old', 999, '2026-09-30'),
];
const income = [{ amount: 30000, date: iso('2026-10-01') }];

describe('wrapped', () => {
  const w = wrappedStats({ transactions: txns, income, rules: {}, win });
  it('counts habits and shares', () => {
    expect(w.entries).toBe(6);
    expect(w.days).toBe(10);
    expect(w.noSpend).toBe(6);          // 1, 2, 3, 5 had spending
    expect(w.bestRun).toBe(5);          // 1–5 all have an entry
    expect(w.savingsRate).toBe(20);
    expect(w.categories[0]).toMatchObject({ key: 'rent', share: 90 });
    expect(w.regulars[0]).toMatchObject({ name: 'Swiggy', count: 3 });
  });
  it('hides amounts unless asked', () => {
    const money = (n) => `₹${n}`;
    const plain = JSON.stringify(wrappedCard(w, { money }));
    expect(plain).not.toContain('₹');
    expect(plain).toContain('90%');
    const full = JSON.stringify(wrappedCard(w, { money, showAmounts: true }));
    expect(full).toContain('₹10000');
    expect(wrappedText(w, { money, appUrl: 'https://x.app/' })).toContain('Tracked with Expense Tracker — https://x.app/');
    expect(wrappedText(w, { money })).not.toContain('₹');
  });
  it('the year: so far, or last year in January', () => {
    expect(yearWindow('2026-11-12')).toEqual({ start: '2026-01-01', last: '2026-11-12', label: '2026 so far' });
    expect(yearWindow('2027-01-05')).toEqual({ start: '2026-01-01', last: '2026-12-31', label: '2026' });
  });
});
