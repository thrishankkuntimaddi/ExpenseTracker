// ─── Balance timeline (pure) ─────────────────────────────────────
// Money in hand, day by day, since your first entry: every inflow (income,
// borrowed, paid back to you) minus every outflow (spent, saved, lent, paid
// back, given). Cash withdrawals are neutral (the money only moved), and
// spending paid out of savings doesn't leave your hand a second time.
// "With savings" adds what you've saved (less what you took out of it).
import { localDateKey } from './dateHelpers';
import { entryKind, ENTRY_KINDS } from './entryKinds';
import { toKey, fromKey } from './recurring';

export const RANGES = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 91 },
  { key: '6M', label: '6M', days: 182 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'All', days: null },
];

const paise = (n) => Math.round((Number(n) || 0) * 100);
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };

/** Per day: { cash, saved } change in paise. */
export function dailyChanges(transactions = [], income = []) {
  const days = new Map();
  const bump = (key, field, p) => {
    if (!days.has(key)) days.set(key, { cash: 0, saved: 0 });
    days.get(key)[field] += p;
  };
  transactions.forEach((t) => {
    const k = localDateKey(t.date); if (!k) return;
    const kind = entryKind(t, 'transaction');
    const p = paise(t.amount);
    if (kind === 'billing') return;   // old billing rows: only their profit counts, and that is posted as income
    if (kind === 'savings') { bump(k, 'cash', -p); bump(k, 'saved', p); return; }
    if (kind === 'expense' && t.paidFrom === 'savings') { bump(k, 'saved', -p); return; }
    const sign = ENTRY_KINDS[kind]?.sign ?? 0;
    if (sign) bump(k, 'cash', sign * p);
  });
  income.forEach((i) => {
    if (i.isCarryForward) return;
    const k = localDateKey(i.date); if (!k) return;
    bump(k, 'cash', paise(i.amount));
  });
  return days;
}

/**
 * The timeline for a range, ending today.
 * @returns {{ points: Array<{ key, value }>, start, end, change, pct, from, to }}
 *   value in rupees (cash, or cash + savings when `withSavings`)
 */
export function balanceTimeline(transactions = [], income = [], { range = '3M', withSavings = false, todayKey = toKey(new Date()) } = {}) {
  const days = dailyChanges(transactions, income);
  const keys = [...days.keys()].sort();
  if (!keys.length) return { points: [], start: 0, end: 0, change: 0, pct: null, from: todayKey, to: todayKey };
  const first = keys[0];
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];
  let from = r.days ? addDays(todayKey, -(r.days - 1)) : first;
  if (from < first) from = first;
  const last = keys[keys.length - 1] > todayKey ? keys[keys.length - 1] : todayKey;

  // Running total up to (not including) `from`
  let cash = 0, saved = 0;
  for (const k of keys) {
    if (k >= from) break;
    const d = days.get(k); cash += d.cash; saved += d.saved;
  }
  const span = Math.round((fromKey(last) - fromKey(from)) / 86400000) + 1;
  const step = span > 400 ? 7 : 1;   // long histories: a point a week
  const points = [];
  let k = from, i = 0;
  while (k <= last) {
    const d = days.get(k);
    if (d) { cash += d.cash; saved += d.saved; }
    if (i % step === 0 || k === last) points.push({ key: k, value: (cash + (withSavings ? saved : 0)) / 100 });
    k = addDays(k, 1); i += 1;
  }
  const start = points[0].value - (() => { const d = days.get(from); return d ? (d.cash + (withSavings ? d.saved : 0)) / 100 : 0; })();
  const end = points[points.length - 1].value;
  const change = Math.round((end - start) * 100) / 100;
  return { points, start, end, change, pct: Math.abs(start) >= 1 ? Math.round((change / Math.abs(start)) * 1000) / 10 : null, from, to: last };
}

/** Net change (in − out of your hand) between two day keys, inclusive. */
export function netBetween(transactions, income, fromKey_, toKey_) {
  let p = 0;
  dailyChanges(transactions, income).forEach((d, k) => { if (k >= fromKey_ && k <= toKey_) p += d.cash; });
  return p / 100;
}

/**
 * The remaining balance, day by day — exactly the app's "Balance": each
 * month starts from zero plus what came in that month (carry-forward lines
 * included, when that's on) minus what went out, so money already spent is
 * never shown as still there. Pass income WITH the carry-forward lines
 * (useStats' `income`).
 * @returns {{ points: Array<{ key, value }>, end, from, to, lastMonth: number|null }}
 *   lastMonth — the balance on the same day of the previous month (to compare)
 */
export function remainingTimeline(transactions = [], incomeWithCarry = [], { range = '3M', todayKey = toKey(new Date()) } = {}) {
  const days = new Map();
  const bump = (key, p) => days.set(key, (days.get(key) ?? 0) + p);
  dailyChanges(transactions, []).forEach((d, k) => { if (d.cash) bump(k, d.cash); });
  incomeWithCarry.forEach((i) => { const k = localDateKey(i.date); if (k) bump(k, paise(i.amount)); });
  const keys = [...days.keys()].sort();
  if (!keys.length) return { points: [], end: 0, from: todayKey, to: todayKey, lastMonth: null };
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];
  // Start on the first of a month, so every month's line starts where the app's does
  let from = r.days ? addDays(todayKey, -(r.days - 1)) : keys[0];
  if (from < keys[0]) from = keys[0];
  const monthStart = `${from.slice(0, 7)}-01`;
  const to = todayKey;
  const values = new Map();
  let k = monthStart, run = 0;
  while (k <= to) {
    if (k.endsWith('-01')) run = 0;   // a new month: its balance starts afresh
    run += days.get(k) ?? 0;
    values.set(k, run / 100);
    k = addDays(k, 1);
  }
  const all = [...values.entries()].filter(([key]) => key >= from).map(([key, value]) => ({ key, value }));
  const step = all.length > 400 ? 7 : 1;
  const points = all.filter((p, i) => i % step === 0 || i === all.length - 1);
  // Same day last month (or its last day, if shorter)
  const [y, m, d] = todayKey.split('-').map(Number);
  const prevLast = new Date(y, m - 1, 0).getDate();
  const prevKey = toKey(new Date(y, m - 2, Math.min(d, prevLast)));
  let lastMonth = values.get(prevKey);
  if (lastMonth == null) {
    // outside the range: work it out from that month's own entries
    let p = 0;
    days.forEach((v, key) => { if (key.slice(0, 7) === prevKey.slice(0, 7) && key <= prevKey) p += v; });
    lastMonth = keys[0] <= prevKey ? p / 100 : null;
  }
  return { points, end: values.get(to) ?? 0, from, to, lastMonth };
}
