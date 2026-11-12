import { describe, it, expect } from 'vitest';
import { demoSeed, DEMO_USER, isDemoUser } from '../../demo/demo';

describe('demo data', () => {
  const now = new Date(2026, 10, 12, 12);
  const d = demoSeed(now);
  it('three months of entries, none in the future', () => {
    expect(d.transactions.length).toBeGreaterThan(40);
    expect(d.income.length).toBe(3);
    expect([...d.transactions, ...d.income].every((e) => new Date(e.date) <= now)).toBe(true);
    expect(new Set(d.transactions.map((t) => t.id)).size).toBe(d.transactions.length);
  });
  it('has the pieces every page shows', () => {
    expect(d.transactions.some((t) => t.type === 'savings')).toBe(true);
    expect(d.transactions.some((t) => t.type === 'person')).toBe(true);
    expect(d.settings.budgets.total).toBeGreaterThan(0);
    expect(d.settings.goals).toHaveLength(1);
    expect(d.rules.map((r) => r.kind).sort()).toEqual(['expense', 'expense', 'income', 'savings']);
  });
  it('the demo user is never a real account', () => {
    expect(isDemoUser(DEMO_USER)).toBe(true);
    expect(isDemoUser({ uid: 'x' })).toBe(false);
    expect(DEMO_USER.emailVerified).toBe(false);
  });
});
