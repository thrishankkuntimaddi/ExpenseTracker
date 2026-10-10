// ─── Local storage ──────────────────────────────────────────────
// Financial data is cached by Firestore's own IndexedDB persistence — see
// services/firebase.js. Per-device preferences (theme) live in utils/theme.js.

// Keys from older versions that held a full copy of the user's data.
const LEGACY_DATA_KEYS = ['expense_tracker_v1', 'expenseTrackerState'];

/* Remove legacy plaintext copies of financial data from localStorage. */
export function clearLegacyDataCache() {
  try {
    LEGACY_DATA_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
