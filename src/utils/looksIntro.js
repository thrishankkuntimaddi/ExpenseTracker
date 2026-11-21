// ─── When the "new looks" note on Home is due ────────────────────
// At most once per account (settings.looksIntro.seen, synced), never once
// it's done (they tried a look or opened Appearance from it), and never for
// someone already on Unslop / Unsloped. Used by components/LooksIntro.jsx.
export const LOOKS_INTRO_MAX = 1;

/** Should the note show, given the synced record and the current look? */
export function looksIntroDue(record, look) {
  const r = record ?? {};
  return look === 'glass' && !r.done && (Number(r.seen) || 0) < LOOKS_INTRO_MAX;
}
