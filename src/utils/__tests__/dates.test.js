import { describe, it, expect } from 'vitest';
import { localDateKey, localMonthKey, isoToMonth, dateInputToISO } from '../dateHelpers';
import { filterItemsByPeriod, getAvailableMonths } from '../periodHelpers';

// Tests run with TZ=Asia/Kolkata (UTC+5:30) — see package.json "test".

describe('local date keys', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 1 Mar 2026 01:00 IST  ==  28 Feb 2026 19:30 UTC
    const iso = new Date(2026, 2, 1, 1, 0).toISOString();
    expect(iso.slice(0, 10)).toBe('2026-02-28');      // the old (buggy) approach
    expect(localDateKey(iso)).toBe('2026-03-01');
    expect(localMonthKey(iso)).toBe('2026-03');
    expect(isoToMonth(iso)).toBe('2026-03');
  });

  it('returns null for missing or invalid input', () => {
    expect(localDateKey(undefined)).toBeNull();
    expect(localDateKey('not a date')).toBeNull();
  });

  it('dateInputToISO round-trips to the same local day', () => {
    expect(localDateKey(dateInputToISO('2026-01-31'))).toBe('2026-01-31');
  });
});

describe('filterItemsByPeriod', () => {
  const justAfterMidnight = { id: 'a', date: new Date(2026, 2, 1, 0, 30).toISOString() };
  const midMonth          = { id: 'b', date: new Date(2026, 1, 15, 12).toISOString() };
  const items = [justAfterMidnight, midMonth];

  it('buckets an entry made just after local midnight into the new month', () => {
    const march = filterItemsByPeriod(items, { type: 'select_month', value: '2026-03' });
    expect(march.map(i => i.id)).toEqual(['a']);
    const feb = filterItemsByPeriod(items, { type: 'select_month', value: '2026-02' });
    expect(feb.map(i => i.id)).toEqual(['b']);
  });

  it('filters by year and custom range using local dates', () => {
    expect(filterItemsByPeriod(items, { type: 'year', value: '2026' })).toHaveLength(2);
    const range = filterItemsByPeriod(items, { type: 'custom_range', start: '2026-03-01', end: '2026-03-31' });
    expect(range.map(i => i.id)).toEqual(['a']);
  });

  it('ignores items without a date in a custom range', () => {
    expect(filterItemsByPeriod([{ id: 'x' }], { type: 'custom_range', start: '2026-01-01', end: '2026-12-31' })).toEqual([]);
  });

  it('lists available months in local time', () => {
    expect(getAvailableMonths([justAfterMidnight], [])).toContain('2026-03');
    expect(getAvailableMonths([justAfterMidnight], [])).not.toContain('2026-02');
  });
});
