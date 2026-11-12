// ─── Heads-up: subscriptions, where the month lands, unusual spending ──
// Pure — unit-tested. Everything is worked out from your own entries.
import { localDateKey, localMonthKey } from './dateHelpers';
import { categoryOf, categoryMeta } from './categories';
import { toKey, fromKey } from './recurring';
import { monthBills } from './bills';
import { isEmiEntry } from './moneyPlan';

/* Where a repeating charge counts as a subscription (rent, food, shopping … never do) */
const SUB_CATEGORIES = new Set(['subscriptions', 'bills', 'entertainment', 'health', 'education', 'personal', 'other']);

const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const amt = (t) => Number(t?.amount) || 0;
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const shiftMonth = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/**
 * Subscriptions: anything in the Subscriptions category, or a name paid
 * about once a month for the same amount (±20 %) in at least two of the last
 * three months. Each: { name, monthly, last, months, category }.
 */
export function findSubscriptions(transactions = [], rules = {}, todayKey) {
  const thisMonth = todayKey.slice(0, 7);
  const window = [shiftMonth(thisMonth, -2), shiftMonth(thisMonth, -1), thisMonth];
  const groups = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || t.isCarryForward) continue;
    const mk = localMonthKey(t.date);
    if (!window.includes(mk)) continue;
    const key = norm(t.name);
    if (!key) continue;
    (groups[key] ??= { name: String(t.name).trim(), items: [] }).items.push({ mk, amount: amt(t), date: localDateKey(t.date), cat: categoryOf(t, rules), emi: isEmiEntry(t, rules) });
  }
  const out = [];
  for (const g of Object.values(groups)) {
    const items = g.items.sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = items.at(-1);
    const months = new Set(items.map((i) => i.mk));
    const perMonth = Math.max(...[...months].map((mk) => items.filter((i) => i.mk === mk).length));
    const amounts = items.map((i) => i.amount);
    const samePrice = Math.max(...amounts) <= Math.min(...amounts) * 1.02;
    const isSubCat = items.some((i) => i.cat === 'subscriptions');
    const emi = items.some((i) => i.emi);
    const looksMonthly = months.size >= 2 && perMonth === 1 && samePrice && last.amount > 0 && SUB_CATEGORIES.has(last.cat) && !emi;
    if (!(looksMonthly || (isSubCat && last.amount > 0 && perMonth <= 2))) continue;
    // Not seen for two months: probably cancelled
    if (last.mk < shiftMonth(thisMonth, -1)) continue;
    out.push({ name: g.name, monthly: last.amount, last: last.date, months: months.size, category: last.cat });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/**
 * Regular monthly payments: a name paid once last month and (if already
 * paid) once this month at a similar amount — rent, EMIs, a gym, Netflix.
 * Returns Map(name → { amount, day, paidThisMonth, ids:Set }).
 */
export function regularPayments(transactions = [], monthKey) {
  const prev = shiftMonth(monthKey, -1), prev2 = shiftMonth(monthKey, -2);
  const by = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || t.isCarryForward) continue;
    const mk = localMonthKey(t.date);
    if (mk !== prev2 && mk !== prev && mk !== monthKey) continue;
    const key = norm(t.name);
    if (!key) continue;
    ((by[key] ??= { [prev2]: [], [prev]: [], [monthKey]: [] })[mk]).push(t);
  }
  const near = (x, a) => Math.abs(amt(x) - a) <= a * 0.25;
  const out = new Map();
  for (const [key, g] of Object.entries(by)) {
    const before = g[prev], earlier = g[prev2], now = g[monthKey];
    if (before.length !== 1 || now.length > 1) continue;
    const a = amt(before[0]);
    if (now.length === 1 && !near(now[0], a)) continue;
    // Not paid yet this month: only "still to come" if it was also paid the month before
    if (now.length === 0 && !(earlier.length === 1 && near(earlier[0], a))) continue;
    out.set(key, { amount: now.length ? amt(now[0]) : a, day: Number(localDateKey(before[0].date).slice(8)), paidThisMonth: now.length === 1, ids: new Set(now.map((t) => t.id)) });
  }
  return out;
}

