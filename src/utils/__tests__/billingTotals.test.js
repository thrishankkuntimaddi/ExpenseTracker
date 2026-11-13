import { describe, it, expect } from 'vitest';
import { billingTotals } from '../../features/external/components/billingHelpers';

describe('billing totals', () => {
  it('only the closed billings handed in (the month on screen) count; drafts stay apart', () => {
    const closed = [{ total_spent: 400, total_received: 500, net_balance: 100 }, { total_spent: 300, total_received: 100, net_balance: -200 }];
    const pending = [{ total_spent: 897500, status: 'draft' }];
    expect(billingTotals(closed, pending)).toEqual({ spent: 700, back: 600, out: 200, pendingSpent: 897500, open: 1, closed: 2 });
    expect(billingTotals([], [])).toMatchObject({ spent: 0, back: 0, out: 0, open: 0 });
  });
});

import { tripInMonth } from '../periodHelpers';
describe('finished trips belong to the months they ran in', () => {
  it('start to end, start only, or when it was closed', () => {
    const t = { startDate: '2026-09-30', endDate: '2026-10-02' };
    expect(['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => tripInMonth(t, m))).toEqual([false, true, true, false]);
    expect(tripInMonth({ startDate: '2026-09-30' }, '2026-11')).toBe(false);
    expect(tripInMonth({ startDate: '2026-09-30', endDate: '2026-09-01' }, '2026-09')).toBe(true);
    expect(tripInMonth({ closedAt: '2026-11-03' }, '2026-11')).toBe(true);
    expect(tripInMonth({}, '2026-11')).toBe(false);
  });
});
