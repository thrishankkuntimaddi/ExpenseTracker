import { describe, it, expect, beforeEach } from 'vitest';
import { viewEntry, viewEntries, rawOf, unviewEntry, liveBalance, isMixed } from '../fx';
import { computeStats } from '../finance';
import { withCarryForward } from '../carryForward';
import { formatMoney, setDisplayCurrency, currencySymbol } from '../money';
import { stamp } from '../../hooks/useFirestoreData';
import { __setRatesCache, rateBetween, perUsd } from '../../services/rates';

// Rupees per dollar: 83 in March, 86 in April, 96 today
const RATES = { '2026-03-10': { INR: 83, EUR: 0.9 }, '2026-04-10': { INR: 86, EUR: 0.92 } };
const rate = (from, to, day) => {
  const t = day ? RATES[day] : { INR: 96, EUR: 0.89 };
  const per = (c) => (c === 'USD' ? 1 : t[c]);
  return per(to) / per(from);
};
const d = (day) => `${day}T06:30:00.000Z`;

describe('views: history at the day’s rate', () => {
  it('passes same-currency and legacy (rupee) entries through untouched', () => {
    const legacy = { id: 'a', amount: 200, date: d('2026-03-10') };
    expect(viewEntry(legacy, 'INR', rate)).toBe(legacy);
    const list = [legacy];
    expect(viewEntries(list, 'INR', rate)).toBe(list);
  });
  it('converts a dollar expense at the rate of its own day, not today’s', () => {
    const fuel = { id: 'f', amount: 10, currency: 'USD', date: d('2026-03-10') };
    const v = viewEntry(fuel, 'INR', rate);
    expect(v.amount).toBe(830);                 // March rate, not 960
    expect(v.orig).toEqual({ currency: 'USD', amount: 10 });
    expect(rawOf(v)).toEqual(fuel);
  });
  it('prefers the rate snapshot taken when the entry was made', () => {
    const e = { amount: 10, currency: 'USD', date: d('2026-03-10'), fx: { USD: 1, INR: 84.5 } };
    expect(viewEntry(e, 'INR', rate).amount).toBe(845);
  });
  it('converts rupee history into dollars at each day’s rate', () => {
    const v = viewEntry({ amount: 8600, date: d('2026-04-10') }, 'USD', rate);
    expect(v.amount).toBe(100);
  });
});

describe('editing a view', () => {
  const fuel = { id: 'f', name: 'Fuel', amount: 10, currency: 'USD', date: d('2026-03-10') };
  it('a rename keeps the original dollars', () => {
    const v = viewEntry(fuel, 'INR', rate);
    expect(unviewEntry({ ...v, name: 'Petrol' }, 'INR')).toEqual({ ...fuel, name: 'Petrol' });
  });
  it('typing a new converted amount stores it in the display currency', () => {
    const v = viewEntry(fuel, 'INR', rate);
    const out = unviewEntry({ ...v, amount: 900 }, 'INR');
    expect(out).toMatchObject({ amount: 900, currency: 'INR' });
    expect(out.orig).toBeUndefined();
    expect(out.fxRate).toBeUndefined();
  });
});

describe('balance: what is left, at today’s rate', () => {
  const bal = (t, i) => computeStats(t, i, {}).balance;
  // Paid $200 in the USA, spent $50 there, then ₹10,000 back in India
  const income = [{ id: 'pay', amount: 200, currency: 'USD', date: d('2026-03-10') }];
  const txns = [
    { id: 'usa', type: 'expense', amount: 50, currency: 'USD', date: d('2026-03-10') },
    { id: 'ind', type: 'expense', amount: 10000, currency: 'INR', date: d('2026-04-10') },
  ];
  it('keeps money per currency and values only the remainder live', () => {
    const live = liveBalance(viewEntries(txns, 'INR', rate), viewEntries(income, 'INR', rate), 'INR', rate, bal);
    expect(live.parts).toEqual([
      { currency: 'USD', amount: 150, rate: 96, value: 14400 },
      { currency: 'INR', amount: -10000, rate: 1, value: -10000 },
    ]);
    expect(live.total).toBe(4400);
  });
  it('shows the same remainder in dollars when the display currency is dollars', () => {
    const live = liveBalance(viewEntries(txns, 'USD', rate), viewEntries(income, 'USD', rate), 'USD', rate, bal);
    expect(live.total).toBeCloseTo(150 - 10000 / 96, 2);
  });
  it('notices when more than one currency is in play', () => {
    expect(isMixed([txns], 'INR')).toBe(true);
    expect(isMixed([[{ amount: 1 }]], 'INR')).toBe(false);
  });
});

describe('carry forward per currency', () => {
  it('carries leftover dollars as dollars, valued today', () => {
    const income = [{ id: 'pay', amount: 200, currency: 'USD', date: d('2026-03-10') }];
    const txns = [{ id: 'x', type: 'expense', amount: 50, currency: 'USD', date: d('2026-03-10') }];
    const out = withCarryForward(income, txns, { carryForward: { enabled: true, startMonth: '2026-03' } }, '2026-04',
      { display: 'INR', view: (e) => viewEntry(e, 'INR', rate) });
    const carry = out.find((e) => e.isCarryForward && e.month === '2026-04');
    expect(carry.orig).toEqual({ currency: 'USD', amount: 150 });
    expect(carry.amount).toBe(14400);           // live rate, not March's
  });
});

describe('formatting and stamping', () => {
  beforeEach(() => setDisplayCurrency('INR'));
  it('formats in the display currency and labels foreign ones clearly', () => {
    expect(formatMoney(1250.5)).toBe('₹1,250.50');
    expect(formatMoney(100000)).toBe('₹1,00,000.00');
    expect(formatMoney(12, 'USD')).toBe('$12.00');
    setDisplayCurrency('CAD');
    expect(formatMoney(12)).toBe('$12.00');
    expect(formatMoney(12, 'USD')).toMatch(/USD/);      // never two different “$”
    expect(currencySymbol('EUR')).toBe('€');
  });
  it('stamps new entries with their currency and today’s rates when foreign', () => {
    __setRatesCache({ days: {}, latest: { date: '2026-10-13', rates: { USD: 1, INR: 95 }, at: Date.now() } });
    expect(stamp({ amount: 5, date: new Date().toISOString() }, 'INR')).toMatchObject({ currency: 'INR' });
    const s = stamp({ amount: 5, currency: 'USD', date: new Date().toISOString() }, 'INR');
    expect(s.fx).toEqual({ USD: 1, INR: 95 });
    expect(rateBetween('USD', 'INR')).toBe(95);
    expect(perUsd('AED', '2025-01-01')).toMatchObject({ rate: 3.6725, exact: true });   // pegged
  });
});

describe('re-stating plans in a new currency', () => {
  it('converts budgets, deductions and goals, and leaves everything else', async () => {
    const { convertSettingsMoney } = await import('../fx');
    const s = { budgets: { total: 20000, categories: { food: 6000 }, deductions: [{ id: 'd', name: 'Rent', amount: 9500 }] }, goals: [{ id: 'g', name: 'Bike', target: 95000, monthly: 9500 }], ui: { x: 1 } };
    const p = convertSettingsMoney(s, 1 / 95);
    expect(p.budgets).toEqual({ total: 211, categories: { food: 63.16 }, deductions: [{ id: 'd', name: 'Rent', amount: 100 }] });
    expect(p.goals[0]).toMatchObject({ target: 1000, monthly: 100 });
    expect(p.ui).toBeUndefined();
    expect(convertSettingsMoney(s, 1)).toEqual({});
  });
});
