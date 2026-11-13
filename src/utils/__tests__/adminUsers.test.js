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
