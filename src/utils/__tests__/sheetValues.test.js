import { describe, it, expect } from 'vitest';
import { evalAmount, parseDateText } from '../sheetValues';

describe('Sheet amounts', () => {
  it('numbers and sums', () => {
    expect(evalAmount('250')).toBe(250);
    expect(evalAmount('1,200')).toBe(1200);
    expect(evalAmount('₹ 99.5')).toBe(99.5);
    expect(evalAmount('120+80')).toBe(200);
    expect(evalAmount('2*3+1')).toBe(7);
    expect(evalAmount('1000/4-50')).toBe(200);
  });
  it('rejects what is not a sum', () => {
    for (const t of ['', 'abc', '5-', '+5', '5++5', '.', '12a']) expect(evalAmount(t), t).toBeNaN();
  });
});

describe('Sheet dates', () => {
  it('reads common spreadsheet date formats', () => {
    expect(parseDateText('14/10/2026')).toBe('2026-10-14');
    expect(parseDateText('2026-10-4')).toBe('2026-10-04');
    expect(parseDateText('4-10-26')).toBe('2026-10-04');
    expect(parseDateText('Oct 4')).toBe('');
  });
});
