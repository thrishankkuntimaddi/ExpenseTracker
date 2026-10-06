import { describe, it, expect } from 'vitest';
import { computeTripSummary, settleTransfers, expenseShares, tripSummaryText } from '../split';

// The road-trip example: 5 people, person 2 pays for person 5 as one wallet
const trip = {
  id: 'trip1', name: 'Goa road trip', status: 'open', meMemberId: 'p1',
  members: [
    { id: 'p1', name: 'Arjun' }, { id: 'p2', name: 'Bala', groupId: 'g1' }, { id: 'p3', name: 'Chitra' },
    { id: 'p4', name: 'Dev' }, { id: 'p5', name: 'Esha', groupId: 'g1' },
  ],
  expenses: [
    { id: 'e1', title: 'Fuel + tolls', amount: 11000, paidBy: 'p1', splitAmong: [] },
    { id: 'e2', title: 'Hotel', amount: 8000, paidBy: 'p2', splitAmong: [] },
    { id: 'e3', title: 'Food', amount: 3000, paidBy: 'p3', splitAmong: [] },
    { id: 'e4', title: 'Drinks', amount: 2500, paidBy: 'p4', splitAmong: [] },
  ],
  settlements: [],
};

describe('computeTripSummary', () => {
  const s = computeTripSummary(trip);
  it('totals and equal shares', () => {
    expect(s.total).toBe(24500);
    expect(s.perHead).toBe(4900);
    expect(s.members.find((m) => m.id === 'p5').share).toBe(4900);
    expect(s.members.find((m) => m.id === 'p5').paid).toBe(0);
  });
  it('treats a pay-group as one wallet', () => {
    const g = s.units.find((u) => u.id === 'g:g1');
    expect(g.name).toBe('Bala & Esha');
    expect(g.paid).toBe(8000);
    expect(g.share).toBe(9800);
    expect(g.remaining).toBe(-1800);
  });
  it('produces a minimal who-pays-whom plan', () => {
    expect(s.transfers).toEqual([
      { from: 'm:p4', to: 'm:p1', amount: 2400, fromName: 'Dev', toName: 'Arjun' },
      { from: 'm:p3', to: 'm:p1', amount: 1900, fromName: 'Chitra', toName: 'Arjun' },
      { from: 'g:g1', to: 'm:p1', amount: 1800, fromName: 'Bala & Esha', toName: 'Arjun' },
    ]);
    expect(s.outstanding).toBe(6100);
    expect(s.owedToMe).toHaveLength(3);
    expect(s.iOwe).toHaveLength(0);
    expect(s.myShare).toBe(4900);
  });
  it('recorded settlements reduce what is outstanding', () => {
    const paidUp = computeTripSummary({ ...trip, settlements: [{ id: 's1', fromUnit: 'm:p4', toUnit: 'm:p1', amount: 2400 }] });
    expect(paidUp.outstanding).toBe(3700);
    expect(paidUp.transfers.find((t) => t.from === 'm:p4')).toBeUndefined();
    const all = computeTripSummary({ ...trip, settlements: [
      { id: 's1', fromUnit: 'm:p4', toUnit: 'm:p1', amount: 2400 },
      { id: 's2', fromUnit: 'm:p3', toUnit: 'm:p1', amount: 1900 },
      { id: 's3', fromUnit: 'g:g1', toUnit: 'm:p1', amount: 1800 },
    ] });
    expect(all.isSettled).toBe(true);
  });
  it('splits among a subset when chosen', () => {
    expect(expenseShares({ amount: 100, splitAmong: ['p1', 'p2', 'p3'] }, trip.members)).toEqual({ p1: 33.34, p2: 33.33, p3: 33.33 });
  });
});

describe('settleTransfers', () => {
  it('matches largest debtor to largest creditor first', () => {
    expect(settleTransfers({ a: 50, b: 30, c: -80 })).toEqual([{ from: 'c', to: 'a', amount: 50 }, { from: 'c', to: 'b', amount: 30 }]);
    expect(settleTransfers({ a: 0, b: 0 })).toEqual([]);
  });
});

describe('tripSummaryText', () => {
  it('reads like a WhatsApp message', () => {
    const txt = tripSummaryText(trip, (n) => `₹${n}`);
    expect(txt).toContain('Total spent: ₹24500');
    expect(txt).toContain('→ Bala & Esha pays Arjun ₹1800');
  });
});
