import { describe, it, expect } from 'vitest';
import { normaliseUi, serialiseUi, move, setTabAt, DEFAULT_TABS, PAGE_KEYS, SLOT_KEYS } from '../uiPrefs';

describe('normaliseUi', () => {
  it('gives defaults for missing or junk values', () => {
    for (const raw of [undefined, null, 'x', 42, [], { tabs: 'today' }]) {
      const ui = normaliseUi(raw);
      expect(ui.tabs).toEqual(DEFAULT_TABS);
      expect(ui.start).toBe('today');
      expect(ui.home.map((s) => s.key)).toEqual(['overview', 'add', 'actions', 'due', 'recent']);
      expect(ui.home.every((s) => s.visible)).toBe(true);
    }
  });

  it('always yields three unique bar slots, never Home (it is fixed first)', () => {
    expect(normaliseUi({ tabs: ['plan', 'plan', 'bogus', 'external'] }).tabs).toEqual(['plan', 'external', 'history']);
    // 3.4.0 saved four tabs including Home
    expect(normaliseUi({ tabs: ['today', 'history', 'income', 'stats'] }).tabs).toEqual(['history', 'income', 'stats']);
    for (const t of [[], ['today'], PAGE_KEYS, ['x', 'y']]) {
      const { tabs } = normaliseUi({ tabs: t });
      expect(tabs).toHaveLength(3);
      expect(new Set(tabs).size).toBe(3);
      expect(tabs.every((k) => SLOT_KEYS.includes(k))).toBe(true);
    }
  });

  it('repairs the home order and never hides the shortcuts', () => {
    const ui = normaliseUi({ homeOrder: ['recent', 'recent', 'nope', 'add'], homeHidden: ['actions', 'overview', 'zzz'] });
    expect(ui.home.map((s) => s.key)).toEqual(['overview', 'recent', 'add', 'actions', 'due']);
    expect(ui.home.find((s) => s.key === 'actions').visible).toBe(true);
    expect(ui.home.find((s) => s.key === 'overview').visible).toBe(false);
  });

  it('slots sections added later next to their default neighbour', () => {
    // a 3.4.0 order without 'actions'
    expect(normaliseUi({ homeOrder: ['recent', 'overview', 'due', 'add'] }).home.map((s) => s.key))
      .toEqual(['recent', 'overview', 'due', 'add', 'actions']);
  });

  it('rejects an unknown start page', () => {
    expect(normaliseUi({ start: 'settings' }).start).toBe('today');
    expect(normaliseUi({ start: 'stats' }).start).toBe('stats');
  });

  it('round-trips through serialiseUi', () => {
    const ui = normaliseUi({ tabs: ['plan', 'people', 'income'], start: 'plan', homeOrder: ['add', 'recent'], homeHidden: ['due'] });
    expect(normaliseUi(serialiseUi(ui))).toEqual(ui);
  });
});

describe('move / setTabAt', () => {
  it('moves within bounds and ignores moves past the ends', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const l = ['a', 'b'];
    expect(move(l, 0, -1)).toBe(l);
    expect(move(l, 1, 1)).toBe(l);
  });

  it('swaps when the chosen page is already in another slot', () => {
    expect(setTabAt(['history', 'income', 'stats'], 0, 'stats')).toEqual(['stats', 'income', 'history']);
    expect(setTabAt(['history', 'income', 'stats'], 1, 'plan')).toEqual(['history', 'plan', 'stats']);
    const t = ['history', 'income', 'stats'];
    expect(setTabAt(t, 0, 'today')).toBe(t);
    expect(setTabAt(t, 1, 'bogus')).toBe(t);
    expect(setTabAt(t, 9, 'plan')).toBe(t);
  });
});
