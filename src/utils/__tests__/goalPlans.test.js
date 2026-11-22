import { describe, it, expect } from 'vitest';
import { planTotals, isPlan } from '../goalPlans';

describe('goal plans', () => {
  const plan = { items: [
    { id: 'a', name: 'Helmet', est: 3000, actual: 3400, done: true },
    { id: 'b', name: 'Fog lights', est: 2500, done: false },
    { id: 'c', name: 'Top box', est: 4000, actual: null, done: true, txnId: 't' },
    { id: 'd', name: '', est: null, actual: null },          // an empty row is ignored
  ] };
  it('estimate, spent (actual, else estimate), left, and what is not in expenses yet', () => {
    const t = planTotals(plan);
    expect(t).toMatchObject({ count: 3, bought: 2, est: 9500, boughtEst: 7000, spent: 7400, left: 2500, unloggedSum: 3400 });
    expect(t.unlogged.map((i) => i.id)).toEqual(['a']);
  });
  it('a goal with items is a plan; a money goal is not', () => {
    expect(isPlan(plan)).toBe(true);
    expect(isPlan({ target: 1000 })).toBe(false);
    expect(planTotals({}).count).toBe(0);
  });
});
