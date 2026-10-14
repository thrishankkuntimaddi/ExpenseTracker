// ─── Money: currencies and formatting ────────────────────────────
// Every entry keeps the currency it was entered in (entry.currency; entries
// from before multi-currency have none and are rupees). The app shows totals
// in ONE display currency — settings.currency — set here once at start-up so
// every formatAmount() in the app follows it.
export const LEGACY_CURRENCY = 'INR';
export const DEFAULT_CURRENCY = 'INR';

/* Popular currencies, grouped for the picker. Names are plain English;
   symbols come from Intl so they match how amounts are printed. */
export const CURRENCY_GROUPS = [
  { title: 'Popular', codes: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD'] },
  { title: 'Gulf & Middle East', codes: ['SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'JOD', 'ILS', 'TRY', 'EGP'] },
  { title: 'Asia', codes: ['CNY', 'HKD', 'TWD', 'JPY', 'KRW', 'VND', 'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'LKR', 'NPR'] },
  { title: 'Europe', codes: ['CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON'] },
  { title: 'Americas, Africa & Oceania', codes: ['NZD', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'ZAR', 'NGN', 'KES'] },
];

export const CURRENCY_NAMES = {
  INR: 'Indian rupee', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', AED: 'UAE dirham',
  SGD: 'Singapore dollar', CAD: 'Canadian dollar', AUD: 'Australian dollar',
  SAR: 'Saudi riyal', QAR: 'Qatari riyal', KWD: 'Kuwaiti dinar', OMR: 'Omani rial', BHD: 'Bahraini dinar',
  JOD: 'Jordanian dinar', ILS: 'Israeli shekel', TRY: 'Turkish lira', EGP: 'Egyptian pound',
  CNY: 'Chinese yuan', HKD: 'Hong Kong dollar', TWD: 'Taiwan dollar', JPY: 'Japanese yen', KRW: 'South Korean won',
  VND: 'Vietnamese dong', THB: 'Thai baht', MYR: 'Malaysian ringgit', IDR: 'Indonesian rupiah', PHP: 'Philippine peso',
  PKR: 'Pakistani rupee', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee', NPR: 'Nepalese rupee',
  CHF: 'Swiss franc', SEK: 'Swedish krona', NOK: 'Norwegian krone', DKK: 'Danish krone', PLN: 'Polish złoty',
  CZK: 'Czech koruna', HUF: 'Hungarian forint', RON: 'Romanian leu',
  NZD: 'New Zealand dollar', MXN: 'Mexican peso', BRL: 'Brazilian real', ARS: 'Argentine peso', CLP: 'Chilean peso',
  COP: 'Colombian peso', ZAR: 'South African rand', NGN: 'Nigerian naira', KES: 'Kenyan shilling',
};
export const CURRENCY_CODES = CURRENCY_GROUPS.flatMap((g) => g.codes);
export const isCurrency = (code) => typeof code === 'string' && code in CURRENCY_NAMES;

/** The currency an entry was recorded in. */
export const currencyOf = (entry) => (isCurrency(entry?.currency) ? entry.currency : LEGACY_CURRENCY);

/* Indian grouping (1,00,000) for rupees; everything else in the reader's locale style. */
const LOCALE = { INR: 'en-IN', NPR: 'en-IN', PKR: 'en-IN', BDT: 'en-IN', LKR: 'en-IN' };
const localeFor = (code) => LOCALE[code] ?? 'en-US';

let display = DEFAULT_CURRENCY;
const listeners = new Set();
/** Set by the app from settings.currency; every formatter follows it. */
export function setDisplayCurrency(code) {
  const next = isCurrency(code) ? code : DEFAULT_CURRENCY;
  if (next === display) return;
  display = next;
  listeners.forEach((fn) => fn(next));
}
export const getDisplayCurrency = () => display;
export const onDisplayCurrency = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* The display currency prints with its short symbol ($, ₹); any other
   currency with an unambiguous one (US$ vs CA$ vs S$ …) so a list that mixes
   them can be read at a glance. */
const fmtCache = new Map();
function formatter(code, opts) {
  let style = code === display ? 'narrowSymbol' : 'symbol';
  // Still clashes with the display currency's symbol ($ for USD next to CAD): use the code
  if (style === 'symbol' && symbolOf(code, 'symbol') === symbolOf(display, 'narrowSymbol')) style = 'code';
  const key = `${code}|${style}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(localeFor(code), { style: 'currency', currency: code, currencyDisplay: style, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

function symbolOf(code, style) {
  return new Intl.NumberFormat(localeFor(code), { style: 'currency', currency: code, currencyDisplay: style })
    .formatToParts(0).find((p) => p.type === 'currency')?.value;
}

/** "₹1,250.50", "$12.40", "AED 30.00", "¥1,200" — the currency's own decimals. */
export function formatMoney(n, code = display) {
  return formatter(isCurrency(code) ? code : display, {}).format(Number(n) || 0);
}

/** Whole units, no decimals: "₹1,250", "$12" — for tiles and charts. */
export function formatMoneyCompact(n, code = display) {
  return formatter(isCurrency(code) ? code : display, { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
}

/** "₹", "$", "€", "AED" … as printed by formatMoney. */
export function currencySymbol(code = display) {
  if (!isCurrency(code)) code = display;
  return formatter(code, { maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
}

/** How many decimals a currency uses (JPY 0, INR 2, KWD 3). */
export const currencyDecimals = (code = display) => formatter(isCurrency(code) ? code : display, {}).resolvedOptions().maximumFractionDigits;

/**
 * An entry's amount as it was paid — "$10.00 · ≈₹830.00" for an entry in
 * another currency (a view from utils/fx.js), plain "₹830.00" otherwise.
 */
export function formatEntryAmount(entry, n = entry?.amount) {
  const o = entry?.orig;
  if (!o || o.currency === display || typeof o.amount !== 'number') return formatMoney(n, isCurrency(entry?.currency) && !o ? entry.currency : display);
  const share = entry.amount ? n / entry.amount : 1;
  return `${formatMoney(o.amount * share, o.currency)} · ≈${formatMoney(n, display)}`;
}

/* The currency this device enters new amounts in. Sticky, so when you travel
   you switch it once; back home it follows the display currency again. */
const ENTRY_CURRENCY_KEY = 'et_entry_currency';
export const entryCurrency = {
  get() {
    try { const c = localStorage.getItem(ENTRY_CURRENCY_KEY); if (isCurrency(c)) return c; } catch { /* storage unavailable */ }
    return display;
  },
  set(code) {
    try { if (code === display || !isCurrency(code)) localStorage.removeItem(ENTRY_CURRENCY_KEY); else localStorage.setItem(ENTRY_CURRENCY_KEY, code); } catch { /* storage unavailable */ }
  },
};
