import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTheme, getThemePref, THEME_PREF_KEY } from '../theme';

// Minimal localStorage for the node test environment
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

describe('resolveTheme', () => {
  it('maps the choice to the data-theme value', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('monoflow');
    expect(resolveTheme('system', true)).toBe('monoflow');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('getThemePref', () => {
  beforeEach(() => store.clear());
  it('new devices follow the system', () => {
    expect(getThemePref()).toBe('system');
  });
  it('keeps what an existing device had (old synced theme cache)', () => {
    store.set('et_theme', 'monoflow');
    expect(getThemePref()).toBe('dark');
    store.set('et_theme', 'light');
    expect(getThemePref()).toBe('light');
  });
  it('an explicit choice wins, junk is ignored', () => {
    store.set('et_theme', 'monoflow');
    store.set(THEME_PREF_KEY, 'system');
    expect(getThemePref()).toBe('system');
    store.set(THEME_PREF_KEY, 'purple');
    expect(getThemePref()).toBe('dark');
  });
});
