import { describe, it, expect } from 'vitest';
import { monthBills, upcomingBills, occurrenceStatus, dueLabel } from '../bills';
import { occurrenceId, entryFromRule } from '../recurring';

const rent = { id: 'rent', name: 'Rent', amount: 15000, kind: 'expense', frequency: 'monthly', dayOfMonth: 5, startDate: '2026-01-01', active: true };
const power = { id: 'power', name: 'Electricity', amount: 1200, kind: 'expense', frequency: 'monthly', dayOfMonth: 20, startDate: '2026-01-01', active: true };
const sip = { id: 'sip', name: 'SIP', amount: 5000, kind: 'savings', frequency: 'monthly', dayOfMonth: 10, startDate: '2026-01-01', active: true, autoPost: true };
const salary = { id: 'sal', name: 'Salary', amount: 90000, kind: 'income', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: true };

describe('monthBills', () => {
  it('lists outgoing occurrences with a status and totals', () => {
    const ids = new Set([occurrenceId('rent', '2026-10-05')]);
    const m = monthBills([rent, power, sip, salary], ids, '2026-10', '2026-10-13');
    expect(m.items.map((i) => [i.rule.id, i.dateKey, i.status])).toEqual([
      ['rent', '2026-10-05', 'paid'],
      ['sip', '2026-10-10', 'overdue'],
      ['power', '2026-10-20', 'upcoming'],
    ]);
    expect(m.total).toBe(21200);
    expect(m.paid).toBe(15000);
    expect(m.remaining).toBe(6200);
    expect(m.overdueCount).toBe(1);
  });

  it('treats handled-but-unpaid as skipped and drops paused rules', () => {
    const m = monthBills([{ ...rent, lastHandledKey: '2026-10-05' }, { ...power, active: false }], new Set(), '2026-10', '2026-10-13');
    expect(m.items).toHaveLength(1);
    expect(m.items[0].status).toBe('skipped');
    expect(m.total).toBe(0);
  });

  it('clamps day 31 to short months', () => {
    const m = monthBills([{ ...rent, dayOfMonth: 31 }], new Set(), '2026-02', '2026-02-01');
    expect(m.items[0].dateKey).toBe('2026-02-28');
  });
});

describe('upcomingBills', () => {
  it('returns overdue (not auto-pay) and the next N days, oldest first', () => {
    const list = upcomingBills([rent, { ...power, startDate: '2026-10-01' }, sip], new Set(), '2026-10-15', 7);
    expect(list.map((i) => `${i.rule.id}@${i.dateKey}:${i.status}`)).toEqual([
      'rent@2026-01-05:overdue', 'rent@2026-02-05:overdue', 'rent@2026-03-05:overdue', 'rent@2026-04-05:overdue',
      'rent@2026-05-05:overdue', 'rent@2026-06-05:overdue', 'rent@2026-07-05:overdue', 'rent@2026-08-05:overdue',
      'rent@2026-09-05:overdue', 'rent@2026-10-05:overdue', 'power@2026-10-20:upcoming',
    ]);
  });
  it('respects lastHandledKey and payments', () => {
    const r = { ...rent, lastHandledKey: '2026-09-05' };
    const ids = new Set([occurrenceId('rent', '2026-10-05')]);
    expect(upcomingBills([r], ids, '2026-10-15', 30).map((i) => i.dateKey)).toEqual(['2026-11-05']);
  });
});

describe('helpers', () => {
  it('occurrenceStatus and dueLabel', () => {
    expect(occurrenceStatus(rent, '2026-10-13', '2026-10-13', new Set())).toBe('today');
    expect(dueLabel('2026-10-13', '2026-10-13')).toBe('Due today');
    expect(dueLabel('2026-10-14', '2026-10-13')).toBe('Tomorrow');
    expect(dueLabel('2026-10-18', '2026-10-13')).toBe('In 5 days');
    expect(dueLabel('2026-10-11', '2026-10-13')).toBe('2 days late');
  });
  it('paying early dates the entry today but keeps the occurrence id', () => {
    const { entry } = entryFromRule(rent, '2026-10-20', '2026-10-13');
    expect(entry.id).toBe(occurrenceId('rent', '2026-10-20'));
    expect(entry.date.slice(0, 10)).toBe('2026-10-13');
    expect(entry.month).toBe('2026-10');
  });
});
