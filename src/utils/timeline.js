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
