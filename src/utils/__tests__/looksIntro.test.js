import { describe, it, expect } from 'vitest';
import { looksIntroDue, LOOKS_INTRO_MAX } from '../looksIntro';

describe('"New looks" note — at most once per account', () => {
  it('shows to someone on Glass who has not seen it', () => {
    expect(looksIntroDue(undefined, 'glass')).toBe(true);
  });
  it('stops after one app open', () => {
    expect(LOOKS_INTRO_MAX).toBe(1);
    expect(looksIntroDue({ seen: 1 }, 'glass')).toBe(false);
    expect(looksIntroDue({ seen: 7 }, 'glass')).toBe(false);
  });
  it('never again once they tried a look or opened Appearance from it', () => {
    expect(looksIntroDue({ seen: 0, done: true }, 'glass')).toBe(false);
  });
  it('never for someone already on Unslop or Unsloped', () => {
    expect(looksIntroDue(undefined, 'unslop')).toBe(false);
    expect(looksIntroDue(undefined, 'unsloped')).toBe(false);
  });
});
