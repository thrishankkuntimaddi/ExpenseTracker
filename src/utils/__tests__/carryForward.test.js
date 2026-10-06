import { describe, it, expect } from 'vitest';
import { computeCarryForward, withCarryForward, shiftMonth } from '../carryForward';

const at = (y, m, d = 10) => new Date(y, m - 1, d, 12).toISOString();
const settings = { carryForward: { enabled: true, startMonth: '2026-11', includeNegative: false } };

describe('computeCarryForward', () => {
  const transactions = [
    { type: 'expense', amount: 30000, date: at(2026, 10) },  // Oct: 50k in − 30k out = 20k left
    { type: 'expense', amount: 45000, date: at(2026, 11) },  // Nov: 20k carry + 40k − 45k = 15k left
    { type: 'expense', amount: 70000, date: at(2026, 12) },  // Dec: 15k + 40k − 70k = −15k
  ];
  const income = [
    { amount: 50000, date: at(2026, 10, 1) },
    { amount: 40000, date: at(2026, 11, 1) },
    { amount: 40000, date: at(2026, 12, 1) },
  ];

  it('rolls October leftover into November and chains onward', () => {
    const map = computeCarryForward({ transactions, income, settings, upToMonth: '2027-01' });
    expect(map['2026-11']).toMatchObject({ amount: 20000, from: '2026-10' });
    expect(map['2026-12']).toMatchObject({ amount: 15000, from: '2026-11' });
    expect(map['2027-01']).toMatchObject({ amount: 0, balance: -15000 });   // deficit not carried by default
    expect(map['2026-10']).toBeUndefined();                                  // nothing flows into the start month's predecessor
  });

  it('carries a deficit when includeNegative is on', () => {
    const map = computeCarryForward({ transactions, income, settings: { carryForward: { ...settings.carryForward, includeNegative: true } }, upToMonth: '2027-01' });
    expect(map['2027-01'].amount).toBe(-15000);
  });

  it('respects enabled=false and months before the start', () => {
    expect(computeCarryForward({ transactions, income, settings: { carryForward: { enabled: false } }, upToMonth: '2027-01' })).toEqual({});
    expect(computeCarryForward({ transactions, income, settings, upToMonth: '2026-10' })).toEqual({});
  });

  it('withCarryForward appends synthetic, flagged income entries', () => {
    const all = withCarryForward(income, transactions, settings, '2026-12');
    const carry = all.filter((i) => i.isCarryForward);
    expect(carry).toHaveLength(2);
    expect(carry[0]).toMatchObject({ id: 'carry_2026-11', month: '2026-11', amount: 20000, name: 'Carried forward from October 2026' });
    expect(all).toHaveLength(income.length + 2);
  });

  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
