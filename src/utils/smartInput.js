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
