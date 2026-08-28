// ─── Storage Keys ───────────────────────────────────────────────
const STORAGE_KEY = 'expense_tracker_v1';
const THEME_KEY   = 'et_theme';

export function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t) return t;

    const s1 = localStorage.getItem(STORAGE_KEY);
    if (s1) {
      const p1 = JSON.parse(s1);
      if (p1?.settings?.theme) return p1.settings.theme;
    }

    const s2 = localStorage.getItem('expenseTrackerState');
    if (s2) {
      const p2 = JSON.parse(s2);
      if (p2?.settings?.theme) return p2.settings.theme;
    }
  } catch {}
  return 'light';
}

export function saveTheme(theme) {
  if (!theme) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

const defaultState = {
  transactions: [],
  income: [],
  settings: {
    theme: getSavedTheme(),
    googleSheetUrl: '',
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    const savedTheme = getSavedTheme();
    return {
      transactions: parsed.transactions || [],
      income: parsed.income || [],
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {}),
        theme: parsed?.settings?.theme || savedTheme,
      },
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state?.settings?.theme) {
      saveTheme(state.settings.theme);
    }
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(THEME_KEY);
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

