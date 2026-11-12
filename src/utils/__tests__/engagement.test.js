import { describe, it, expect } from 'vitest';
import { streak, milestoneReached, noSpendDays, weekChallenge, newWeekChallenge, weekChallengeTarget } from '../engagement';
import { findSubscriptions, monthForecast, unusualSpending } from '../insights';
import { answer, parseQuestion, parseRange } from '../ask';
import { buildSchedule } from '../reminders';

const iso = (k, h = 12) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };
const e = (name, amount, k, extra = {}) => ({ id: `${name}-${k}-${amount}`, type: 'expense', name, amount, date: iso(k), ...extra });
const TODAY = '2026-11-12';

describe('streaks', () => {
  const days = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'];
  const txns = [...days.map((k) => e('Chai', 20, k)), e('Lunch', 100, '2026-10-01'), e('Lunch', 100, '2026-10-02'), e('Lunch', 100, '2026-10-03'), e('Lunch', 100, '2026-10-04'), e('Lunch', 100, '2026-10-05')];
  it('is alive until midnight, counts back from yesterday', () => {
    const s = streak(txns, [], TODAY);
    expect(s.current).toBe(4);
    expect(s.loggedToday).toBe(false);
    expect(s.atRisk).toBe(true);
    expect(s.best).toBe(5);
    expect(s.next).toBe(7);
  });
  it('logging today extends it; income counts too', () => {
    const s = streak(txns, [{ amount: 1, date: iso(TODAY) }], TODAY);
    expect(s.current).toBe(5);
    expect(s.loggedToday).toBe(true);
  });
  it('a missed day breaks it', () => {
    expect(streak([e('x', 1, '2026-11-10')], [], TODAY).current).toBe(0);
  });
  it('milestones', () => {
    const three = ['2026-11-10', '2026-11-11', TODAY].map((k) => e('x', 1, k));
    expect(milestoneReached(streak(three, [], TODAY))).toBe(3);
    expect(milestoneReached(streak(three.slice(1), [], TODAY))).toBe(null);
  });
});

describe('no-spend days', () => {
  it('counts finished days without an expense', () => {
    const n = noSpendDays([e('a', 1, '2026-11-02'), e('b', 1, '2026-11-05'), { type: 'savings', amount: 5, date: iso('2026-11-07') }], '2026-11', TODAY);
    expect(n.counted).toBe(11);
    expect(n.count).toBe(9);
    expect(n.run).toBe(6);              // 6th–11th
    expect(n.todayClean).toBe(true);
  });
  it('a past month counts every day', () => {
    expect(noSpendDays([], '2026-10', TODAY).count).toBe(31);
  });
});

describe('52-week challenge', () => {
  it('₹100 a week number → ₹1,37,800', () => {
    expect(weekChallengeTarget(100)).toBe(137800);
    const g = newWeekChallenge(100, '2026-11-01', 'g1');
    const w = weekChallenge(g, TODAY);
    expect(w.week).toBe(2);
    expect(w.thisWeek).toBe(200);
    expect(w.dueSoFar).toBe(300);
    expect(g.deadline).toBe('2027-10-30');
  });
});

describe('insights', () => {
  const subs = [
    e('Netflix', 649, '2026-09-03'), e('Netflix', 649, '2026-10-03'), e('Netflix', 649, '2026-11-03'),
    e('Gym', 1500, '2026-10-01'), e('Gym', 1500, '2026-11-01'),
    e('Swiggy', 300, '2026-10-02'), e('Swiggy', 450, '2026-10-09'), e('Swiggy', 200, '2026-11-02'),
    e('Hotstar', 299, '2026-08-01'),                               // stopped
    e('iCloud', 75, '2026-11-05'),                                  // subscription category, once
  ];
  it('finds subscriptions', () => {
    const s = findSubscriptions(subs, {}, TODAY);
    expect(s.map((x) => x.name)).toEqual(['Gym', 'Netflix', 'iCloud']);
  });
  it('forecasts the month', () => {
    const f = monthForecast({ transactions: [e('a', 1100, '2026-11-01'), e('b', 100, '2026-11-11'), e('old', 9000, '2026-10-10')], income: [], recurringRules: [], todayKey: TODAY });
    expect(f.spent).toBe(1200);
    expect(f.projected).toBe(Math.round(1200 + (1200 / 12) * 18));
    expect(f.lastMonth).toBe(9000);
  });
  it('counts bills still due, without double counting', () => {
    const rule = { id: 'r', kind: 'expense', name: 'Rent', amount: 10000, frequency: 'monthly', dayOfMonth: 20, startDate: '2026-01-01', active: true };
    const f = monthForecast({ transactions: [e('a', 1200, '2026-11-01')], income: [], recurringRules: [rule], todayKey: TODAY });
    expect(f.dueBills).toBe(10000);
    expect(f.projected).toBe(Math.round(1200 + 100 * 18 + 10000));
  });
  it('rent, EMIs and same-price shopping are not subscriptions', () => {
    const same = ['2026-09', '2026-10', '2026-11'].flatMap((m) => [e('House rent', 14000, `${m}-05`), e('Bike loan EMI', 4200, `${m}-07`), e('Amazon', 2400, `${m}-09`), e('Wifi', 799, `${m}-04`)]);
    expect(findSubscriptions(same, {}, TODAY).map((x) => x.name)).toEqual(['Wifi']);
  });
  it('monthly payments count once in the forecast, not as a daily pace', () => {
    const txns = [
      e('House rent', 14000, '2026-10-05'), e('House rent', 14000, '2026-11-05'),
      e('Gym', 1500, '2026-09-20'), e('Gym', 1500, '2026-10-20'),     // not paid yet this month: still to come
      e('Goa trip', 9000, '2026-10-25'),                              // a one-off last month: not expected again
      e('Chai', 120, '2026-11-02'), e('Chai', 120, '2026-11-09'),
    ];
    const f = monthForecast({ transactions: txns, income: [], recurringRules: [], todayKey: TODAY });
    expect(f.spent).toBe(14240);
    expect(f.dueBills).toBe(1500);
    expect(f.projected).toBe(Math.round(14240 + (240 / 12) * 18 + 1500));
  });
  it('a monthly payment landing this week is not "running hot"', () => {
    const txns = [e('Bike loan EMI', 4200, '2026-10-07'), e('Electricity bill', 1350, '2026-10-10'), e('Electricity bill', 1350, '2026-11-10'), e('Mobile', 300, '2026-10-01'), e('Mobile', 300, '2026-11-08')];
    expect(unusualSpending(txns, {}, TODAY)).toEqual([]);
  });
  it('flags categories running hot', () => {
    const hist = Array.from({ length: 8 }, (_, i) => e('Swiggy', 400, `2026-10-${String(1 + i * 3).padStart(2, '0')}`, { category: 'food' }));
    const hot = [e('Zomato', 900, '2026-11-08', { category: 'food' }), e('Dinner', 900, '2026-11-11', { category: 'food' })];
    const u = unusualSpending([...hist, ...hot], {}, TODAY);
    expect(u[0].key).toBe('food');
    expect(u[0].times).toBeGreaterThan(4);
  });
});

