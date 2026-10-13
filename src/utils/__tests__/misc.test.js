import { describe, it, expect } from 'vitest';
import { parseQuickEntry } from '../smartInput';
import { computeGoalProgress, moveGoal, endGoal, reopenGoal, isGoalOpen } from '../goals';
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

describe('describeDevice', async () => {
  const { describeDevice } = await import('../../hooks/useDevices');
  it('names browsers, the Android app and the desktop app', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', 'web')).toBe('Chrome on macOS');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A; wv) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36', 'android')).toBe('Pixel 8 (Android app)');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36', 'android')).toBe('Android app');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0', 'desktop')).toBe('Desktop app on Windows');
  });
});

describe('pickDownload', async () => {
  const { pickDownload } = await import('../downloads');
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
  it('chooses the installer for the device', () => {
    expect(pickDownload('Mozilla/5.0 (Linux; Android 15; Pixel 8) Chrome/140.0 Mobile', null).file).toBe('ExpenseTracker-Android.apk');
    expect(pickDownload('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', 'x86').file).toBe('ExpenseTracker-Windows-Setup.exe');
    expect(pickDownload('Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0', 'x86').file).toBe('ExpenseTracker-Linux.AppImage');
  });
  it('tells Apple-chip Macs from Intel ones (the UA always says "Intel Mac")', () => {
    expect(pickDownload(MAC, 'arm').file).toBe('ExpenseTracker-Mac-AppleSilicon.dmg');
    expect(pickDownload(MAC, 'x86').file).toBe('ExpenseTracker-Mac-Intel.dmg');
    expect(pickDownload(MAC, null)).toMatchObject({ file: 'ExpenseTracker-Mac-AppleSilicon.dmg', unsure: true });
  });
  it('iPhone / iPad get no download (the web app is the app)', () => {
    expect(pickDownload('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1')).toBeNull();
    expect(pickDownload('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBeNull();
  });
});

describe('goals: held with someone, moved, used, collected', () => {
  const goal = { id: 'g', name: 'Bike', target: 100000, monthly: 20000, heldWith: 'Pritam', linked: true, startDate: '2026-10-01' };
  const put = (id, amount, d, extra = {}) => ({ id, type: 'savings', goalId: 'g', amount, date: new Date(2026, 9, d, 12).toISOString(), ...extra });
  it('only its own savings count; this month’s share is tracked', () => {
    const tx = [put('a', 20000, 2), { id: 'x', type: 'savings', amount: 999, date: new Date(2026, 9, 3).toISOString() }];
    const p = computeGoalProgress(goal, tx, new Date(2026, 9, 13));
    expect(p).toMatchObject({ saved: 20000, savedThisMonth: 20000, monthlyDue: 0, done: false });
    expect(p.byHolder).toEqual({ Pritam: 20000 });
  });
  it('moving keeps the history; ending and reopening', () => {
    const moved = moveGoal(goal, 'Muzammil', '2026-12-01');
    expect(moved.heldWith).toBe('Muzammil');
    expect(moved.moves).toEqual([{ date: '2026-12-01', from: 'Pritam', to: 'Muzammil' }]);
    expect(moveGoal(moved, ' Muzammil ', '2026-12-02')).toBe(moved);
    const used = endGoal(moved, 'used', '2027-01-10', 'Hospital');
    expect(isGoalOpen(used)).toBe(false);
    expect(used).toMatchObject({ status: 'used', endedOn: '2027-01-10', endNote: 'Hospital' });
    expect(isGoalOpen(reopenGoal(used))).toBe(true);
    expect(reopenGoal(used).endNote).toBeUndefined();
  });
  it('older goals still count savings by type', () => {
    const old = { id: 'o', name: 'Old', target: 1000, savingsType: 'sip' };
    const p = computeGoalProgress(old, [{ id: 's', type: 'savings', savingsType: 'sip', amount: 400, date: new Date().toISOString() }]);
    expect(p.saved).toBe(400);
  });
});
