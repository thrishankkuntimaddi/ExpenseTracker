// ─── Languages ───────────────────────────────────────────────────
// English is the source: t('Home') returns the Hindi / Telugu / Tamil text
// when there is one, and the English otherwise — so untranslated screens
// keep working while translation grows. The choice is synced
// (settings.lang) and cached on the device (et_lang) so the first screen
// already shows it. Changing it re-mounts the app (see App.jsx).
import { hi } from './hi';
import { te } from './te';
import { ta } from './ta';

export const LANGS = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { key: 'te', label: 'Telugu', native: 'తెలుగు' },
  { key: 'ta', label: 'Tamil', native: 'தமிழ்' },
];
const DICTS = { hi, te, ta };
const KEY = 'et_lang';
const isLang = (l) => LANGS.some((x) => x.key === l);

let lang = (() => { try { const l = localStorage.getItem(KEY); return isLang(l) ? l : 'en'; } catch { return 'en'; } })();
const subs = new Set();
if (typeof document !== 'undefined') document.documentElement.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;

export const getLang = () => lang;
export function setLang(next) {
  const l = isLang(next) ? next : 'en';
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'en' ? 'en-IN' : `${l}-IN`;
  subs.forEach((f) => f(l));
}
export const onLang = (f) => { subs.add(f); return () => subs.delete(f); };

/** The text in the current language (English when there's no translation). */
export function t(text) {
  if (lang === 'en' || typeof text !== 'string') return text;
  return DICTS[lang]?.[text] ?? text;
}

/** Make these text fields of an object follow the language (getters over the English). */
export function translatable(obj, props) {
  for (const p of props) {
    const raw = obj[p];
    if (typeof raw !== 'string') continue;
    Object.defineProperty(obj, p, { get: () => t(raw), enumerable: true, configurable: true });
  }
  return obj;
}

/** How much of a dictionary is filled in (for tests and the picker). */
export const coverage = (l) => Object.keys(DICTS[l] ?? {}).length;
