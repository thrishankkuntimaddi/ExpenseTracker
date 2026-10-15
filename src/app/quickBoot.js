// ─── Quick boot ──────────────────────────────────────────────────
// When the app restarts itself (an update switching in, a stale screen
// reloading) the intro animation must not play again — it looks like the
// app is stuck in a loop. Mark the restart; the next boot skips the intro.
const KEY = 'et_quick_boot';
const WINDOW_MS = 60 * 1000;

export function markQuickBoot() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
}

/** True once, for a boot that follows a self-restart in the last minute. */
export function takeQuickBoot(now = Date.now()) {
  try {
    const at = Number(localStorage.getItem(KEY)) || 0;
    localStorage.removeItem(KEY);
    return at > 0 && now - at < WINDOW_MS;
  } catch { return false; }
}
