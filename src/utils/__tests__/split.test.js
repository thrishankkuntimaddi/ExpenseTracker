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
    expect(txt).toContain('Total ₹24500');
    expect(txt).toContain('→ Bala & Esha pays Arjun ₹1800');
  });
});

// The Goa trip: Muza pays for Hanudeep (one wallet); Hanudeep has no money on the trip
describe('inside a pay-together wallet', () => {
  const goa = {
    id: 'goa', name: 'Goa', status: 'open',
    members: [
      { id: 'me', name: 'Thrishank' }, { id: 'mu', name: 'Muza', groupId: 'w' }, { id: 'ha', name: 'Hanudeep', groupId: 'w' },
      { id: 'pr', name: 'Preetham' },
    ],
    expenses: [
      { id: 'e1', title: 'Fuel', amount: 4000, paidBy: 'me' },
      { id: 'e2', title: 'Lunch', amount: 4000, paidBy: 'mu' },
    ],
    settlements: [],
  };
  it('the partner who paid least owes the lead their full share once the wallet settles', () => {
    const s = computeTripSummary(goa);
    const w = s.units.find((u) => u.id === 'g:w');
    expect(w.remaining).toBe(0);   // paid 4000 = share 2×2000
    expect(w.lead).toBe('mu');
    expect(w.inside).toEqual([{ from: 'ha', to: 'mu', amount: 2000, fromName: 'Hanudeep', toName: 'Muza' }]);
    expect(s.transfers).toEqual([{ from: 'm:pr', to: 'm:me', amount: 2000, fromName: 'Preetham', toName: 'Thrishank' }]);
  });
  it('assumes the lead clears the wallet’s open dues, and honours who actually paid', () => {
    const t = { ...goa, expenses: [{ id: 'e1', title: 'Hotel', amount: 8000, paidBy: 'me' }, { id: 'e2', title: 'Snacks', amount: 1000, paidBy: 'mu' }] };
    const s = computeTripSummary(t);
    const w = s.units.find((u) => u.id === 'g:w');
    expect(w.remaining).toBe(-3500);           // share 4500, paid 1000
    expect(w.inside).toEqual([{ from: 'ha', to: 'mu', amount: 2250, fromName: 'Hanudeep', toName: 'Muza' }]);
    // Hanudeep himself paid 1000 of the wallet's dues → owes Muza 1000 less
    const paidByHanu = computeTripSummary({ ...t, settlements: [{ id: 's1', fromUnit: 'g:w', toUnit: 'm:me', amount: 1000, fromMember: 'ha' }] });
    expect(paidByHanu.units.find((u) => u.id === 'g:w').inside[0].amount).toBe(1250);
    // …and repaying Muza inside the wallet clears it, without touching the group plan
    const repaid = computeTripSummary({ ...t, settlements: [{ id: 's2', fromUnit: 'g:w', toUnit: 'g:w', amount: 2250, fromMember: 'ha', toMember: 'mu' }] });
    expect(repaid.units.find((u) => u.id === 'g:w').inside).toEqual([]);
    expect(repaid.outstanding).toBe(s.outstanding);
    expect(repaid.settledTotal).toBe(0);
  });
  it('groups spending by category and the text names everything', () => {
    const s = computeTripSummary(goa);
    expect(s.categories.map((c) => c.key)).toContain('food');
    const text = tripSummaryText(goa, (n) => `₹${n}`);
    expect(text).toContain('Inside Muza & Hanudeep');
    expect(text).toContain('Hanudeep pays Muza ₹2000');
    expect(text).toContain('Thrishank · Fuel · ₹4000');
  });
  // The bike trip: Shiva takes ₹1,000 a head for food and pays for it; Pradeep pays for bowling.
  describe('money collected up front', () => {
    const members = [{ id: 's', name: 'Shiva' }, { id: 'p', name: 'Pradeep' }, { id: 'm', name: 'Mandeep' }, { id: 't', name: 'Thrishank' }];
    const give = (from, amount = 1000, extra = {}) => ({ id: `a-${from}-${amount}`, kind: 'advance', fromUnit: `m:${from}`, toUnit: 'm:s', fromMember: from, toMember: 's', amount, note: 'Food', ...extra });
    const trip = {
      id: 'bike', name: 'Bike trip', members, meMemberId: 't',
      expenses: [
        { id: 'e1', title: 'Food day 1', amount: 3600, paidBy: 's', splitAmong: [] },
        { id: 'e2', title: 'Bowling', amount: 780, paidBy: 'p', splitAmong: [] },
      ],
      settlements: [give('p'), give('m'), give('t')],
    };

    it('counts what was handed over, and what is left of it', () => {
      const s = computeTripSummary(trip);
      expect(s.total).toBe(4380);
      expect(s.collectedTotal).toBe(3000);
      expect(s.settledTotal).toBe(0);                      // handing money to the holder is not a repayment
      const [pool] = s.pools;
      expect(pool).toMatchObject({ holderName: 'Shiva', purpose: 'Food', collected: 3000, spent: 2700, left: 300, paid: 3600 });
      expect(pool.givers.map((g) => [g.name, g.given, g.left])).toEqual([['Pradeep', 1000, 100], ['Mandeep', 1000, 100], ['Thrishank', 1000, 100]]);
      // Shiva: paid 3600 − got 3000 − share 1095 = owes 495; Pradeep: 1000 + 780 − 1095 = gets 685
      const left = Object.fromEntries(s.units.map((u) => [u.name, u.remaining]));
      expect(left).toEqual({ Shiva: -495, Pradeep: 685, Mandeep: -95, Thrishank: -95 });
      expect(s.transfers.map((t) => [t.fromName, t.toName, t.amount])).toEqual([['Shiva', 'Pradeep', 495], ['Mandeep', 'Pradeep', 95], ['Thrishank', 'Pradeep', 95]]);
      expect(s.units.find((u) => u.name === 'Shiva').advancedIn).toBe(3000);
      expect(s.units.find((u) => u.name === 'Thrishank').advancedOut).toBe(1000);
    });

    it('says when the kitty has run out, and a second round refills it', () => {
      const more = { ...trip, expenses: [...trip.expenses, { id: 'e3', title: 'Food day 2', amount: 2000, paidBy: 's', splitAmong: [] }] };
      expect(computeTripSummary(more).pools[0].left).toBe(-1200);          // 3000 − ¾ of 5600
      const again = { ...more, settlements: [...more.settlements, give('p', 500), give('m', 500), give('t', 500)] };
      const pool = computeTripSummary(again).pools[0];
      expect(pool).toMatchObject({ collected: 4500, left: 300, lastAmount: 500 });
      expect(pool.givers[0]).toMatchObject({ given: 1500, used: 1400, left: 100 });
    });

    it('collected with nothing spent yet: the holder owes it all back', () => {
      const s = computeTripSummary({ ...trip, expenses: [] });
      expect(s.transfers.map((t) => [t.fromName, t.amount])).toEqual([['Shiva', 1000], ['Shiva', 1000], ['Shiva', 1000]]);
      expect(s.pools[0].left).toBe(3000);
    });

    it('families: one handover per wallet, the holder’s own family pays nothing in', () => {
      const fam = [{ id: 'a1', name: 'Anna', groupId: 'A' }, { id: 'a2', name: 'Vadina', groupId: 'A' }, { id: 'b1', name: 'Ravi', groupId: 'B' }, { id: 'b2', name: 'Sita', groupId: 'B' }];
      const s = computeTripSummary({
        members: fam,
        expenses: [{ id: 'f', title: 'Meals', amount: 4000, paidBy: 'a2', splitAmong: [] }],
        settlements: [{ id: 'x', kind: 'advance', fromUnit: 'g:B', toUnit: 'g:A', toMember: 'a1', amount: 5000 }],
      });
      expect(s.pools[0]).toMatchObject({ holderName: 'Anna', collected: 5000, spent: 2000, left: 3000 });
      expect(s.transfers.map((t) => [t.fromName, t.toName, t.amount])).toEqual([['Anna & Vadina', 'Ravi & Sita', 3000]]);
    });

    it('the shared text lists it apart from payments made', () => {
      const text = tripSummaryText({ ...trip, settlements: [...trip.settlements, { id: 'r', fromUnit: 'm:m', toUnit: 'm:p', amount: 95 }] }, (n) => `₹${n}`);
      expect(text).toContain('*Collected up front*');
      expect(text).toContain('Shiva (Food): collected ₹3000 · spent ₹2700 of it → ₹300 left');
      expect(text).toContain('gave ₹1000 up front');
      expect(text.split('*Already paid*')[1]).toContain('Mandeep → Pradeep ₹95');
      expect(text.split('*Already paid*')[1]).not.toContain('→ Shiva');
    });
  });
});
