import { describe, it, expect } from 'vitest';
import { tripTiming, budgetPace, tripStory, settleUpMessage } from '../tripInsights';

const today = new Date('2026-11-15T10:00:00');

describe('tripTiming', () => {
  it('upcoming, on, done, undated', () => {
    expect(tripTiming({ startDate: '2026-11-20', endDate: '2026-11-22' }, today)).toMatchObject({ phase: 'upcoming', inDays: 5, length: 3 });
    expect(tripTiming({ startDate: '2026-11-14', endDate: '2026-11-17' }, today)).toMatchObject({ phase: 'on', day: 2, length: 4, daysLeft: 2 });
    expect(tripTiming({ startDate: '2026-11-01', endDate: '2026-11-03' }, today)).toMatchObject({ phase: 'done', endedDaysAgo: 12 });
    expect(tripTiming({}, today).phase).toBe('undated');
  });
});

describe('budgetPace', () => {
  it('none without a budget', () => expect(budgetPace({}, 100, today)).toBeNull());
  it('pace while the trip is on', () => {
    const p = budgetPace({ startDate: '2026-11-14', endDate: '2026-11-17', budget: 10000 }, 6000, today);
    expect(p).toMatchObject({ left: 4000, perDaySoFar: 3000, perDayLeft: 1333.33, projected: 12000, tone: 'tight' });
  });
  it('over budget', () => expect(budgetPace({ budget: 1000 }, 1200, today).tone).toBe('over'));
});

describe('tripStory and settle-up', () => {
  const trip = { name: 'Goa', startDate: '2026-11-14', endDate: '2026-11-15', members: [{ id: 'a', name: 'Asha' }, { id: 'b', name: 'Ravi' }],
    expenses: [{ paidBy: 'a', title: 'Fuel', amount: 2000, date: '2026-11-14' }, { paidBy: 'b', title: 'Dinner', amount: 900, date: '2026-11-15' }, { paidBy: 'a', title: 'Toll', amount: 100, date: '2026-11-15' }] };
  const summary = { total: 3000, perHead: 1500, members: [{ name: 'Asha', paid: 2100 }, { name: 'Ravi', paid: 900 }], transfers: [{ fromName: 'Ravi', toName: 'Asha', amount: 600 }] };
  it('story', () => {
    const s = tripStory(trip, summary);
    expect(s.days).toEqual([{ date: '2026-11-14', amount: 2000 }, { date: '2026-11-15', amount: 1000 }]);
    expect(s.biggest).toMatchObject({ title: 'Fuel', by: 'Asha' });
    expect(s.topPayer.name).toBe('Asha');
    expect(s.perPersonPerDay).toBe(750);
  });
  it('message', () => {
    expect(settleUpMessage(trip, summary, (n) => `₹${n}`)).toContain('Ravi → Asha: ₹600');
    expect(settleUpMessage(trip, { transfers: [] }, String)).toContain('all settled');
  });
});
