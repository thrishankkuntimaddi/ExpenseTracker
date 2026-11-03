// ─── Stats page maths (pure) ─────────────────────────────────────
// Six months of in / saved / spent, this month against last month by
// category, the biggest spends, and the all-time "big picture".
import { localMonthKey } from './dateHelpers';
import { sumAmounts } from './finance';
import { categoryTotals, categoryMeta } from './categories';

export function shiftMonth(monthKey, n) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const inMonth = (key) => (e) => localMonthKey(e.date) === key;
const isOut = (t) => t.type === 'person' && ['lent', 'given_gift', 'repaid'].includes(t.direction ?? 'lent');

/** The `count` months ending at `monthKey`: money in, saved, spent, other money out. */
export function monthSeries(transactions = [], income = [], monthKey, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(monthKey, i - (count - 1));
    const txns = transactions.filter(inMonth(key));
    const [y, m] = key.split('-').map(Number);
    return {
      key,
      label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' }),
      in: sumAmounts(income.filter((x) => !x.isCarryForward).filter(inMonth(key))),
      saved: sumAmounts(txns.filter((t) => t.type === 'savings')),
      spent: sumAmounts(txns.filter((t) => t.type === 'expense')),
      otherOut: sumAmounts(txns.filter(isOut)),
    };
  });
}

/** Each category this month vs last month, biggest change first. */
export function compareCategories(transactions = [], monthKey, rules = {}) {
  const prevKey = shiftMonth(monthKey, -1);
  const now = categoryTotals(transactions.filter(inMonth(monthKey)), rules);
  const prev = categoryTotals(transactions.filter(inMonth(prevKey)), rules);
  const keys = new Set([...now.map((c) => c.key), ...prev.map((c) => c.key)]);
  const get = (list, k) => list.find((c) => c.key === k)?.amount ?? 0;
  const rows = [...keys].map((key) => {
    const a = get(now, key), b = get(prev, key);
    return { key, label: categoryMeta(key).label, now: a, prev: b, change: Math.round((a - b) * 100) / 100, pct: b > 0 ? Math.round(((a - b) / b) * 100) : null };
  }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  const totalNow = sumAmounts(now), totalPrev = sumAmounts(prev);
  return { rows, totalNow, totalPrev, totalPct: totalPrev > 0 ? Math.round(((totalNow - totalPrev) / totalPrev) * 100) : null, prevKey };
}

/** The biggest single expenses in the month. */
export function topSpends(transactions = [], monthKey, n = 5) {
  return transactions.filter((t) => t.type === 'expense' && inMonth(monthKey)(t))
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, n);
}
