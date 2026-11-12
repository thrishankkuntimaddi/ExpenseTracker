import { describe, it, expect } from 'vitest';
import { fv, pv, pmt, monthlyRate, retirement, education, stepUpSip, fire, corpusLasts } from '../planner';

// Reference values from numpy-financial (Excel conventions)
describe('Excel primitives', () => {
  it('fv / pv / pmt match Excel', () => {
    expect(fv(0.06, 30, 0, -40000)).toBeCloseTo(229739.65, 1);
    expect(pv(0.1, 10, 0, 1000)).toBeCloseTo(-385.54, 2);
    expect(pmt(0.01, 12, -1000, 0, 0)).toBeCloseTo(88.85, 2);
    expect(fv(0, 10, -100, 0)).toBe(1000);
    expect(pmt(0, 10, 0, 1000)).toBe(-100);
  });
  it('monthlyRate is NOMINAL(r,12)/12', () => {
    expect((1 + monthlyRate(0.12)) ** 12).toBeCloseTo(1.12, 10);
  });
});

describe('retirement', () => {
  const r = retirement({});
  it('matches the sheet', () => {
    expect(r.expenseAtRetirement).toBeCloseTo(229739.65, 0);
    expect(r.corpus).toBeCloseTo(55101851.49, -1);
    expect(r.sip).toBeCloseTo(17884.56, 0);
  });
  it('the corpus lasts to the life expectancy', () => {
    expect(r.drawdown).toHaveLength(25);
    expect(Math.abs(r.drawdown.at(-1).end)).toBeLessThan(1);
  });
  it('savings already made reduce the SIP', () => {
    expect(retirement({ saved: 1000000 }).sip).toBeLessThan(r.sip);
  });
});

describe('education', () => {
  it('matches the sheet', () => {
    const e = education({});
    expect(e.corpus).toBeCloseTo(8354496.34, 0);
    expect(e.monthly).toBeCloseTo(17553.99, 0);
    expect(e.yearly).toBeCloseTo(200091.97, 0);
    expect(e.lumpSumNeeded).toBeCloseTo(1526335.25, 0);
  });
  it('a big enough lump sum needs no SIP', () => {
    expect(education({ lumpSum: 5000000 }).monthly).toBe(0);
  });
  it('checks your own step-up plan', () => {
    expect(education({ plannedMonthly: 20000 }).planned.enough).toBe(true);
    expect(education({ plannedMonthly: 2000 }).planned.enough).toBe(false);
  });
});

describe('step-up SIP', () => {
  it('matches the sheet', () => {
    const s = stepUpSip({});
    expect(s.value).toBeCloseTo(8274717.9, 0);
    expect(s.invested).toBeCloseTo(3812697.8, 0);
    expect(s.rows).toHaveLength(15);
    expect(s.value).toBeGreaterThan(s.flatValue);
  });
  it('steps by a fixed amount', () => {
    const s = stepUpSip({ monthly: 5000, years: 3, stepAmount: 1000 });
    expect(s.rows.map((r) => r.monthly)).toEqual([5000, 6000, 7000]);
    expect(s.invested).toBe(216000);
  });
  it('a holding period keeps growing with nothing added', () => {
    const s = stepUpSip({ years: 5, holding: 3 });
    expect(s.rows).toHaveLength(8);
    expect(s.rows.at(-1).monthly).toBe(0);
    expect(s.rows.at(-1).end).toBeGreaterThan(s.rows.at(-2).end);
  });
});

describe('FIRE', () => {
  it('builds a year per age up to the FIRE age', () => {
    const f = fire({});
    expect(f.rows[0].age).toBe(28);
    expect(f.rows.at(-1).age).toBe(45);
    expect(f.fireNumber).toBeCloseTo(f.expenseAtFire * 25, -1);
    expect(f.fireNumber30).toBeCloseTo(f.expenseAtFire * 30, -1);
  });
  it('says when the corpus is enough, and finds the earliest age', () => {
    const rich = fire({ annualIncome: 5000000, annualExpense: 600000 });
    expect(rich.achieved).toBe(true);
    expect(rich.earliest).toBeLessThanOrEqual(45);
    const poor = fire({ annualIncome: 700000, annualExpense: 600000 });
    expect(poor.achieved).toBe(false);
    expect(poor.shortBy).toBeGreaterThan(0);
  });
  it('corpusLasts', () => {
    expect(corpusLasts(100, 50, 0, 0, 60)).toEqual({ lastsUntil: 61, forever: false });
    expect(corpusLasts(1e9, 1, 0.08, 0.06, 60).forever).toBe(true);
  });
});
