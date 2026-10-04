import { describe, it, expect } from 'vitest';
import {
  sumAmounts, incomeKind, incomeKindFlags,
  computePersonDebts, computeStats, findSettlementMatches,
} from '../finance';

const d = '2026-03-10T06:30:00.000Z';

describe('sumAmounts', () => {
  it('has no floating-point drift', () => {
    expect(sumAmounts([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(sumAmounts(Array(10).fill({ amount: 0.1 }))).toBe(1);
  });
  it('treats missing/invalid amounts as 0', () => {
    expect(sumAmounts([{ amount: 5 }, {}, { amount: 'x' }])).toBe(5);
  });
});

describe('incomeKind', () => {
  it('classifies the three kinds and round-trips with incomeKindFlags', () => {
    for (const kind of ['income', 'borrowed', 'repayment']) {
      expect(incomeKind(incomeKindFlags(kind))).toBe(kind);
    }
    expect(incomeKind({})).toBe('income');
  });
});

describe('computePersonDebts', () => {
  it('nets lending against repayments received, and borrowing against repaying', () => {
    const txns = [
      { type: 'person', direction: 'lent', name: 'Ravi', amount: 1000 },
      { type: 'person', direction: 'borrowed', name: 'Asha', amount: 500 },
      { type: 'person', direction: 'repaid', name: 'Asha', amount: 200 },
      { type: 'expense', name: 'Ravi', amount: 999 },          // not a person txn
    ];
    const income = [
      { name: 'Ravi', amount: 400, isRepaymentRec: true },
      { name: 'Ravi', amount: 50000 },                          // salary-like, ignored
    ];
    const debts = computePersonDebts(txns, income);
    expect(debts.Ravi).toMatchObject({ lent: 1000, repaymentRec: 400, netLent: 600, netOwed: 0 });
    expect(debts.Asha).toMatchObject({ borrowed: 500, repaid: 200, netOwed: 300 });
  });

  it('never reports negative balances', () => {
    const debts = computePersonDebts([], [{ name: 'Z', amount: 100, isRepaymentRec: true }]);
    expect(debts.Z.netLent).toBe(0);
  });
});

describe('computeStats', () => {
  it('balance = inflows − outflows', () => {
    const txns = [
      { type: 'expense', amount: 300, date: d, wasteAmount: 30 },
      { type: 'savings', amount: 200, date: d },
      { type: 'person', direction: 'lent', amount: 100, date: d },
    ];
    const inc = [
      { amount: 1000, date: d },
      { amount: 50, date: d, isRepaymentRec: true },
      { amount: 70, date: d, isBorrowed: true },
    ];
    const s = computeStats(txns, inc, {}, new Date('2026-03-10T12:00:00Z'));
    expect(s.pureIncome).toBe(1000);
    expect(s.totalIncome).toBe(1120);
    expect(s.totalExpense).toBe(300);
    expect(s.balance).toBe(1120 - 300 - 200 - 100);
    expect(s.totalWaste).toBe(30);
    expect(s.wastePercent).toBe('5.0');   // 30 / (300+200+100)
  });

  it('handles an empty period', () => {
    const s = computeStats([], [], {});
    expect(s.balance).toBe(0);
    expect(s.wastePercent).toBe('0.0');
  });
});

describe('findSettlementMatches', () => {
  const sessionId = 's1';

  it('matches by externalSessionId and settlementId', () => {
    const txns = [{ id: 't1', externalSessionId: 's1' }, { id: 't2' }];
    const inc  = [{ id: 'i9' }];
    const { matchingTxns, matchingIncomes } = findSettlementMatches(
      { sessionId, settlementId: 'i9', persons: 'Ram' }, txns, inc);
    expect(matchingTxns.map(t => t.id)).toEqual(['t1']);
    expect(matchingIncomes.map(i => i.id)).toEqual(['i9']);
  });

  it('does NOT match unrelated expenses whose name merely contains the person (regression)', () => {
    const txns = [
      { id: 'ramen', category: 'External', name: 'External – Ramen night' },
      { id: 'other', name: 'Ram ji groceries' },
    ];
    const { matchingTxns } = findSettlementMatches({ sessionId, persons: 'Ram' }, txns, []);
    expect(matchingTxns).toEqual([]);
  });

  it('exact-name fallback applies only to legacy entries without a session id', () => {
    const txns = [
      { id: 'legacy', category: 'External', name: 'External – Ram' },
      { id: 'otherSession', category: 'External', name: 'External – Ram', externalSessionId: 's2' },
    ];
    const { matchingTxns } = findSettlementMatches({ sessionId, persons: 'Ram' }, txns, []);
    expect(matchingTxns.map(t => t.id)).toEqual(['legacy']);
  });
});