/**
 * Where the month will land: spent so far + your usual daily pace for the
 * days left + bills still due this month (pace excludes bills already paid,
 * so they aren't counted twice).
 */
export function monthForecast({ transactions = [], income = [], recurringRules = [], todayKey }) {
  const monthKey = todayKey.slice(0, 7);
  const [y, m] = monthKey.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const day = Number(todayKey.slice(8));
  const exp = transactions.filter((t) => t.type === 'expense' && !t.isCarryForward && localMonthKey(t.date) === monthKey);
  const spent = exp.reduce((s, t) => s + amt(t), 0);
  const ids = new Set([...transactions, ...income].map((e) => e.id));
  const bills = monthBills(recurringRules, ids, monthKey, todayKey);
  const billItems = bills.items.filter((i) => i.rule.kind === 'expense');
  const paidBills = billItems.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const dueBills = billItems.filter((i) => i.status !== 'paid' && i.status !== 'skipped').reduce((s, i) => s + i.amount, 0);
  // Monthly payments seen last month: once, not as a daily pace (and the ones
  // not paid yet this month are still to come) — unless a Bills rule covers them
  const ruleNames = new Set(recurringRules.map((r) => norm(r.name)));
  const regular = [...regularPayments(transactions, monthKey).entries()].filter(([name]) => !ruleNames.has(name)).map(([, v]) => v);
  const regularPaid = regular.filter((r) => r.paidThisMonth).reduce((s, r) => s + r.amount, 0);
  const regularDue = regular.filter((r) => !r.paidThisMonth && r.day > day).reduce((s, r) => s + r.amount, 0);
  const everyday = Math.max(0, spent - paidBills - regularPaid);
  const pace = day > 0 ? everyday / day : 0;
  const projected = Math.round(spent + pace * (dim - day) + dueBills + regularDue);
  const lastMonth = transactions.filter((t) => t.type === 'expense' && !t.isCarryForward && localMonthKey(t.date) === shiftMonth(monthKey, -1)).reduce((s, t) => s + amt(t), 0);
  return { monthKey, spent, projected, pace, dueBills: dueBills + regularDue, billsDue: dueBills, regularDue, daysLeft: dim - day, lastMonth, vsLast: lastMonth > 0 ? Math.round(((projected - lastMonth) / lastMonth) * 100) : null };
}

/**
 * Categories running hot: the last 7 days against the usual week (the eight
 * weeks before). Flagged at ≥ 2× and at least 500 more than usual.
 */
export function unusualSpending(transactions = [], rules = {}, todayKey, { factor = 2, minExtra = 500 } = {}) {
  const from = addDays(todayKey, -6), histFrom = addDays(from, -56);
  const now = {}, hist = {};
  // Once-a-month payments (rent, EMIs, a subscription) land in one week: not a trend
  const monthly = new Set();
  for (let i = 0; i < 3; i++) for (const k of regularPayments(transactions, shiftMonth(todayKey.slice(0, 7), -i)).keys()) monthly.add(k);
  for (const t of transactions) {
    if (t.type !== 'expense' || t.isCarryForward || t.paidFrom === 'savings') continue;
    if (monthly.has(norm(t.name)) || isEmiEntry(t, rules)) continue;
    const k = localDateKey(t.date);
    if (!k || k > todayKey || k < histFrom) continue;
    const c = categoryOf(t, rules) ?? 'other';
    if (k >= from) now[c] = (now[c] ?? 0) + amt(t);
    else hist[c] = (hist[c] ?? 0) + amt(t);
  }
  return Object.entries(now).map(([key, amount]) => {
    const usual = (hist[key] ?? 0) / 8;
    return { key, label: categoryMeta(key)?.label ?? key, amount, usual, times: usual > 0 ? amount / usual : null };
  }).filter((c) => c.usual > 0 && c.amount >= c.usual * factor && c.amount - c.usual >= minExtra)
    .sort((a, b) => (b.amount - b.usual) - (a.amount - a.usual));
}
