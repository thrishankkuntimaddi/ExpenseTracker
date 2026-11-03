import { describe, it, expect } from 'vitest';
import { borrowAlerts, checkDateOf, borrowings } from '../borrowed';
import { respProgress, respSummary, sortResponsibilities, renumber } from '../responsibilities';
import { computeStats } from '../finance';
import { monthSeries, compareCategories, topSpends, shiftMonth } from '../statsView';
import { insurancePolicies } from '../bills';
import { buildSchedule } from '../reminders';
import { inferCategory } from '../categories';

const iso = (k) => `${k}T10:00:00.000Z`;
const borrowedIn = (id, name, amount, day, extra = {}) => ({ id, name, amount, date: iso(day), type: 'income', isBorrowed: true, ...extra });
const paidBack = (id, name, amount, day) => ({ id, name, amount, date: iso(day), type: 'person', direction: 'repaid' });
const expense = (id, name, amount, day, extra = {}) => ({ id, name, amount, date: iso(day), type: 'expense', ...extra });

describe('borrowed money: was it used?', () => {
  it('check dates: a week by default, month end, or a chosen day', () => {
    expect(checkDateOf({ date: iso('2026-11-03') })).toBe('2026-11-10');
    expect(checkDateOf({ date: iso('2026-11-03'), checkOn: 'month_end' })).toBe('2026-11-30');
    expect(checkDateOf({ date: iso('2026-10-31'), checkOn: 'month_end' })).toBe('2026-11-30');   // last day → next month's end
    expect(checkDateOf({ date: iso('2026-11-03'), checkOn: '2026-11-20' })).toBe('2026-11-20');
  });

  it('₹10,000 borrowed and barely spent: asked about after the check date, not before', () => {
    const income = [borrowedIn('b1', 'Ravi', 10000, '2026-11-01')];
    const txns = [expense('e1', 'Chai', 100, '2026-11-02')];
    expect(borrowAlerts(txns, income, '2026-11-05')).toEqual([]);
    const [a] = borrowAlerts(txns, income, '2026-11-08');
    expect(a.kind).toBe('unused');
    expect(a.outstanding).toBe(10000);
    expect(a.spentSince).toBe(100);
  });

  it('spent it → no question; kept on purpose → no question', () => {
    const income = [borrowedIn('b1', 'Ravi', 10000, '2026-11-01')];
    expect(borrowAlerts([expense('e1', 'Laptop', 12000, '2026-11-02')], income, '2026-11-09')).toEqual([]);
    expect(borrowAlerts([], [{ ...income[0], borrowAck: true }], '2026-11-09')).toEqual([]);
  });

  it('borrowed ₹700 on 31 Oct, paid back 1 Nov, nothing spent: "what was it for?"', () => {
    const income = [borrowedIn('b1', 'Kiran', 700, '2026-10-31')];
    const txns = [paidBack('p1', 'Kiran', 700, '2026-11-01')];
    const [a] = borrowAlerts(txns, income, '2026-11-03');
    expect(a.kind).toBe('unexplained');
    expect(a.repaidDay).toBe('2026-11-01');
    // Saying what it was for ends the question
    expect(borrowAlerts(txns, [{ ...income[0], note: 'Gave to Mom for medicine' }], '2026-11-03')).toEqual([]);
    // …and after two weeks it's dropped
    expect(borrowAlerts(txns, income, '2026-11-20')).toEqual([]);
  });

  it('repayments go to the oldest borrowing first', () => {
    const income = [borrowedIn('b1', 'Ravi', 1000, '2026-10-01'), borrowedIn('b2', 'Ravi', 500, '2026-10-10')];
    const list = borrowings([paidBack('p1', 'ravi', 1200, '2026-10-20')], income);
    expect(list.find((b) => b.entry.id === 'b1').outstanding).toBe(0);
    expect(list.find((b) => b.entry.id === 'b2').outstanding).toBe(300);
  });
});

