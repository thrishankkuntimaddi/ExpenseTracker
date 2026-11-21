// ─── "Some settings were reset" note (once) ──────────────────────
// Between 4.4.0 and 4.5.0 a write made while the app was still loading could
// replace someone's settings (budgets, goals, accounts, layout) — fixed in
// 4.5.1; entries were never touched. People it likely hit get one note on
// Home: almost nothing left in their settings, yet a real history. Shown
// once (settings.wipeNote, synced, and on the device), and only until the
// end of 2026 so nobody new ever sees it.
export const WIPE_NOTE_UNTIL = '2026-12-31';
/* Settings the app writes on its own — they don't show that someone set things up */
const AUTOMATIC = new Set(['looksIntro', 'wipeNote', 'lang', 'currency']);

/** Should the note show? Only call with settings that have finished loading. */
export function wipeNoteDue(settings, entryCount, todayKey) {
  if (!settings || settings.wipeNote) return false;
  if (todayKey > WIPE_NOTE_UNTIL) return false;
  if (!(entryCount >= 20)) return false;
  const chosen = Object.keys(settings).filter((k) => !AUTOMATIC.has(k));
  return chosen.length <= 1;
}
