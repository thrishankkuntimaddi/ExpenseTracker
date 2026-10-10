// ─── Theme ───────────────────────────────────────────────────────
// Light / Dark / System, chosen per device (never synced). The choice
// resolves to <html data-theme="light" | "monoflow"> — "monoflow" is the
// app's dark theme. index.html applies the same logic before first paint.
import { useState, useEffect, useCallback } from 'react';

export const THEME_PREF_KEY = 'et_theme_pref';   // 'light' | 'dark' | 'system'
const RESOLVED_KEY = 'et_theme';                  // last applied data-theme (read by index.html)

/* Browser-bar colour per theme — matches glass.css --backdrop-base. */
const BAR_COLOR = { light: '#E4E5EA', monoflow: '#040405' };

/** The active theme as set on <html data-theme>. */
export function currentTheme() {
  return typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light';
}

const systemPrefersDark = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** 'light' | 'dark' | 'system' → data-theme value. */
export function resolveTheme(pref, prefersDark = systemPrefersDark()) {
  if (pref === 'dark') return 'monoflow';
  if (pref === 'light') return 'light';
  return prefersDark ? 'monoflow' : 'light';
}

/**
 * The saved preference. Devices that predate the setting keep what they
 * had (the old synced theme cached in et_theme); new devices follow the system.
 */
export function getThemePref() {
  try {
    const pref = localStorage.getItem(THEME_PREF_KEY);
    if (pref === 'light' || pref === 'dark' || pref === 'system') return pref;
    const legacy = localStorage.getItem(RESOLVED_KEY);
    if (legacy === 'monoflow') return 'dark';
    if (legacy === 'light') return 'light';
  } catch { /* storage unavailable */ }
  return 'system';
}

/* Whether this device had stored any theme before this page load. If not,
   the account's old synced theme (settings.theme) is adopted once. */
export const HAD_LOCAL_THEME_CHOICE = (() => {
  try { return !!(localStorage.getItem(THEME_PREF_KEY) || localStorage.getItem(RESOLVED_KEY)); }
  catch { return true; }
})();

let switchTimer = null;
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  // Fade colours only when the theme really changes (not on first paint)
  if (html.getAttribute('data-theme') && html.getAttribute('data-theme') !== theme) {
    html.classList.add('theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => html.classList.remove('theme-switching'), 320);
  }
  html.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme] ?? BAR_COLOR.light);
  try { localStorage.setItem(RESOLVED_KEY, theme); } catch { /* storage unavailable */ }
}

/**
 * React state for the theme: { pref, theme, setPref }.
 * Follows OS changes while on 'system', and other open windows' choices.
 */
export function useTheme() {
  const [pref, setPrefState] = useState(getThemePref);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const theme = resolveTheme(pref, prefersDark);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onScheme = (e) => setPrefersDark(e.matches);
    mq?.addEventListener?.('change', onScheme);
    const onStorage = (e) => { if (e.key === THEME_PREF_KEY) setPrefState(getThemePref()); };
    window.addEventListener('storage', onStorage);
    return () => { mq?.removeEventListener?.('change', onScheme); window.removeEventListener('storage', onStorage); };
  }, []);

  const setPref = useCallback((next) => {
    try { localStorage.setItem(THEME_PREF_KEY, next); } catch { /* storage unavailable */ }
    setPrefState(next);
  }, []);

  return { pref, theme, setPref };
}
