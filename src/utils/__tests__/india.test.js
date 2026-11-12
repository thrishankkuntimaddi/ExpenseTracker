import { describe, it, expect } from 'vitest';
import { loan, loanEmi } from '../planner';
import { taxSummary, taxSectionOf, fyWindow, taxSaved } from '../tax';
import { netWorth } from '../netWorth';
import { eventProgress, presetEvent, EVENT_PRESETS } from '../events';

const iso = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).toISOString(); };
const e = (name, amount, k, extra = {}) => ({ id: `${name}${k}${amount}`, type: 'expense', name, amount, date: iso(k), ...extra });
const s = (name, amount, k, extra = {}) => ({ id: `s${name}${k}`, type: 'savings', name, amount, date: iso(k), ...extra });

describe('loan', () => {
  it('EMI matches the bank formula', () => {
    expect(loanEmi(2500000, 0.085, 240)).toBeCloseTo(21695.6, 0);   // ₹25L, 8.5 %, 20 years
    const l = loan({});
    expect(l.emi).toBeCloseTo(21695.6, 0);
    expect(l.schedule).toHaveLength(20);
    expect(l.schedule.at(-1).end).toBeLessThan(1);
    expect(l.totalInterest).toBeCloseTo(l.emi * 240 - 2500000, -2);
  });
  it('a prepayment saves interest and months', () => {
    const l = loan({ extra: 5000 });
    expect(l.prepay.interestSaved).toBeGreaterThan(500000);
    expect(l.prepay.monthsSaved).toBeGreaterThan(60);
  });
});

describe('tax', () => {
  const rules = [{ id: 'r1', kind: 'expense', category: 'insurance', insuranceType: 'health', name: 'Family floater' }];
  const txns = [
    s('PPF', 50000, '2026-05-01', { savingsType: 'pf' }),
    s('Axis ELSS', 60000, '2026-06-01', { savingsType: 'mutual_fund' }),
    s('NPS Tier 1', 20000, '2026-07-01', { savingsType: 'pf' }),
    e('LIC premium', 30000, '2026-08-01', { category: 'insurance' }),
    e('Family floater', 18000, '2026-09-01', { recurringId: 'r1' }),
    e('House rent', 15000, '2026-10-05'),
    e('School fees tuition', 25000, '2026-06-10', { category: 'education' }),
    s('PPF', 50000, '2026-03-20', { savingsType: 'pf' }),          // last FY
    s('Nifty SIP', 6000, '2026-10-02', { savingsType: 'sip' }),    // not tax saving
  ];
  it('the financial year', () => {
    expect(fyWindow('2026-11-12')).toEqual({ start: '2026-04-01', last: '2027-03-31', label: 'FY 2026–27' });
    expect(fyWindow('2027-02-01').label).toBe('FY 2026–27');
  });
  it('sorts entries into sections', () => {
    expect(taxSectionOf(txns[2], null)).toBe('80CCD1B');
    expect(taxSectionOf(txns[8], null)).toBe(null);
    expect(taxSectionOf({ ...txns[8], taxSection: '80C' }, null)).toBe('80C');
  });
  it('sums against the limits', () => {
    const t = taxSummary({ transactions: txns, recurringRules: rules, todayKey: '2026-11-12' });
    const by = Object.fromEntries(t.sections.map((x) => [x.key, x]));
    expect(by['80C'].used).toBe(50000 + 60000 + 30000 + 25000);
    expect(by['80C'].left).toBe(0);
    expect(by['80CCD1B'].used).toBe(20000);
    expect(by['80D'].used).toBe(18000);
    expect(by.HRA.used).toBe(15000);
    expect(t.deductible).toBe(150000 + 20000 + 18000);
    expect(taxSaved(100000, 0.3)).toBe(31200);
  });
});

describe('net worth', () => {
  it('assets minus liabilities, savings not counted twice', () => {
    const txns = [
      s('SIP', 10000, '2026-10-02', { savingsType: 'sip' }),
      s('Gold', 5000, '2026-10-03', { savingsType: 'gold' }),
      e('Rent', 15000, '2026-10-05'),
      { id: 'l', type: 'person', direction: 'lent', name: 'Ravi', amount: 2000, date: iso('2026-10-06') },
    ];
    const income = [{ id: 'i', amount: 50000, date: iso('2026-10-01') }];
    const n = netWorth({ transactions: txns, income, settings: { netWorth: { items: [{ id: 'h', name: 'Car loan', value: 100000, kind: 'liability' }, { id: 'g', name: 'Family gold', value: 80000 }] } }, todayKey: '2026-11-12' });
    const a = Object.fromEntries(n.assets.map((x) => [x.key, x.value]));
    expect(a.balance).toBe(50000 - 10000 - 5000 - 15000 - 2000);
    expect(a['sav-sip']).toBe(10000);
    expect(a.owed).toBe(2000);
    expect(n.totalAssets).toBe(18000 + 10000 + 5000 + 2000 + 80000);
    expect(n.totalLiabilities).toBe(100000);
    expect(n.netWorth).toBe(15000);
  });
});

describe('event budgets', () => {
  const ev = { id: 'd', name: 'Diwali', start: '2026-11-01', end: '2026-11-07', limit: 10000 };
  const txns = [
    e('Crackers', 2000, '2026-11-02'), e('New clothes', 3000, '2026-11-03', { category: 'shopping' }),
    e('House rent', 14000, '2026-11-05'), e('Groceries', 1500, '2026-11-04'),
    e('Diwali sweets for office', 800, '2026-11-06', { category: 'groceries' }),
    e('Bike loan EMI', 4200, '2026-11-07'), e('Movie', 500, '2026-11-09'),
  ];
  it('counts festival spending, not everyday essentials', () => {
    const p = eventProgress(ev, txns, {}, '2026-11-12');
    expect(p.spent).toBe(2000 + 3000 + 800);
    expect(p.state).toBe('done');
    expect(p.left).toBe(4200);
  });
  it('presets start today', () => {
    const d = presetEvent(EVENT_PRESETS[0], '2026-11-12', 'x');
    expect(d).toMatchObject({ name: 'Diwali', start: '2026-11-12', end: '2026-11-18' });
  });
});
