import { describe, it, expect } from 'vitest';
import { inferCategory, categoryOf, learnCategoryRule, categoryTotals, normaliseName } from '../categories';

describe('inferCategory', () => {
  it('recognises Indian merchants and everyday words', () => {
    expect(inferCategory('Swiggy dinner')).toBe('food');
    expect(inferCategory('chai')).toBe('food');
    expect(inferCategory('Petrol HP')).toBe('fuel');
    expect(inferCategory('Uber to office')).toBe('transport');
    expect(inferCategory('Netflix')).toBe('subscriptions');
    expect(inferCategory('House rent')).toBe('rent');
    expect(inferCategory('Blinkit milk')).toBe('groceries');
    expect(inferCategory('Electricity bill')).toBe('bills');
  });
  it('prefers multi-word keywords over single-word ones', () => {
    expect(inferCategory('hotel booking goa')).toBe('travel');
    expect(inferCategory('hotel biryani')).toBe('food');
  });
  it('falls back to other', () => {
    expect(inferCategory('xyz')).toBe('other');
    expect(inferCategory('')).toBe('other');
  });
  it('honours learned rules', () => {
    expect(inferCategory('Amazon', { amazon: 'groceries' })).toBe('groceries');
  });
});

describe('categoryOf', () => {
  it('uses the stored category when present, otherwise infers', () => {
    expect(categoryOf({ type: 'expense', name: 'Swiggy', category: 'gifts' })).toBe('gifts');
    expect(categoryOf({ type: 'expense', name: 'Swiggy' })).toBe('food');
    expect(categoryOf({ type: 'savings', name: 'SIP' })).toBeNull();
  });
});

describe('learnCategoryRule', () => {
  it('adds a rule only when the choice differs from the keyword inference', () => {
    expect(learnCategoryRule({}, 'Swiggy', 'food')).toEqual({});
    expect(learnCategoryRule({}, 'Swiggy', 'groceries')).toEqual({ swiggy: 'groceries' });
  });
  it('removes a stale rule when the user picks the inferred category again', () => {
    expect(learnCategoryRule({ swiggy: 'groceries' }, 'Swiggy', 'food')).toEqual({});
  });
  it('normalises keys so they are safe Firestore map keys', () => {
    expect(normaliseName('  Dr. Reddy / Lab  ')).toBe('dr reddy lab');
    expect(Object.keys(learnCategoryRule({}, 'Dr. Reddy', 'health'))[0]).toBe('dr reddy');
  });
});

describe('categoryTotals', () => {
  it('sums expenses per category with shares', () => {
    const t = categoryTotals([
      { type: 'expense', name: 'Swiggy', amount: 300 },
      { type: 'expense', name: 'Zomato', amount: 200 },
      { type: 'expense', name: 'Uber', amount: 500 },
      { type: 'savings', name: 'SIP', amount: 5000 },
    ]);
    expect(t[0]).toMatchObject({ key: 'food', amount: 500, count: 2, share: 50 });
    expect(t[1]).toMatchObject({ key: 'transport', amount: 500, count: 1 });
  });
});
