import { describe, it, expect } from 'vitest';
import { occurrencesBetween, dueOccurrences, nextOccurrence, entryFromRule, occurrenceId, monthlyEquivalent, describeSchedule } from '../recurring';

const monthly = { id: 'r1', name: 'Rent', amount: 12000, kind: 'expense', category: 'rent', frequency: 'monthly', dayOfMonth: 31, startDate: '2026-01-31', active: true };
const weekly  = { id: 'r2', name: 'Gym', amount: 200, kind: 'expense', frequency: 'weekly', weekday: 1, startDate: '2026-09-01', active: true };
const salary  = { id: 'r3', name: 'Salary', amount: 80000, kind: 'income', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: true };

describe('occurrencesBetween', () => {
  it('clamps day-of-month to short months', () => {
    expect(occurrencesBetween(monthly, null, '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('generates weekly occurrences on the chosen weekday', () => {
    // Sept 2026: Mondays are 7, 14, 21, 28
    expect(occurrencesBetween(weekly, null, '2026-09-30')).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
  });
  it('respects endDate and the exclusive lower bound', () => {
    expect(occurrencesBetween({ ...monthly, endDate: '2026-02-28' }, '2026-01-31', '2026-12-31')).toEqual(['2026-02-28']);
  });
});

describe('dueOccurrences', () => {
  it('only returns occurrences after lastHandledKey that are not already posted', () => {
    const rule = { ...salary, lastHandledKey: '2026-08-01' };
    const existing = new Set([occurrenceId('r3', '2026-09-01')]);
    expect(dueOccurrences(rule, '2026-10-06', existing)).toEqual(['2026-10-01']);
  });
  it('returns nothing for inactive rules', () => {
    expect(dueOccurrences({ ...salary, active: false }, '2026-10-06')).toEqual([]);
  });
});

describe('nextOccurrence / describeSchedule / monthlyEquivalent', () => {
  it('finds the next date after today', () => {
    expect(nextOccurrence(salary, '2026-10-06')).toBe('2026-11-01');
    expect(nextOccurrence(weekly, '2026-10-06')).toBe('2026-10-12');
    expect(nextOccurrence({ ...salary, endDate: '2026-10-05' }, '2026-10-06')).toBeNull();
  });
  it('describes schedules', () => {
    expect(describeSchedule(monthly)).toBe('Monthly on the 31st');
    expect(describeSchedule(weekly)).toBe('Every Mon');
  });
  it('normalises to a monthly figure', () => {
    expect(monthlyEquivalent({ amount: 1200, frequency: 'yearly' })).toBe(100);
    expect(monthlyEquivalent({ amount: 100, frequency: 'monthly' })).toBe(100);
  });
});

describe('entryFromRule', () => {
  it('builds a deterministic transaction for expenses', () => {
    const { entry, target } = entryFromRule(monthly, '2026-10-31');
    expect(target).toBe('transaction');
    expect(entry).toMatchObject({ id: 'rec_r1_2026-10-31', type: 'expense', category: 'rent', amount: 12000, month: '2026-10', recurringId: 'r1' });
  });
  it('routes income rules to the income store', () => {
    const { entry, target } = entryFromRule(salary, '2026-10-01');
    expect(target).toBe('income');
    expect(entry.type).toBe('income');
    expect(entry.id).toBe(occurrenceId('r3', '2026-10-01'));
  });
});
