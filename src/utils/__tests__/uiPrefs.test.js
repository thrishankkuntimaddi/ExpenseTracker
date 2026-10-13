import { describe, it, expect } from 'vitest';
import { normaliseUi, serialiseUi, move, setTabAt, DEFAULT_TABS, PAGE_KEYS } from '../uiPrefs';

describe('normaliseUi', () => {
  it('gives defaults for missing or junk values', () => {
    for (const raw of [undefined, null, 'x', 42, [], { tabs: 'today' }]) {
      const ui = normaliseUi(raw);
      expect(ui.tabs).toEqual(DEFAULT_TABS);
      expect(ui.start).toBe('today');
      expect(ui.home.map((s) => s.key)).toEqual(['overview', 'due', 'add', 'recent']);
      expect(ui.home.every((s) => s.visible)).toBe(true);
    }
  });

  it('always yields four unique, known bar pages', () => {
    expect(normaliseUi({ tabs: ['plan', 'plan', 'bogus', 'external'] }).tabs).toEqual(['plan', 'external', 'today', 'history']);
    expect(normaliseUi({ tabs: ['stats', 'plan', 'income', 'history', 'external', 'today'] }).tabs).toEqual(['stats', 'plan', 'income', 'history']);
    for (const t of [[], ['today'], PAGE_KEYS, ['x', 'y']]) {
      const { tabs } = normaliseUi({ tabs: t });
      expect(tabs).toHaveLength(4);
      expect(new Set(tabs).size).toBe(4);
      expect(tabs.every((k) => PAGE_KEYS.includes(k))).toBe(true);
    }
  });

  it('repairs the home order and never hides quick add', () => {
    const ui = normaliseUi({ homeOrder: ['recent', 'recent', 'nope', 'add'], homeHidden: ['add', 'overview', 'zzz'] });
    expect(ui.home.map((s) => s.key)).toEqual(['recent', 'add', 'overview', 'due']);
    expect(ui.home.find((s) => s.key === 'add').visible).toBe(true);
    expect(ui.home.find((s) => s.key === 'overview').visible).toBe(false);
  });

  it('rejects an unknown start page', () => {
    expect(normaliseUi({ start: 'settings' }).start).toBe('today');
    expect(normaliseUi({ start: 'stats' }).start).toBe('stats');
  });

  it('round-trips through serialiseUi', () => {
    const ui = normaliseUi({ tabs: ['plan', 'today', 'stats', 'income'], start: 'plan', homeOrder: ['add', 'recent'], homeHidden: ['due'] });
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
    expect(setTabAt(['today', 'history', 'income', 'stats'], 0, 'stats')).toEqual(['stats', 'history', 'income', 'today']);
    expect(setTabAt(['today', 'history', 'income', 'stats'], 1, 'plan')).toEqual(['today', 'plan', 'income', 'stats']);
    const t = ['today', 'history', 'income', 'stats'];
    expect(setTabAt(t, 1, 'bogus')).toBe(t);
    expect(setTabAt(t, 9, 'plan')).toBe(t);
  });
});
