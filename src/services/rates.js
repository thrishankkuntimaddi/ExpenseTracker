// ─── Exchange rates ──────────────────────────────────────────────
// Rates are "units of a currency per 1 US dollar" for a calendar day.
// Two free, key-less sources:
//   • fawazahmed0/exchange-api (jsDelivr, mirrored on Cloudflare Pages):
//     every currency, one file per day, from 2024-03-02
//   • Frankfurter (European Central Bank): ~30 major currencies, any date
//     since 1999, and a whole date range in ONE request
// Past rates never change, so every day fetched is kept on this device and
// never fetched again. Nothing here blocks the UI: lookups are synchronous
// against what is cached, fall back to the nearest day, then today's rate,
// then the table bundled below — and the app re-renders when better rates land.
import { useSyncExternalStore } from 'react';
import { CURRENCY_CODES } from '../utils/money';

const CACHE_KEY = 'et_fx_v1';
const FAWAZ_START = '2024-03-02';
const LATEST_TTL = 6 * 3600 * 1000;
const NEAR_DAYS = 10;                         // weekends/holidays: use a rate this close

/* ECB publishes these; Frankfurter serves them for any range in one call. */
const ECB = new Set(['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR']);
/* Fixed to the dollar (or the rupee) for decades: exact on any day. */
export const PEGGED = { USD: 1, AED: 3.6725, SAR: 3.75, QAR: 3.64, OMR: 0.3845, BHD: 0.376, JOD: 0.709, HKD: 7.8 };

/* Last resort, so a conversion is never impossible (offline on first run).
   Snapshot of 2026-10-13; replaced by live data as soon as the app is online. */
export const BUNDLED = { date: '2026-10-13', rates: {"INR":95.2337,"USD":1,"EUR":0.894845,"GBP":0.756329,"AED":3.6725,"SGD":1.28064,"CAD":1.42699,"AUD":1.43646,"SAR":3.75,"QAR":3.64,"KWD":0.311532,"OMR":0.385028,"BHD":0.376,"JOD":0.709,"ILS":3.08157,"TRY":49.3689,"EGP":52.6722,"CNY":6.69576,"HKD":7.84773,"TWD":32.1318,"JPY":158.303,"KRW":1345.24,"VND":25912.2,"THB":33.571,"MYR":4.08686,"IDR":17926,"PHP":62.8283,"PKR":277.338,"BDT":123.482,"LKR":330.94,"NPR":152.445,"CHF":0.833046,"SEK":10.0226,"NOK":9.57201,"DKK":6.68911,"PLN":3.92539,"CZK":21.8086,"HUF":326.514,"RON":4.7735,"NZD":1.78751,"MXN":18.2563,"BRL":4.98722,"ARS":1516.7,"CLP":977.036,"COP":3196.24,"ZAR":16.5173,"NGN":1328.09,"KES":129.738} };

/* ── Cache ─────────────────────────────────────────────────────── */
// { days: { 'YYYY-MM-DD': { INR: 83.1, … } }, latest: { date, rates, at } }
let cache = load();
let version = 0;
const subs = new Set();
const index = new Map();                      // code → sorted days that have it

function load() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && typeof c.days === 'object') return c;
  } catch { /* storage unavailable or corrupt */ }
  return { days: {}, latest: null };
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full or unavailable: memory only */ }
  }, 400);
}
function changed() {
  index.clear();
  version++;
  save();
  subs.forEach((fn) => fn());
}

const pick = (rates) => {
  const out = {};
  CURRENCY_CODES.forEach((c) => { const v = Number(rates?.[c] ?? rates?.[c.toLowerCase()]); if (v > 0 && isFinite(v)) out[c] = v; });
  return out;
};
function mergeDay(day, rates) {
  const r = pick(rates);
  if (!Object.keys(r).length) return;
  cache.days[day] = { ...(cache.days[day] ?? {}), ...r };
}

/** Re-render when rates arrive: const v = useRatesVersion(). */
export const subscribeRates = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const getRatesVersion = () => version;
export const useRatesVersion = () => useSyncExternalStore(subscribeRates, getRatesVersion, getRatesVersion);

/* ── Lookup (synchronous) ─────────────────────────────────────── */
function daysWith(code) {
  let list = index.get(code);
  if (!list) {
    list = Object.keys(cache.days).filter((d) => cache.days[d][code] > 0).sort();
    index.set(code, list);
  }
  return list;
}
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/** The latest rates we know: { date, rates }. */
export function latestRates() {
  return cache.latest?.rates ? cache.latest : BUNDLED;
}

/**
 * Units of `code` per US dollar on `day` ('YYYY-MM-DD'; omit for today).
 * Returns { rate, day, exact } — `day` is the day the rate is really from.
 */
