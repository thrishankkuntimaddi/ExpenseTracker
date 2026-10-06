// ─── Quick-entry parsing ─────────────────────────────────────────
// Lets the user type "chai 20" or "250 swiggy" into the description field
// and press Enter: the trailing / leading number becomes the amount.

const TRAILING = /^(.*?[^\d\s₹])\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*$/i;
const LEADING  = /^(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s+(.*\S)\s*$/i;

/**
 * @returns {{ name: string, amount: number } | null}
 */
export function parseQuickEntry(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  let m = s.match(TRAILING);
  if (m) {
    const amount = Number(m[2]);
    const name = m[1].replace(/[\s-–—:]+$/, '').trim();
    if (name && amount > 0) return { name, amount };
  }
  m = s.match(LEADING);
  if (m) {
    const amount = Number(m[1]);
    const name = m[2].replace(/^[\s-–—:]+/, '').trim();
    if (name && amount > 0) return { name, amount };
  }
  return null;
}
