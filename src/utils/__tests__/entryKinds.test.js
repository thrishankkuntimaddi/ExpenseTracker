import { describe, it, expect } from 'vitest';
import { entryKind, ENTRY_KINDS, ENTRY_KIND_ORDER } from '../entryKinds';

describe('entryKind', () => {
  it('reads money in from the income store', () => {
    expect(entryKind({ name: 'Salary' }, 'income')).toBe('income');
    expect(entryKind({ isBorrowed: true }, 'income')).toBe('borrowed');
    expect(entryKind({ isRepaymentRec: true }, 'income')).toBe('got_back');
  });

  it('reads transactions, including older person directions', () => {
    expect(entryKind({ type: 'expense' })).toBe('expense');
    expect(entryKind({ type: 'savings' })).toBe('savings');
    expect(entryKind({ type: 'external' })).toBe('billing');
    expect(entryKind({ type: 'person', direction: 'lent' })).toBe('lent');
    expect(entryKind({ type: 'person' })).toBe('lent');
    expect(entryKind({ type: 'person', direction: 'repaid' })).toBe('paid_back');
    expect(entryKind({ type: 'person', direction: 'given_gift' })).toBe('given');
    expect(entryKind({ type: 'person', direction: 'borrowed' })).toBe('borrowed');
    expect(entryKind({ type: 'person', direction: 'repayment' })).toBe('got_back');
  });

  it('money in is +, money out is −, and every kind has a chip', () => {
    expect(['income', 'borrowed', 'got_back'].every((k) => ENTRY_KINDS[k].sign === 1)).toBe(true);
    expect(['expense', 'given', 'lent', 'paid_back', 'savings'].every((k) => ENTRY_KINDS[k].sign === -1)).toBe(true);
    expect([...ENTRY_KIND_ORDER].sort()).toEqual(Object.keys(ENTRY_KINDS).sort());
  });
});
