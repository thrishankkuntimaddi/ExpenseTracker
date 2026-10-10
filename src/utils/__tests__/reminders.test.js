import { describe, it, expect } from 'vitest';
import { buildSchedule, normaliseReminders, previewReminder, reminderId, anyReminderOn, DEFAULT_REMINDERS } from '../reminders';

// Wed 14 Oct 2026, 10:00 local (tests run in Asia/Kolkata)
const NOW = new Date(2026, 9, 14, 10, 0).getTime();
const iso = (y, m, d) => new Date(y, m - 1, d).toISOString();
const on = (patch) => normaliseReminders({ ...patch });
const types = (items) => items.map((i) => i.type);
const day = (ms) => new Date(ms).toDateString();

describe('defaults', () => {
  it('everything is off, and partial settings are filled in', () => {
    expect(anyReminderOn(DEFAULT_REMINDERS)).toBe(false);
    expect(buildSchedule(NOW, {}, {})).toEqual([]);
    const n = normaliseReminders({ daily: { enabled: true } });
    expect(n.daily).toMatchObject({ enabled: true, time: '21:00' });
    expect(n.tone).toBe('friendly');
  });
  it('ids are stable positive ints', () => {
    expect(reminderId('daily', '2026-10-14')).toBe(reminderId('daily', '2026-10-14'));
    expect(reminderId('daily', '2026-10-14')).toBeGreaterThan(0);
    expect(reminderId('daily', '2026-10-14')).toBeLessThan(2 ** 31);
  });
});

describe('daily nudge', () => {
  const cfg = on({ daily: { enabled: true, time: '21:00' } });
  it('one per day for 14 days, at the chosen time', () => {
    const items = buildSchedule(NOW, cfg, {});
    expect(items).toHaveLength(14);
    expect(new Date(items[0].at).getHours()).toBe(21);
    expect(new Set(items.map((i) => day(i.at))).size).toBe(14);
  });
  it('skips today once something is logged today', () => {
    const items = buildSchedule(NOW, cfg, { transactions: [{ type: 'expense', amount: 20, date: iso(2026, 10, 14) }] });
    expect(items).toHaveLength(13);
    expect(day(items[0].at)).toBe(new Date(2026, 9, 15).toDateString());
  });
  it('respects chosen weekdays and never plans the past', () => {
    const weekdaysOnly = on({ daily: { enabled: true, time: '09:00', days: [1, 2, 3, 4, 5] } });
    const items = buildSchedule(NOW, weekdaysOnly, {});
    expect(items.every((i) => i.at > NOW)).toBe(true);
    expect(items.every((i) => ![0, 6].includes(new Date(i.at).getDay()))).toBe(true);
    expect(day(items[0].at)).toBe(new Date(2026, 9, 15).toDateString()); // 09:00 today already passed
  });
});

describe('recurring due tomorrow', () => {
  const cfg = on({ recurring: { enabled: true, time: '20:00' } });
  const rent = { id: 'r1', name: 'Rent', amount: 15000, kind: 'expense', frequency: 'monthly', dayOfMonth: 15, startDate: '2026-01-01', active: true };
  const sip = { id: 'r2', name: 'SIP', amount: 5000, kind: 'savings', frequency: 'monthly', dayOfMonth: 15, startDate: '2026-01-01', active: true };
  it('the evening before, combined into one line', () => {
    const items = buildSchedule(NOW, cfg, { recurring: [rent, sip] });
    expect(items).toHaveLength(1);
    expect(day(items[0].at)).toBe(new Date(2026, 9, 14).toDateString());
    expect(items[0].title).toBe('2 entries due tomorrow');
    expect(items[0].body).toMatch(/Rent ₹15,000 and SIP ₹5,000/);
    expect(items[0].route).toBe('plan');
  });
  it('ignores paused rules and occurrences already handled', () => {
    expect(buildSchedule(NOW, cfg, { recurring: [{ ...rent, active: false }] })).toEqual([]);
    expect(buildSchedule(NOW, cfg, { recurring: [{ ...rent, lastHandledKey: '2026-10-15' }] })).toEqual([]);
  });
});

