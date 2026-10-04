// ─── Local storage ──────────────────────────────────────────────
// Only per-device UI preferences live here (the theme). Financial data is
// cached by Firestore's own IndexedDB persistence — see services/firebase.js.
const THEME_KEY = 'et_theme';

// Keys from older versions that held a full copy of the user's data.
const LEGACY_DATA_KEYS = ['expense_tracker_v1', 'expenseTrackerState'];

export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme) {
  if (!theme) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* storage unavailable (private mode) — theme just won't persist */ }
}

/* Remove legacy plaintext copies of financial data from localStorage. */
export function clearLegacyDataCache() {
  try {
    LEGACY_DATA_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
