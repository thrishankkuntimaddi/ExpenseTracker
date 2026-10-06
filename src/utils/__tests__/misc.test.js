import { describe, it, expect } from 'vitest';
import { parseQuickEntry } from '../smartInput';
import { computeGoalProgress } from '../goals';
import { recordsToCSV } from '../exportHelpers';
import { csvToRecords } from '../importHelpers';

describe('parseQuickEntry', () => {
  it('splits a trailing or leading amount off the description', () => {
    expect(parseQuickEntry('chai 20')).toEqual({ name: 'chai', amount: 20 });
    expect(parseQuickEntry('Swiggy dinner ₹250.50')).toEqual({ name: 'Swiggy dinner', amount: 250.5 });
    expect(parseQuickEntry('250 swiggy')).toEqual({ name: 'swiggy', amount: 250 });
    expect(parseQuickEntry('rs 40 auto')).toEqual({ name: 'auto', amount: 40 });
  });
  it('leaves ordinary names alone', () => {
    expect(parseQuickEntry('Hotel 7 Hills')).toBeNull();
    expect(parseQuickEntry('coffee')).toBeNull();
    expect(parseQuickEntry('')).toBeNull();
    expect(parseQuickEntry('2026')).toBeNull();
  });
});

describe('computeGoalProgress', () => {
  const now = new Date(2026, 9, 15);
  const txns = [
    { type: 'savings', savingsType: 'sip', name: 'Nifty SIP', amount: 5000, date: new Date(2026, 7, 5).toISOString() },
    { type: 'savings', savingsType: 'sip', name: 'Nifty SIP', amount: 5000, date: new Date(2026, 8, 5).toISOString() },
    { type: 'savings', savingsType: 'cash', name: 'Cash', amount: 1000, date: new Date(2026, 8, 6).toISOString() },
    { type: 'savings', savingsType: 'sip', name: 'Old', amount: 999, date: new Date(2026, 1, 1).toISOString() },
    { type: 'expense', name: 'Swiggy', amount: 300, date: new Date(2026, 9, 1).toISOString() },
  ];
  it('matches by savings type and start date', () => {
    const p = computeGoalProgress({ target: 60000, startDate: '2026-07-01', savingsType: 'sip', deadline: '2027-06-30' }, txns, now);
    expect(p.saved).toBe(10000);
    expect(p.count).toBe(2);
    expect(Math.round(p.pct)).toBe(17);
    expect(p.remaining).toBe(50000);
    expect(p.neededPerMonth).toBeGreaterThan(0);
    expect(typeof p.onTrack).toBe('boolean');
  });
  it('matches everything when no filters are set and marks completion', () => {
    const p = computeGoalProgress({ target: 11000, startDate: '2026-07-01' }, txns, now);
    expect(p.saved).toBe(11000);
    expect(p.done).toBe(true);
  });
});

describe('recordsToCSV', () => {
  it('round-trips through the importer', () => {
    const csv = recordsToCSV({
      transactions: [{ id: 'a', type: 'expense', name: 'Chai, "special"', amount: 20, date: new Date(2026, 9, 3, 12).toISOString() }],
      income: [{ id: 'b', name: 'Salary', amount: 50000, date: new Date(2026, 9, 1, 12).toISOString() }],
    });
    expect(csv.split('\r\n')[0]).toBe('date,name,amount,type,category,direction,savingsType,platform,wasteAmount,note,id');
    const back = csvToRecords(csv);
    expect(back.transactions).toHaveLength(1);
    expect(back.transactions[0]).toMatchObject({ name: 'Chai, "special"', amount: 20, type: 'expense' });
    expect(back.income[0]).toMatchObject({ name: 'Salary', amount: 50000 });
  });
});