describe('budget alerts', () => {
  const cfg = on({ budget: { enabled: true, time: '19:00' } });
  const budgets = { total: 10000 };
  const spend = (amt, d = 10) => ({ type: 'expense', amount: amt, date: iso(2026, 10, d) });
  it('nothing below 80 %', () => {
    expect(buildSchedule(NOW, cfg, { budgets, transactions: [spend(7000)] })).toEqual([]);
  });
  it('80 %: once, at the next slot, with what is left', () => {
    const [item] = buildSchedule(NOW, cfg, { budgets, transactions: [spend(8200)] });
    expect(item.key).toBe('2026-10:80');
    expect(new Date(item.at).getHours()).toBe(19);
    expect(item.title).toBe('82% of October’s budget used');
    expect(item.body).toMatch(/₹1,800 left for the next 18 days/);
  });
  it('100 % replaces 80 %, and a fired alert never comes back', () => {
    const data = { budgets, transactions: [spend(8200, 5), spend(2500, 12)] };
    const [item] = buildSchedule(NOW, cfg, data);
    expect(item.key).toBe('2026-10:100');
    expect(item.title).toMatch(/budget is used up/);
    const fired = buildSchedule(NOW, cfg, { ...data, budgetAt: { '2026-10:100': NOW - 3600e3 } });
    expect(fired).toEqual([]);
    const planned = buildSchedule(NOW, cfg, { ...data, budgetAt: { '2026-10:100': NOW + 7200e3 } });
    expect(planned[0].at).toBe(NOW + 7200e3);   // keeps its slot across re-plans
  });
  it('no total budget → no alerts', () => {
    expect(buildSchedule(NOW, cfg, { budgets: { total: null }, transactions: [spend(99999)] })).toEqual([]);
  });
});

describe('weekly summary', () => {
  const sunday = new Date(2026, 9, 18, 10, 0).getTime();
  const cfg = on({ weekly: { enabled: true, time: '19:00', day: 0 } });
  const txns = [
    { type: 'expense', amount: 1200, date: iso(2026, 10, 13), category: 'food' },
    { type: 'expense', amount: 300, date: iso(2026, 10, 17), category: 'transport' },
    { type: 'expense', amount: 2000, date: iso(2026, 10, 8), category: 'food' },
  ];
  it('real numbers when planned the same day', () => {
    const [item] = buildSchedule(sunday, cfg, { transactions: txns, categoryRules: {} });
    expect(item.body).toMatch(/^₹1,500 spent this week, ₹500 less than last week · most on/);
    expect(item.route).toBe('stats');
  });
  it('a generic line when planned ahead (numbers would be stale)', () => {
    const items = buildSchedule(NOW, cfg, { transactions: txns });
    expect(items[0].body).toMatch(/summary is ready/);
  });
});

describe('tone + preview', () => {
  it('brief is brief, coach adds a nudge, no guilt words anywhere', () => {
    const t = { type: 'expense', amount: 9000, date: iso(2026, 10, 3) };
    for (const tone of ['friendly', 'brief', 'coach']) {
      const items = buildSchedule(NOW, on({ tone, daily: { enabled: true }, budget: { enabled: true } }), { budgets: { total: 10000 }, transactions: [t] });
      for (const i of items) expect(`${i.title} ${i.body}`).not.toMatch(/fail|bad|should have|forgot|lazy|guilt/i);
    }
  });
  it('preview falls back to an example when the data has nothing to say', () => {
    const p = previewReminder('recurring', {}, { recurring: [] }, NOW);
    expect(p.example).toBe(true);
    expect(p.body).toMatch(/Rent/);
    expect(p.route).toBe('plan');            // a tapped test opens the right screen
    expect(previewReminder('daily', {}, {}, NOW).title).toBeTruthy();
  });
});

it('two types the same day stay separate, sorted by time', () => {
  const items = buildSchedule(NOW, on({ daily: { enabled: true, time: '21:00' }, budget: { enabled: true, time: '19:00' } }),
    { budgets: { total: 1000 }, transactions: [{ type: 'expense', amount: 900, date: iso(2026, 10, 2) }] });
  expect(types(items).slice(0, 2)).toEqual(['budget', 'daily']);
});
