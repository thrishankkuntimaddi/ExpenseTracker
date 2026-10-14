// ─── Monthly report ──────────────────────────────────────────────
// Instead of insights that change every time you look, one report a month
// on the day you choose (settings.report.day, 1–28).
//
// Which days a report covers — "salary to salary":
//   start  the day your main income arrived in the month before the report
//          (the largest income entry that month); if there was none, the
//          same day-of-month one month earlier
//   end    the report day — or, if this month's main income already arrived
//          before it, that day (so no day is ever counted in two reports)
// e.g. report on 4 Nov, salary on 5 Oct → 5 Oct – 3 Nov.
//
// Everything is derived from the ledger; nothing is stored.
import { localDateKey } from './dateHelpers';
import { incomeKind } from './finance';
import { categoryOf, categoryMeta } from './categories';
import { occurrencesBetween, occurrenceId, toKey, fromKey } from './recurring';
import { isBill } from './bills';

export const DEFAULT_REPORT = { day: 1 };
export const getReportSettings = (settings) => {
  const day = Math.round(Number(settings?.report?.day));
  return { ...DEFAULT_REPORT, ...(settings?.report ?? {}), day: day >= 1 && day <= 28 ? day : DEFAULT_REPORT.day };
};

const pad2 = (n) => String(n).padStart(2, '0');
const dateIn = (y, m0, day) => { const d = new Date(y, m0, 1); return toKey(new Date(d.getFullYear(), d.getMonth(), Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))); };
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const monthOf = (key) => key.slice(0, 7);
const prevMonth = (mk) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };

/** The latest report day on or before `todayKey` (YYYY-MM-DD). */
export function latestReportDay(day, todayKey) {
  const t = fromKey(todayKey);
  const thisMonth = dateIn(t.getFullYear(), t.getMonth(), day);
  return thisMonth <= todayKey ? thisMonth : dateIn(t.getFullYear(), t.getMonth() - 1, day);
}
/** The report day `n` months before `reportKey`. */
export function shiftReportDay(reportKey, day, n) {
  const d = fromKey(reportKey);
  return dateIn(d.getFullYear(), d.getMonth() + n, day);
}

/** The main income day in a month: the largest real-income entry (earliest on a tie). */
function payday(income, monthKey) {
  let best = null;
  income.forEach((i) => {
    if (i.isCarryForward || incomeKind(i) !== 'income') return;
    const k = localDateKey(i.date);
    if (!k || monthOf(k) !== monthKey) return;
    const a = Number(i.amount) || 0;
    if (!best || a > best.amount || (a === best.amount && k < best.key)) best = { key: k, amount: a };
  });
  return best?.key ?? null;
}

/** [start, end) of the report published on `reportKey`. */
export function reportWindow(reportKey, income = []) {
  const reportMonth = monthOf(reportKey);
  const start = payday(income, prevMonth(reportMonth)) ?? shiftReportDay(reportKey, Number(reportKey.slice(8)), -1);
  const nextPay = payday(income, reportMonth);
  const end = nextPay && nextPay < reportKey && nextPay > start ? nextPay : reportKey;
  return { start, end, last: addDays(end, -1), days: Math.round((fromKey(end) - fromKey(start)) / 86400000) };
}

/* ── Analysis ─────────────────────────────────────────────────────
   Essentials are what you'd pay anyway; lifestyle is what you choose. */
export const ESSENTIALS = new Set(['groceries', 'rent', 'bills', 'fuel', 'transport', 'health', 'education', 'family']);
export const LIFESTYLE = new Set(['food', 'shopping', 'entertainment', 'subscriptions', 'travel', 'personal', 'gifts']);
const SMALL = 100;   // "small spends": under ₹100 each

const nameKey = (n) => String(n ?? '').trim().toLowerCase();

