// ─── Quick-entry parsing ─────────────────────────────────────────
// Lets the user type "chai 20" or "250 swiggy" into the description field
// and press Enter: the trailing / leading number becomes the amount.
// A currency written with the amount — "coffee $4.50", "taxi 30 AED",
// "€12 museum", "lunch 400rs" — is picked up too.
import { isCurrency } from './money';

/* Symbols and words that unambiguously name one currency */
const SIGNS = { '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', '$': 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP', '¥': 'JPY', '₩': 'KRW', '₫': 'VND', '₱': 'PHP', '₦': 'NGN', '₪': 'ILS', '฿': 'THB', dhs: 'AED', aed: 'AED', sar: 'SAR', kwd: 'KWD', sgd: 'SGD' };
const SIGN = '(₹|rs\\.?|\\$|€|£|¥|₩|₫|₱|₦|₪|฿|[a-z]{3})';
const NUM = '(\\d+(?:\\.\\d{1,3})?)';
// A word before the amount must stand on its own ("chai 20" is not "c" + "hai")
const TRAILING = new RegExp(`^(.*?[^\\d\\s₹$€£¥₩₫₱₦₪฿])\\s*(?:(?<![a-z])${SIGN}\\s*)?${NUM}\\s*(?:${SIGN})?\\s*$`, 'i');
const LEADING  = new RegExp(`^(?:${SIGN}\\s*)?${NUM}\\s*(?:${SIGN})?\\s+(.*\\S)\\s*$`, 'i');

function currencyFrom(word) {
  if (!word) return undefined;
  const w = word.toLowerCase();
  if (SIGNS[w]) return SIGNS[w];
  const code = word.toUpperCase();
  return word.length === 3 && isCurrency(code) ? code : null;     // null: a 3-letter word that is not a currency
}

/**
 * @returns {{ name: string, amount: number, currency?: string } | null}
 */
export function parseQuickEntry(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  let m = s.match(TRAILING);
  if (m) {
    const before = currencyFrom(m[2]), after = currencyFrom(m[4]);
    let name = m[1];
    // "bus ticket abc 20": a 3-letter word before the number that isn't a currency stays in the name
    if (before === null) name = `${name} ${m[2]}`;
    const amount = Number(m[3]);
    name = name.replace(/[\s-–—:]+$/, '').trim();
    const currency = before || after || undefined;
    if (name && amount > 0 && after !== null) return { name, amount, ...(currency ? { currency } : {}) };
  }
  m = s.match(LEADING);
  if (m) {
    const before = currencyFrom(m[1]), after = currencyFrom(m[3]);
    const amount = Number(m[2]);
    let name = m[4];
    if (after === null) name = `${m[3]} ${name}`;
    name = name.replace(/^[\s-–—:]+/, '').trim();
    const currency = before || after || undefined;
    if (name && amount > 0 && before !== null) return { name, amount, ...(currency ? { currency } : {}) };
  }
  return null;
}

/* ── Several items in one line ────────────────────────────────────
   "coffee 250 water 50 tea 150", "chai 20, samosa 30", "250 swiggy 40 auto"
   → one entry each. Commas, semicolons, "+", "&" and "and" also separate
   items. A line that can't be split cleanly is read as ONE item, so
   "5 star 20" is still "5 star" for 20. */
const SIGN_WORD = /^(₹|rs\.?|\$|€|£|¥|₩|₫|₱|₦|₪|฿|[a-z]{3})$/i;
const AMOUNT_TOKEN = /^(₹|rs\.?|\$|€|£|¥|₩|₫|₱|₦|₪|฿)?\d+(?:\.\d{1,3})?(₹|rs\.?)?$/i;

function splitRun(part) {
  const tokens = part.split(/\s+/).filter(Boolean);
  const isAmount = tokens.map((t) => AMOUNT_TOKEN.test(t));
  if (isAmount.filter(Boolean).length < 2) return null;
  // A currency word right after an amount ("30 AED") belongs to that amount
  const isCode = (i) => i > 0 && isAmount[i - 1] && SIGN_WORD.test(tokens[i]) && !!currencyFrom(tokens[i]);
  const groups = [];
  if (isAmount[0]) {
    // amount first: "250 swiggy 40 auto"
    let cur = null;
    tokens.forEach((t, i) => {
      if (isAmount[i]) { cur = [t]; groups.push(cur); } else cur.push(t);
    });
  } else {
    // name first: "coffee 250 water 50"
    let cur = [];
    for (let i = 0; i < tokens.length; i++) {
      if (isCode(i)) { groups[groups.length - 1].push(tokens[i]); continue; }
      cur.push(tokens[i]);
      if (isAmount[i]) { groups.push(cur); cur = []; }
    }
    if (cur.length) return null;            // words left over with no amount
  }
  const items = groups.map((g) => parseQuickEntry(g.join(' ')));
  return items.every(Boolean) ? items : null;
}

/**
 * Every item in a quick-entry line, in order.
 * @returns {Array<{ name: string, amount: number, currency?: string }>} empty when it doesn't parse
 */
export function parseQuickEntries(text) {
  const s = String(text ?? '').trim().replace(/(\d),(?=\d{3}\b)/g, '$1');   // 1,200 → 1200
  if (!s) return [];
  const parts = s.split(/\s*(?:[,;+&\n]|\band\b)\s*/i).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const many = splitRun(part);
    if (many) { out.push(...many); continue; }
    const one = parseQuickEntry(part);
    if (!one) { out.length = 0; break; }
    out.push(one);
  }
  if (out.length) return out;
  // Pieces that don't all parse: read the line whole ("salt & pepper 40")
  const one = parseQuickEntry(s);
  return one ? [one] : [];
}
