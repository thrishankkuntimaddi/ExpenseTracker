import { describe, it, expect } from 'vitest';
import { statusOf, viewUsers, summarise, agoLabel, adminStateOf, daysQuiet } from '../adminUsers';
import { isAdmin } from '../../config/admin';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 12, 12);
const users = [
  { uid: 'a', name: 'Asha', email: 'asha@x.in', createdAt: now - 100 * DAY, lastOpenedAt: now - 2 * 3600e3, lastEntryAt: now - 3 * 3600e3, entries: 420, platform: 'android' },
  { uid: 'b', name: 'Bala', email: 'bala@x.in', createdAt: now - 3 * DAY, lastOpenedAt: now - 2 * DAY, lastEntryAt: null, entries: 0, platform: 'web' },
  { uid: 'c', name: 'Chitra', email: 'chitra@x.in', createdAt: now - 60 * DAY, lastOpenedAt: now - 12 * DAY, lastEntryAt: now - 12 * DAY, entries: 50, platform: 'web' },
  { uid: 'd', name: '', email: 'dev@x.in', createdAt: now - 200 * DAY, lastOpenedAt: now - 90 * DAY, lastEntryAt: now - 95 * DAY, entries: 8, platform: 'desktop' },
  { uid: 'e', name: 'Esha', email: 'esha@x.in', createdAt: now - 40 * DAY, lastOpenedAt: now - 1 * DAY - 1, lastEntryAt: now - 20 * DAY, entries: 30, platform: 'android' },
];

describe('admin users', () => {
  it('status by last open', () => {
    expect(users.map((u) => statusOf(u, now))).toEqual(['today', 'active', 'idle', 'gone', 'active']);
  });
  it('four tabs: active by default, inactive 25+ days, closed, all', () => {
    const ids = (tab, o = {}) => viewUsers(users, { tab, ...o }, now).map((u) => u.uid);
    expect(ids()).toEqual(['a', 'e', 'b', 'c']);                      // default: active, last opened first
    expect(ids('inactive')).toEqual(['d']);
    expect(ids('all')).toHaveLength(5);
    expect(ids('all', { search: 'DEV@' })).toEqual(['d']);
    expect(ids('all', { sort: 'entries' })).toEqual(['a', 'c', 'e', 'd', 'b']);
    expect(ids('all', { sort: 'quiet' })[0]).toBe('d');
    // closing / closed accounts leave the other tabs
    const admin = { d: { state: 'deleted', deletedAt: now - DAY }, a: { state: 'delete_requested' }, e: { state: 'cancelled' } };
    expect(ids('deleted', { admin })).toEqual(['a', 'd']);
    expect(ids('inactive', { admin })).toEqual([]);
    expect(ids('active', { admin })).toEqual(['e', 'b', 'c']);
    expect(adminStateOf(admin.e)).toBe('none');
    expect(daysQuiet(users[3], now)).toBe(90);
  });
  it('summary', () => {
    const s = summarise(users, now);
    expect(s).toMatchObject({ total: 5, today: 1, week: 3, newWeek: 1, neverUsed: 1 });
    expect(s.counts).toEqual({ active: 4, inactive: 1, deleted: 0, all: 5 });
  });
  it('ago labels', () => {
    expect(agoLabel(null, now)).toBe('never');
    expect(agoLabel(now - 3 * 3600e3, now)).toBe('3 h ago');
    expect(agoLabel(now - DAY, now)).toBe('yesterday');
  });
  it('only the verified owner is admin', () => {
    expect(isAdmin({ email: 'thrishankkuntimaddi@gmail.com', emailVerified: true })).toBe(true);
    expect(isAdmin({ email: 'Thrishankkuntimaddi@gmail.com', emailVerified: true })).toBe(true);
    expect(isAdmin({ email: 'thrishankkuntimaddi@gmail.com', emailVerified: false })).toBe(false);
    expect(isAdmin({ email: 'someone@gmail.com', emailVerified: true })).toBe(false);
  });
});

describe('Admin sees → Insights', async () => {
  const { insights, compareVersions } = await import('../adminUsers');
  const now = Date.parse('2026-11-21T18:00:00Z');
  const users = [
    { uid: 'a', version: '4.5.3', platform: 'android', accounts: 3, budget: true, goals: 2, look: 'glass', settingsKeys: 14, entries: 300, lastOpenedAt: now },
    { uid: 'b', version: '4.4.0', platform: 'web', accounts: 0, budget: false, goals: 0, look: 'unsloped', settingsKeys: 1, entries: 120, lastErrAt: now - 3600e3, lastErr: 'save: settings · permission-denied', errCount: 2 },
    { uid: 'c', version: '4.5.3', platform: 'android', entries: 3 },
  ];
  it('versions: newest first, older ones flagged', () => {
    expect(compareVersions('4.10.0', '4.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v4.5.2', '4.5.2')).toBe(0);
    const i = insights(users, now);
    expect(i.latest).toBe('4.5.3');
    expect(i.behind).toBe(1);
    expect(i.versions[0]).toMatchObject({ version: '4.5.3', platform: 'android', count: 2, behind: false });
    expect(i.versions.at(-1)).toMatchObject({ version: '4.4.0', behind: true });
  });
  it('adoption counts only people whose app reports it', () => {
    const a = Object.fromEntries(insights(users, now).adoption.map((r) => [r.key, r]));
    expect(a.accounts).toMatchObject({ count: 1, of: 2, pct: 50 });
    expect(a.budget).toMatchObject({ count: 1, of: 2 });
    expect(a.rules.of).toBe(0);
  });
  it('flags settings that look wiped and recent problems', () => {
    const i = insights(users, now);
    expect(i.wiped.map((u) => u.uid)).toEqual(['b']);
    expect(i.problems.map((u) => u.uid)).toEqual(['b']);
    expect(i.looks[0].value).toBeDefined();
  });
});
