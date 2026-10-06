// ─── Theme helpers ───────────────────────────────────────────────
/** The active theme as set on <html data-theme> (applied before React mounts). */
export function currentTheme() {
  return typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light';
}
