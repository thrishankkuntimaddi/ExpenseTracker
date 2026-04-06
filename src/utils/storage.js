// ─── Storage Keys ───────────────────────────────────────────────
const STORAGE_KEY = 'expense_tracker_v1';

const defaultState = {
  transactions: [],
  income: [],
  settings: {
    password: null,
    failedAttempts: 0,
    locked: false,
    theme: 'light',        // 'light' | 'monoflow'
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      transactions: parsed.transactions || [],
      income: parsed.income || [],
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