export function perUsd(code, day) {
  if (code === 'USD') return { rate: 1, day: day ?? latestRates().date, exact: true };
  const latest = latestRates();
  if (!day || day >= latest.date) {
    if (latest.rates[code]) return { rate: latest.rates[code], day: latest.date, exact: true };
  } else {
    if (cache.days[day]?.[code]) return { rate: cache.days[day][code], day, exact: true };
    if (code in PEGGED && code !== 'HKD') return { rate: PEGGED[code], day, exact: true };
    // Nearest cached day (binary search), preferring earlier on a tie
    const list = daysWith(code);
    if (list.length) {
      let lo = 0, hi = list.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] < day) lo = mid + 1; else hi = mid; }
      const cands = [list[lo - 1], list[lo]].filter(Boolean).sort((a, b) => dayDiff(a, day) - dayDiff(b, day));
      const best = cands[0];
      if (best && dayDiff(best, day) <= NEAR_DAYS) return { rate: cache.days[best][code], day: best, exact: true };
      if (best) return { rate: cache.days[best][code], day: best, exact: false };
    }
  }
  if (latest.rates[code]) return { rate: latest.rates[code], day: latest.date, exact: false };
  const b = BUNDLED.rates[code] ?? PEGGED[code];
  return b ? { rate: b, day: BUNDLED.date, exact: false } : null;
}

/** How many `to` one `from` buys on `day` (omit day for today). null if unknown. */
export function rateBetween(from, to, day) {
  if (from === to) return 1;
  const a = perUsd(from, day), b = perUsd(to, day);
  return a && b ? b.rate / a.rate : null;
}

/** Was the rate for this day really known (not a stand-in)? */
export function rateIsExact(from, to, day) {
  if (from === to) return true;
  return !!(perUsd(from, day)?.exact && perUsd(to, day)?.exact);
}

/* ── Fetching ─────────────────────────────────────────────────── */
async function getJson(urls, ms = 8000) {
  for (const url of urls) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
    } catch { /* try the next mirror */ }
  }
  return null;
}
const fawazUrls = (tag) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/usd.min.json`,
  `https://${tag}.currency-api.pages.dev/v1/currencies/usd.min.json`,
];

let latestPromise = null;
/** Today's rates (refreshed every few hours). Resolves true if they changed. */
export function refreshLatest({ force = false } = {}) {
  if (!force && cache.latest?.at && Date.now() - cache.latest.at < LATEST_TTL) return Promise.resolve(false);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
  latestPromise ??= (async () => {
    const j = await getJson(fawazUrls('latest'));
    let rates = j?.usd && pick(j.usd), date = j?.date;
    if (!rates || !Object.keys(rates).length) {
      const f = await getJson(['https://api.frankfurter.dev/v1/latest?base=USD']);
      if (f?.rates) { rates = { ...latestRates().rates, ...pick(f.rates), USD: 1 }; date = f.date; }
    }
    if (!rates) return false;
    rates.USD = 1;
    cache.latest = { date: date ?? new Date().toISOString().slice(0, 10), rates, at: Date.now() };
    mergeDay(cache.latest.date, rates);
    changed();
    return true;
  })().finally(() => { latestPromise = null; });
  return latestPromise;
}

const inFlight = new Set();
const weekStart = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * Make sure rates for these days and currencies are cached.
 *  • currencies the ECB publishes: one Frankfurter request per year spanned
 *  • the rest (AED is pegged; KWD, VND, TWD, PKR …): one small file per day for
 *    the last 60 days, per week before that — at most a few dozen requests,
 *    once ever per day
 */
export async function ensureRates(days, codes) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const latestDay = latestRates().date;
  const want = [...new Set(codes)].filter((c) => c !== 'USD' && CURRENCY_CODES.includes(c) && !(c in PEGGED && c !== 'HKD'));
  if (!want.length) return false;
  const past = [...new Set(days)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < latestDay).sort();
  const missing = (code) => past.filter((d) => !(cache.days[d]?.[code] > 0) && !daysWith(code).some((x) => dayDiff(x, d) <= 3));
  let got = false;

  // 1) ECB currencies: whole ranges at once
  const ecb = want.filter((c) => ECB.has(c));
  const ecbMissing = [...new Set(ecb.flatMap(missing))].sort();
  for (const year of [...new Set(ecbMissing.map((d) => d.slice(0, 4)))]) {
    const inYear = ecbMissing.filter((d) => d.startsWith(year));
    const key = `ecb:${year}:${ecb.join(',')}`;
    if (inFlight.has(key)) continue;
    inFlight.add(key);
    const from = inYear[0], to = inYear[inYear.length - 1];
    const syms = ecb.filter((c) => c !== 'USD').join(',');
    const j = await getJson([`https://api.frankfurter.dev/v1/${from}..${to}?base=USD&symbols=${syms}`], 15000);
    inFlight.delete(key);
    if (j?.rates) { Object.entries(j.rates).forEach(([d, r]) => mergeDay(d, { ...r, USD: 1 })); got = true; }
  }

  // 2) Everything else, day by day (recent) or week by week (older)
  const other = want.filter((c) => !ECB.has(c));
  if (other.length) {
    const recentCut = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const tags = [...new Set(other.flatMap(missing).map((d) => (d < recentCut ? weekStart(d) : d)))]
      .map((d) => (d < FAWAZ_START ? FAWAZ_START : d))
      .filter((d) => !cache.days[d] || other.some((c) => !cache.days[d][c]))
      .filter((d) => !inFlight.has(`fz:${d}`))
      .slice(-120);
    const queue = [...new Set(tags)];
    const worker = async () => {
      while (queue.length) {
        const d = queue.pop();
        inFlight.add(`fz:${d}`);
        const j = await getJson(fawazUrls(d));
        inFlight.delete(`fz:${d}`);
        if (j?.usd) { mergeDay(d, j.usd); got = true; }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }
  if (got) changed();
  return got;
}

/** For tests: replace the cache. */
export function __setRatesCache(next) { cache = next ?? { days: {}, latest: null }; changed(); }
