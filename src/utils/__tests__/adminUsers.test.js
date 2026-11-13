import { describe, it, expect } from 'vitest';
import { statusOf, viewUsers, summarise, agoLabel } from '../adminUsers';
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
  it('smart filters', () => {
    const ids = (f, o = {}) => viewUsers(users, { filter: f, ...o }, now).map((u) => u.uid);
    expect(ids('active')).toEqual(['a', 'e', 'b']);
    expect(ids('logging')).toEqual(['a']);
    expect(ids('lurking').sort()).toEqual(['b', 'e']);
    expect(ids('nodata')).toEqual(['b']);
    expect(ids('accounts')).toHaveLength(5);
    expect(ids('never')).toEqual(['b']);
    expect(ids('new')).toEqual(['b']);
    expect(ids('gone')).toEqual(['d']);
    expect(ids('all', { platform: 'android' })).toEqual(['a', 'e']);
    expect(ids('all', { search: 'DEV@' })).toEqual(['d']);
    expect(ids('all', { sort: 'entries' })).toEqual(['a', 'c', 'e', 'd', 'b']);
  });
  it('summary', () => {
    const s = summarise(users, now);
    expect(s.total).toBe(5);
    expect(s.counts.active).toBe(3);
    expect(s.returning).toBe(2);
    expect(s.platforms).toEqual({ android: 2, web: 2, desktop: 1 });
    expect(s.entries).toBe(508);
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
