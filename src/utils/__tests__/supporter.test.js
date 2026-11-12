import { describe, it, expect } from 'vitest';
import { codeFor, readRefCode, supporterUntil, supporterStatus, isNewAccount, CODE_RE, REF_DAYS } from '../supporter';

const DAY = 24 * 3600 * 1000;
const t0 = Date.UTC(2026, 10, 1);

describe('invite codes', () => {
  it('the same account always gets the same readable code', async () => {
    const a = await codeFor('uid-123');
    expect(a).toMatch(CODE_RE);
    expect(a).not.toMatch(/[01OI]/);
    expect(await codeFor('uid-123')).toBe(a);
    expect(await codeFor('uid-124')).not.toBe(a);
  });
  it('reads ?ref= from a link, ignoring junk', () => {
    expect(readRefCode('?ref=abc2345')).toBe('ABC2345');
    expect(readRefCode('?demo=1&ref=ABC2345')).toBe('ABC2345');
    expect(readRefCode('?ref=abc')).toBeNull();
    expect(readRefCode('?ref=ABC0345')).toBeNull();   // 0 is not in codes
    expect(readRefCode('')).toBeNull();
  });
});

describe('supporter days', () => {
  it('only friends who added an entry count, and days stack', () => {
    const referrals = [{ activeAt: t0 }, { activeAt: t0 + 5 * DAY }, { createdAt: t0 }];
    expect(supporterUntil({ referrals })).toBe(t0 + 2 * REF_DAYS * DAY);
    const s = supporterStatus({ referrals, now: t0 + 10 * DAY });
    expect(s).toMatchObject({ active: true, joined: 3, counted: 2, daysLeft: 50, paid: false });
  });
  it('a gap starts the days again from the next friend', () => {
    expect(supporterUntil({ referrals: [{ activeAt: t0 }, { activeAt: t0 + 100 * DAY }] })).toBe(t0 + 130 * DAY);
  });
  it('paid support counts, whichever ends later', () => {
    expect(supporterUntil({ referrals: [{ activeAt: t0 }], paidUntil: t0 + 365 * DAY })).toBe(t0 + 365 * DAY);
    expect(supporterStatus({ paidUntil: { toMillis: () => t0 + DAY }, now: t0 }).paid).toBe(true);
  });
  it('nothing yet: not a supporter', () => {
    expect(supporterStatus({ now: t0 })).toMatchObject({ active: false, daysLeft: 0, joined: 0 });
  });
  it('only a new account can be credited to an inviter', () => {
    expect(isNewAccount({ metadata: { creationTime: new Date(t0).toUTCString() } }, t0 + DAY)).toBe(true);
    expect(isNewAccount({ metadata: { creationTime: new Date(t0).toUTCString() } }, t0 + 10 * DAY)).toBe(false);
    expect(isNewAccount({}, t0)).toBe(false);
  });
});
