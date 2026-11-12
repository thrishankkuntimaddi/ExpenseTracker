import { describe, it, expect, afterEach } from 'vitest';
import { t, setLang, getLang, LANGS, translatable } from '../../i18n';
import { hi } from '../../i18n/hi';
import { te } from '../../i18n/te';
import { ta } from '../../i18n/ta';
import { PAGE_META } from '../../app/pages';
import { categoryMeta } from '../categories';

afterEach(() => setLang('en'));

describe('languages', () => {
  it('every language has the same keys, none empty', () => {
    const keys = Object.keys(hi).sort();
    expect(Object.keys(te).sort()).toEqual(keys);
    expect(Object.keys(ta).sort()).toEqual(keys);
    for (const d of [hi, te, ta]) expect(Object.values(d).every((v) => typeof v === 'string' && v.trim())).toBe(true);
    expect(keys.length).toBeGreaterThan(150);
  });
  it('falls back to English', () => {
    setLang('te');
    expect(getLang()).toBe('te');
    expect(t('Home')).toBe('హోమ్');
    expect(t('A sentence nobody translated')).toBe('A sentence nobody translated');
    expect(t(null)).toBe(null);
    setLang('xx');
    expect(getLang()).toBe('en');
  });
  it('shared labels follow the language', () => {
    expect(PAGE_META.today.label).toBe('Home');
    setLang('hi');
    expect(PAGE_META.today.label).toBe('होम');
    expect(categoryMeta('food').label).toBe('खाना-पीना');
    setLang('ta');
    expect(PAGE_META.budget.title).toBe('பட்ஜெட்');
    setLang('en');
    expect(categoryMeta('food').label).toBe('Food & Dining');
  });
  it('translatable keeps the object usable', () => {
    const o = translatable({ label: 'Save', n: 1 }, ['label']);
    setLang('hi');
    expect({ ...o }).toEqual({ label: 'सहेजें', n: 1 });
    expect(LANGS.map((l) => l.key)).toEqual(['en', 'hi', 'te', 'ta']);
  });
});