/** Patterns in one report's spending. `expenses` are already inside the window. */
export function analyseSpending(expenses, { start, days }, rules = {}) {
  const amt = (t) => Number(t.amount) || 0;
  const total = expenses.reduce((s, t) => s + amt(t), 0);
  // Essentials vs lifestyle
  const split = { essentials: 0, lifestyle: 0, other: 0 };
  expenses.forEach((t) => {
    const c = categoryOf(t, rules) ?? 'other';
    split[ESSENTIALS.has(c) ? 'essentials' : LIFESTYLE.has(c) ? 'lifestyle' : 'other'] += amt(t);
  });
  // Week by week (week 1 = the first seven days of the window)
  const weeks = Array.from({ length: Math.max(1, Math.ceil(days / 7)) }, (_, i) => ({ week: i + 1, from: addDays(start, i * 7), amount: 0 }));
  const startMs = fromKey(start).getTime();
  expenses.forEach((t) => {
    const k = localDateKey(t.date); if (!k) return;
    const i = Math.floor(Math.round((fromKey(k).getTime() - startMs) / 86400000) / 7);
    if (weeks[i]) weeks[i].amount += amt(t);
  });
  // Weekends vs weekdays: average per day of each kind
  let weekendDays = 0;
  for (let i = 0; i < days; i++) { const d = fromKey(addDays(start, i)).getDay(); if (d === 0 || d === 6) weekendDays++; }
  let weekendSpent = 0;
  expenses.forEach((t) => { const k = localDateKey(t.date); if (!k) return; const d = fromKey(k).getDay(); if (d === 0 || d === 6) weekendSpent += amt(t); });
  const weekend = weekendDays ? weekendSpent / weekendDays : 0;
  const weekday = days - weekendDays ? (total - weekendSpent) / (days - weekendDays) : 0;
  // What you buy most often (by name), and small spends
  const byName = {};
  expenses.forEach((t) => { const k = nameKey(t.name); if (!k) return; (byName[k] ??= { name: String(t.name).trim(), count: 0, amount: 0 }); byName[k].count++; byName[k].amount += amt(t); });
  const frequent = Object.values(byName).filter((x) => x.count >= 3).sort((a, b) => b.count - a.count || b.amount - a.amount)[0] ?? null;
  const smalls = expenses.filter((t) => amt(t) > 0 && amt(t) < SMALL);
  // How concentrated: the top three categories' share
  const byCat = {};
  expenses.forEach((t) => { const c = categoryOf(t, rules) ?? 'other'; byCat[c] = (byCat[c] ?? 0) + amt(t); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([key, amount]) => ({ key, label: categoryMeta(key)?.label ?? key, amount: Math.round(amount), share: total ? Math.round((amount / total) * 100) : 0 }));
  const r = (n) => Math.round(n);
  return {
    split: { essentials: r(split.essentials), lifestyle: r(split.lifestyle), other: r(split.other) },
    weeks: weeks.map((w) => ({ ...w, amount: r(w.amount) })),
    weekend: r(weekend), weekday: r(weekday),
    frequent: frequent && { ...frequent, amount: r(frequent.amount) },
    small: { count: smalls.length, amount: r(smalls.reduce((s, t) => s + amt(t), 0)) },
    top, topShare: total ? Math.round((top.reduce((s, c) => s + (byCat[c.key] ?? 0), 0) / total) * 100) : 0,
  };
}

/** One plain sentence about the report. */
export function reportHeadline({ income, spent, saved, given, spentChange, savingsRate }) {
  const rupee = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const out = spent + saved + given;
  const parts = [];
  if (income > 0) {
    const used = Math.round((spent / income) * 100);
    parts.push(out > income ? `You spent and set aside ${rupee(out - income)} more than you earned` : `You spent ${used}% of what came in`);
    parts.push(saved > 0 ? `saved ${savingsRate}%` : 'saved nothing');
  } else {
    parts.push(`You spent ${rupee(spent)} with no income logged`);
  }
  if (spentChange != null && Math.abs(spentChange) >= 5) parts.push(`spending ${spentChange > 0 ? 'up' : 'down'} ${Math.abs(spentChange)}% on the report before`);
  return `${parts.join(', ')}.`;
}

const sum = (list) => Math.round(list.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100;

function totals(transactions, income, { start, end }, rules) {
  const inWin = (e) => { const k = localDateKey(e.date); return k && k >= start && k < end; };
  const tx = transactions.filter(inWin);
  const inc = income.filter((i) => !i.isCarryForward && inWin(i));
  const expenses = tx.filter((t) => t.type === 'expense');
  const byCat = {};
  expenses.forEach((t) => { const c = categoryOf(t, rules) ?? 'other'; byCat[c] = (byCat[c] ?? 0) + (Number(t.amount) || 0); });
  const spendDays = new Set(expenses.map((t) => localDateKey(t.date)));
  return {
    income: sum(inc.filter((i) => incomeKind(i) === 'income')),
    spent: sum(expenses),
    saved: sum(tx.filter((t) => t.type === 'savings')),
    given: sum(tx.filter((t) => t.type === 'person' && t.direction === 'given_gift')),
    byCat, expenses, spendDays: spendDays.size,
  };
}

/**
 * The report published on `reportKey`, compared with the one before it.
 * @param {object} p  { transactions, income, rules (category rules), recurring (rules), budgets, reportKey, day, todayKey }
 */
export function buildReport({ transactions = [], income = [], rules = {}, recurring = [], budgets = null, reportKey, day, todayKey }) {
  const win = reportWindow(reportKey, income);
  const prevWin = reportWindow(shiftReportDay(reportKey, day ?? Number(reportKey.slice(8)), -1), income);
  const cur = totals(transactions, income, win, rules);
  const prev = totals(transactions, income, prevWin, rules);

  // Category by category: up, down, steady, new, stopped
  const keys = new Set([...Object.keys(cur.byCat), ...Object.keys(prev.byCat)]);
  const rows = [...keys].map((key) => {
    const now = Math.round(cur.byCat[key] ?? 0), before = Math.round(prev.byCat[key] ?? 0);
    const diff = now - before;
    const change = before === 0 ? (now > 0 ? 'new' : 'steady')
      : now === 0 ? 'stopped'
      : Math.abs(diff) < Math.max(100, before * 0.1) ? 'steady'
      : diff > 0 ? 'up' : 'down';
    return { key, label: categoryMeta(key)?.label ?? key, now, before, diff, change };
  }).sort((a, b) => b.now - a.now || b.before - a.before);

  // Bills that fell due in the window and weren't paid
  const ids = new Set([...transactions, ...income].map((e) => e.id));
  const missed = [];
  recurring.filter((r) => isBill(r) && r.active !== false).forEach((rule) => {
    occurrencesBetween(rule, addDays(win.start, -1), win.last).forEach((dateKey) => {
      if (dateKey >= (todayKey ?? win.end)) return;
      if (ids.has(occurrenceId(rule.id, dateKey))) return;
      missed.push({ name: rule.name, dateKey, amount: Number(rule.amount) || 0, skipped: !!(rule.lastHandledKey && dateKey <= rule.lastHandledKey) });
    });
  });

  // Categories over their monthly limit
  const over = Object.entries(budgets?.categories ?? {})
    .map(([key, limit]) => ({ key, label: categoryMeta(key)?.label ?? key, limit: Number(limit) || 0, spent: Math.round(cur.byCat[key] ?? 0) }))
    .filter((c) => c.limit > 0 && c.spent > c.limit);
  const totalLimit = Number(budgets?.total) > 0 ? Number(budgets.total) : null;

  const biggest = cur.expenses.slice().sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0] ?? null;
  const left = Math.round((cur.income - cur.spent - cur.saved - cur.given) * 100) / 100;

  const spentChange = prev.spent > 0 ? Math.round(((cur.spent - prev.spent) / prev.spent) * 100) : null;
  const savingsRate = cur.income > 0 ? Math.round((cur.saved / cur.income) * 100) : null;

  return {
    reportKey, ...win,
    headline: reportHeadline({ income: cur.income, spent: cur.spent, saved: cur.saved, given: cur.given, spentChange, savingsRate }),
    analysis: analyseSpending(cur.expenses, win, rules),
    income: cur.income, spent: cur.spent, saved: cur.saved, given: cur.given, left,
    savingsRate,
    avgPerDay: win.days > 0 ? cur.spent / win.days : 0,
    noSpendDays: Math.max(0, win.days - cur.spendDays),
    biggest: biggest && { name: biggest.name, amount: Number(biggest.amount) || 0, date: biggest.date },
    prev: { start: prevWin.start, last: prevWin.last, income: prev.income, spent: prev.spent, saved: prev.saved },
    spentChange,
    up: rows.filter((r) => r.change === 'up' || r.change === 'new'),
    down: rows.filter((r) => r.change === 'down' || r.change === 'stopped'),
    steady: rows.filter((r) => r.change === 'steady' && r.now > 0),
    missed, over,
    overTotal: totalLimit && cur.spent > totalLimit ? { limit: totalLimit, spent: cur.spent } : null,
    empty: cur.expenses.length === 0 && cur.income === 0 && cur.saved === 0,
  };
}

/** "5 Oct – 3 Nov" */
export function windowLabel(start, last) {
  const f = (k, withYear) => fromKey(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  return `${f(start)} – ${f(last, start.slice(0, 4) !== last.slice(0, 4))}`;
}

export const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
