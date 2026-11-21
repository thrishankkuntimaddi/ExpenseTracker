import { describe, it, expect } from 'vitest';
import { wipeNoteDue } from '../wipeNote';

const DAY = '2026-11-22';
describe('"Some settings were reset" note', () => {
  it('shows when almost nothing is left but there is a real history', () => {
    expect(wipeNoteDue({ looksIntro: { seen: 1 } }, 300, DAY)).toBe(true);
    expect(wipeNoteDue({}, 25, DAY)).toBe(true);
    expect(wipeNoteDue({ looksIntro: {}, lang: 'te', ui: {} }, 25, DAY)).toBe(true);   // one chosen key
  });
  it('not for people whose settings are there, or who barely started', () => {
    expect(wipeNoteDue({ budgets: {}, goals: [], ui: {} }, 300, DAY)).toBe(false);
    expect(wipeNoteDue({}, 5, DAY)).toBe(false);
  });
  it('once, and never after 2026', () => {
    expect(wipeNoteDue({ wipeNote: { done: true } }, 300, DAY)).toBe(false);
    expect(wipeNoteDue({}, 300, '2027-01-01')).toBe(false);
    expect(wipeNoteDue(null, 300, DAY)).toBe(false);
  });
});
