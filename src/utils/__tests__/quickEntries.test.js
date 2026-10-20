import { describe, it, expect } from 'vitest';
import { parseQuickEntries } from '../smartInput';

const read = (s) => parseQuickEntries(s).map((e) => `${e.name}=${e.amount}${e.currency ? ` ${e.currency}` : ''}`);

describe('parseQuickEntries — several items in one line', () => {
  it('splits name-then-amount runs', () => {
    expect(read('coffee 250 water 50 tea 150')).toEqual(['coffee=250', 'water=50', 'tea=150']);
    expect(read('auto rickshaw 80 bus pass 400')).toEqual(['auto rickshaw=80', 'bus pass=400']);
  });

  it('splits amount-then-name runs', () => {
    expect(read('250 swiggy 40 auto')).toEqual(['swiggy=250', 'auto=40']);
  });

  it('splits on commas, plus, ampersand and "and"', () => {
    expect(read('chai 20, samosa 30')).toEqual(['chai=20', 'samosa=30']);
    expect(read('chai 20 + vada 15')).toEqual(['chai=20', 'vada=15']);
    expect(read('milk 30 and bread 40')).toEqual(['milk=30', 'bread=40']);
  });

  it('keeps currencies with their own item', () => {
    expect(read('coffee $4.50 taxi 30 AED')).toEqual(['coffee=4.5 USD', 'taxi=30 AED']);
    expect(read('lunch 400rs dinner 300rs')).toEqual(['lunch=400 INR', 'dinner=300 INR']);
  });

  it('reads thousands separators as one amount', () => {
    expect(read('iphone case 1,200 charger 800')).toEqual(['iphone case=1200', 'charger=800']);
  });

  it('still reads a single item exactly as before', () => {
    expect(read('chai 20')).toEqual(['chai=20']);
    expect(read('250 swiggy')).toEqual(['swiggy=250']);
    expect(read('bus ticket abc 20')).toEqual(['bus ticket abc=20']);
    expect(read('5 star 20')).toEqual(['5 star=20']);
    expect(read('salt & pepper 40')).toEqual(['salt & pepper=40']);
  });

  it('returns nothing when there is no amount, or words are left over', () => {
    expect(read('petrol')).toEqual([]);
    expect(read('')).toEqual([]);
    expect(read('coffee 250 water')).toEqual([]);
  });
});
