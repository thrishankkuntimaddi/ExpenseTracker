import { describe, it, expect } from 'vitest';
import { balanceTimeline, netBetween, dailyChanges } from '../timeline';

const iso = (k) => `${k}T10:00:00.000Z`;
const txns = [
  { id: 'a', type: 'expense', name: 'Rent', amount: 10000, date: iso('2026-10-05') },
  { id: 'b', type: 'savings', name: 'SIP', amount: 5000, date: iso('2026-10-10') },
  { id: 'c', type: 'cash', name: 'ATM', amount: 2000, date: iso('2026-10-12') },                          // neutral
  { id: 'd', type: 'expense', name: 'Loan', amount: 3000, date: iso('2026-10-20'), paidFrom: 'savings' },  // out of savings
  { id: 'e', type: 'person', direction: 'lent', name: 'Ravi', amount: 1000, date: iso('2026-11-01') },
];
const income = [
  { id: 'i1', name: 'Salary', amount: 40000, date: iso('2026-10-01') },
  { id: 'i2', name: 'Kiran', amount: 700, date: iso('2026-10-31'), isBorrowed: true },
  { id: 'cf', name: 'Carried', amount: 99999, date: iso('2026-11-01'), isCarryForward: true },             // never counted
];

describe('balance timeline', () => {
  it('money in hand: in − out, withdrawals neutral, savings-paid spending not twice', () => {
    const t = balanceTimeline(txns, income, { range: 'ALL', todayKey: '2026-11-03' });
    expect(t.from).toBe('2026-10-01');
    expect(t.points[0]).toEqual({ key: '2026-10-01', value: 40000 });
    expect(t.end).toBe(40000 - 10000 - 5000 + 700 - 1000);
    expect(t.start).toBe(0);
    expect(t.points.at(-1).key).toBe('2026-11-03');   // runs to today
  });

  it('with savings adds what was saved, less what was taken out', () => {
    const t = balanceTimeline(txns, income, { range: 'ALL', withSavings: true, todayKey: '2026-11-03' });
    expect(t.end).toBe(24700 + 5000 - 3000);
  });

  it('a range starts from the balance before it, and reports the change', () => {
    const t = balanceTimeline(txns, income, { range: '1M', todayKey: '2026-11-03' });
    expect(t.from).toBe('2026-10-05');
    expect(t.start).toBe(40000);
    expect(t.change).toBe(24700 - 40000);
    expect(t.pct).toBe(-38.2);
  });

  it('net between two days; empty account', () => {
    expect(netBetween(txns, income, '2026-11-01', '2026-11-03')).toBe(-1000);
    expect(balanceTimeline([], [], { todayKey: '2026-11-03' }).points).toEqual([]);
    expect(dailyChanges(txns, income).get('2026-10-12')).toBeUndefined();
  });
});
