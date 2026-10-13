// ─── App ready ───────────────────────────────────────────────────
// The launch splash stays up until the first real screen can show — the
// sign-in screen, or your data — so there is one intro, never a second
// loading screen after it. main.jsx waits for this (with a time limit).
export function markAppReady() {
  if (typeof window === 'undefined' || window.__etReady) return;
  window.__etReady = true;
  window.dispatchEvent(new Event('et:ready'));
}