describe('responsibilities', () => {
  const mom = { id: 'r1', title: 'Mom’s gold loan', owedTo: 'SBI', total: 50000, plan: 'monthly', monthly: 5000, priority: 2 };
  const dad = { id: 'r2', title: 'Dad’s promise', total: 12000, plan: 'by_date', dueBy: '2027-01-31', priority: 1 };
  const pay = (id, rid, amount, day, extra) => expense(id, 'x', amount, day, { category: 'responsibility', responsibilityId: rid, ...extra });

  it('progress, this month’s share and months to go', () => {
    const p = respProgress(mom, [pay('a', 'r1', 5000, '2026-10-05'), pay('b', 'r1', 2000, '2026-11-02')], '2026-11-03');
    expect(p.paid).toBe(7000);
    expect(p.remaining).toBe(43000);
    expect(p.dueThisMonth).toBe(3000);
    expect(p.monthsLeft).toBe(9);
  });

  it('a dated one spreads what is left over the months to go', () => {
    const p = respProgress(dad, [], '2026-11-03');
    expect(p.monthlyTarget).toBe(4000);   // Nov, Dec, Jan
  });

  it('sorted by priority; summary says what is first', () => {
    const list = sortResponsibilities([mom, dad, { ...mom, id: 'r3', status: 'cleared' }]);
    expect(list.map((r) => r.id)).toEqual(['r2', 'r1', 'r3']);
    expect(renumber(list).map((r) => r.priority)).toEqual([1, 2, 2]);
    const s = respSummary([mom, dad], [], '2026-11-03');
    expect(s.next.resp.id).toBe('r2');
    expect(s.remaining).toBe(62000);
  });

  it('paid from savings is spending but does not come off the balance twice', () => {
    const inc = [{ id: 'i', name: 'Salary', amount: 30000, date: iso('2026-11-01') }];
    const fromSalary = computeStats([pay('a', 'r1', 5000, '2026-11-02')], inc, {});
    const fromSavings = computeStats([pay('a', 'r1', 5000, '2026-11-02', { paidFrom: 'savings' })], inc, {});
    expect(fromSalary.totalExpense).toBe(5000);
    expect(fromSalary.balance).toBe(25000);
    expect(fromSavings.totalExpense).toBe(5000);
    expect(fromSavings.balance).toBe(30000);
    expect(fromSavings.paidFromSavings).toBe(5000);
  });

  it('reminds on its day with this month’s amount', () => {
    const now = new Date('2026-11-30T08:00:00').getTime();
    const cfg = { responsibilities: { enabled: true, time: '10:30' } };
    const plan = buildSchedule(now, cfg, { responsibilities: [{ ...mom, remindDay: 1 }] });
    const item = plan.find((i) => i.type === 'responsibilities');
    expect(item).toBeTruthy();
    expect(new Date(item.at).getDate()).toBe(1);
    expect(item.title).toContain('Mom’s gold loan');
  });
});

describe('stats page maths', () => {
  const txns = [
    expense('a', 'Swiggy', 500, '2026-10-05'), expense('b', 'Swiggy', 900, '2026-11-05'),
    expense('c', 'Petrol', 300, '2026-11-06'), { id: 's', type: 'savings', name: 'SIP', amount: 2000, date: iso('2026-11-07') },
  ];
  const income = [{ id: 'i', name: 'Salary', amount: 30000, date: iso('2026-11-01') }];

  it('six months ending at the month on screen', () => {
    const s = monthSeries(txns, income, '2026-11', 6);
    expect(s).toHaveLength(6);
    expect(s[5]).toMatchObject({ key: '2026-11', in: 30000, saved: 2000, spent: 1200 });
    expect(s[4]).toMatchObject({ key: '2026-10', spent: 500 });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('categories against last month, biggest change first', () => {
    const c = compareCategories(txns, '2026-11', {});
    expect(c.rows[0]).toMatchObject({ key: 'food', now: 900, prev: 500, change: 400, pct: 80 });
    expect(c.rows.find((r) => r.key === 'fuel').pct).toBe(null);   // new this month
    expect(c.totalPct).toBe(140);
  });

  it('biggest spends', () => {
    expect(topSpends(txns, '2026-11', 1).map((t) => t.id)).toEqual(['b']);
  });
});

describe('insurance', () => {
  it('is its own category and lists policies by renewal', () => {
    expect(inferCategory('Star Health premium')).toBe('insurance');
    expect(inferCategory('LIC')).toBe('insurance');
    const rules = [
      { id: 'h', kind: 'expense', category: 'insurance', name: 'Health', amount: 12000, frequency: 'yearly', startDate: '2026-03-10' },
      { id: 'v', kind: 'expense', category: 'insurance', name: 'Bike', amount: 1500, frequency: 'yearly', startDate: '2025-11-20' },
      { id: 'r', kind: 'expense', category: 'rent', name: 'Rent', amount: 9000, frequency: 'monthly', startDate: '2026-01-05' },
    ];
    const list = insurancePolicies(rules, '2026-11-03');
    expect(list.map((p) => [p.rule.id, p.next, p.days])).toEqual([['v', '2026-11-20', 17], ['h', '2027-03-10', 127]]);
  });

  it('a heads-up a week before a yearly policy renews', () => {
    const now = new Date('2026-11-12T08:00:00').getTime();
    const plan = buildSchedule(now, { recurring: { enabled: true, time: '10:00' } }, {
      recurring: [{ id: 'v', kind: 'expense', category: 'insurance', name: 'Bike insurance', amount: 1500, frequency: 'yearly', startDate: '2025-11-20', active: true }],
    });
    const heads = plan.filter((i) => i.key.startsWith('ins:'));
    expect(heads).toHaveLength(1);
    expect(new Date(heads[0].at).getDate()).toBe(13);
    expect(heads[0].title).toContain('renews');
  });
});