describe('ask', () => {
  const txns = [
    e('Swiggy', 300, '2026-11-02'), e('Swiggy', 450, '2026-11-09'), e('Petrol', 1800, '2026-11-06'),
    e('Swiggy', 200, '2026-10-10'), e('Zomato', 600, '2026-10-12'), e('Laptop', 52000, '2026-03-04'),
    { id: 's', type: 'savings', name: 'SIP', amount: 6000, date: iso('2026-11-02') },
  ];
  const income = [{ amount: 65000, date: iso('2026-08-01'), name: 'Salary' }];
  const ctx = { transactions: txns, income, rules: {}, todayKey: TODAY };
  it('ranges', () => {
    expect(parseRange(' last month ', TODAY)).toMatchObject({ start: '2026-10-01', end: '2026-10-31' });
    expect(parseRange(' december ', TODAY)).toMatchObject({ start: '2025-12-01' });
    expect(parseRange(' oct 2025 ', TODAY)).toMatchObject({ start: '2025-10-01' });
    expect(parseRange(' last 7 days ', TODAY)).toMatchObject({ start: '2026-11-06', end: TODAY });
    expect(parseRange(' this week ', TODAY)).toMatchObject({ start: '2026-11-09' });
  });
  it('how much on a name', () => {
    const a = answer('How much did I spend on Swiggy this month?', ctx);
    expect(a.value).toBe(750);
    expect(a.parsed.term).toBe('swiggy');
  });
  it('a category, last month', () => {
    const a = answer('food last month', ctx);
    expect(a.parsed.category).toBe('food');
    expect(a.value).toBe(800);
  });
  it('biggest this year', () => {
    expect(answer('Biggest expense this year', ctx).value).toBe(52000);
  });
  it('how many times', () => {
    const a = answer('How many times Swiggy in October?', ctx);
    expect(a.value).toBe(1);
    expect(a.unit).toBe('count');
  });
  it('income and savings', () => {
    expect(answer('Income in August', ctx).value).toBe(65000);
    expect(answer('how much did I save this month', ctx).value).toBe(6000);
  });
  it('compare', () => {
    const a = answer('compare this month and last month', ctx);
    expect(a.rows.map((r) => r.value)).toEqual([2550, 800]);
  });
  it('average per day', () => {
    expect(answer('average per day this month', ctx).value).toBeCloseTo(2550 / 12, 1);
  });
  it('keeps unknown words as a search', () => {
    expect(parseQuestion('rapido last week', TODAY).term).toBe('rapido');
  });
});

describe('evening reminder knows the streak', () => {
  const cfg = { daily: { enabled: true, time: '21:00' } };
  const now = new Date(2026, 10, 12, 10);
  const txns = ['2026-11-09', '2026-11-10', '2026-11-11'].map((k) => e('Chai', 20, k));
  it('tonight: keep the streak', () => {
    const items = buildSchedule(now, cfg, { transactions: txns, income: [] }).filter((i) => i.type === 'daily');
    expect(items[0].title).toMatch(/3-day streak/);
    expect(items[1].title).not.toMatch(/streak/);
  });
  it('logged today: tomorrow carries it', () => {
    const items = buildSchedule(now, cfg, { transactions: [...txns, e('Lunch', 90, '2026-11-12')], income: [] }).filter((i) => i.type === 'daily');
    expect(items[0].key).toBe('2026-11-13');
    expect(items[0].title).toMatch(/4-day streak/);
  });
});
