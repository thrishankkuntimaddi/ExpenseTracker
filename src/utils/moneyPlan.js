// ─── Money plan: a health check of the month ─────────────────────
// Splits what left your hands this month into five buckets and compares
// each with your income, the way a "monthly budget planning" sheet does:
//   Essentials   rent, groceries, bills, fuel, health …     keep under 40 %
//   Lifestyle    eating out, shopping, trips, gifts …       keep under 20 %
//   EMIs         loan instalments, responsibilities, paying back borrowed money  under 30 %
//   Investments  savings entries (SIPs, FDs, gold …)        at least 20 %
//   Leftover     whatever is still in hand                  > 10 % → invest it; else build the emergency fund
// Built from real entries, so it needs no set-up. Pure — unit-tested.
import { localMonthKey, localDateKey } from './dateHelpers';
import { categoryOf } from './categories';
import { ESSENTIALS } from './report';
import { incomeKind } from './finance';

export const PLAN_LIMITS = { essentials: 40, lifestyle: 20, emis: 30, investments: 20, leftover: 10 };
export const EMERGENCY_MONTHS = 6;

export const BUCKETS = [
  { key: 'essentials',  label: 'Essentials',  hint: 'Rent, groceries, bills, fuel, health', tone: 'accent' },
  { key: 'lifestyle',   label: 'Lifestyle',   hint: 'Eating out, shopping, outings, gifts', tone: 'external' },
  { key: 'emis',        label: 'EMIs & loans', hint: 'Instalments, responsibilities, paying back', tone: 'expense' },
  { key: 'investments', label: 'Investments', hint: 'SIPs, deposits, anything saved', tone: 'savings' },
  { key: 'leftover',    label: 'Left over',   hint: 'Still in hand', tone: 'income' },
];

const EMI_RE = /\b(e\.?m\.?i\.?s?|loans?|instal+ments?)\b/i;

/** An expense that pays off a loan: named like one, or a responsibility payment. */
export function isEmiEntry(t, rules = {}) {
  if (t?.type !== 'expense') return false;
  if (t.category === 'responsibility' || t.responsibilityId) return true;
  if (!EMI_RE.test(String(t.name ?? ''))) return false;
  // "credit card bill" pays back spending already counted; only loans count here
  return categoryOf(t, rules) !== 'insurance';
}

const amt = (x) => Math.round((Number(x?.amount) || 0) * 100);

/** `sel` is a month ('YYYY-MM') or a window { start, end } of date keys (end not included). */
const matcher = (sel) => {
  if (typeof sel === 'string') return (e) => localMonthKey(e.date) === sel;
  return (e) => { const k = localDateKey(e.date); return !!k && k >= sel.start && k < sel.end; };
};

/** The five buckets (in rupees) for a month's (or a window's) entries. */
export function bucketTotals(transactions = [], sel, rules = {}) {
  const paise = { essentials: 0, lifestyle: 0, emis: 0, investments: 0, lent: 0 };
  const inSel = matcher(sel);
  for (const t of transactions) {
    if (!inSel(t) || t.isCarryForward) continue;
    if (t.type === 'savings') { paise.investments += amt(t); continue; }
    if (t.type === 'person') {
      if (t.direction === 'repaid') paise.emis += amt(t);
      else if (t.direction === 'given_gift') paise.lifestyle += amt(t);
      else if (t.direction === 'lent') paise.lent += amt(t);
      continue;
    }
    if (t.type !== 'expense') continue;
    // Paid out of savings (an FD broken): not from this month's income
    if (t.paidFrom === 'savings') continue;
    if (isEmiEntry(t, rules)) { paise.emis += amt(t); continue; }
    const c = categoryOf(t, rules) ?? 'other';
    if (ESSENTIALS.has(c)) paise.essentials += amt(t);
    else paise.lifestyle += amt(t);
  }
  return Object.fromEntries(Object.entries(paise).map(([k, v]) => [k, v / 100]));
}

/** What each bucket's share means, in a few words. */
export function verdict(key, pct, leftover) {
  switch (key) {
    case 'essentials':  return pct < PLAN_LIMITS.essentials ? { ok: true, text: 'In line with your income' } : { ok: false, text: 'Too high — trim what you can' };
    case 'lifestyle':   return pct < PLAN_LIMITS.lifestyle ? { ok: true, text: 'In line with your income' } : { ok: false, text: 'Cut the spends you don’t need' };
    case 'emis':        return pct < PLAN_LIMITS.emis ? { ok: true, text: 'Loans are under control' } : { ok: false, text: 'Close the costliest loan first' };
    case 'investments': return pct >= PLAN_LIMITS.investments ? { ok: true, text: 'Great — keep it up, raise it if you can' } : { ok: false, text: `Invest more — aim for ${PLAN_LIMITS.investments}%` };
    case 'leftover':
      if (leftover < 0) return { ok: false, text: 'You spent more than came in' };
      return pct > PLAN_LIMITS.leftover ? { ok: true, text: 'Move some of it into investments' } : { ok: true, text: 'Fill your emergency fund first' };
    default: return { ok: true, text: '' };
  }
}

const prevMonths = (monthKey, n) => {
  const [y, m] = monthKey.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 2 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};

/**
 * How many months of essentials + EMIs your savings would cover.
 * Need = the average of the last three months that had any (or this one).
 */
export function emergencyCover(transactions = [], monthKey, rules = {}) {
  const saved = transactions.reduce((s, t) => {
    if (t.type === 'savings') return s + amt(t);
    if (t.type === 'expense' && t.paidFrom === 'savings') return s - amt(t);
    return s;
  }, 0) / 100;
  const months = [monthKey, ...prevMonths(monthKey, 3)]
    .map((k) => { const b = bucketTotals(transactions, k, rules); return b.essentials + b.emis; })
    .filter((v) => v > 0);
  const need = months.length ? months.reduce((s, v) => s + v, 0) / months.length : 0;
  const target = need * EMERGENCY_MONTHS;
  return { saved: Math.max(0, saved), monthlyNeed: need, target, months: need > 0 ? Math.max(0, saved) / need : null };
}

/**
 * @param {object} p
 * @param {array}  p.transactions
 * @param {array}  p.income
 * @param {string} p.monthKey     'YYYY-MM'
 * @param {object} [p.window]     { start, end } date keys — instead of a month (salary-to-salary reports)
 * @param {object} p.rules        category rules
 * @param {number} [p.incomeBase] use this as income (e.g. the expected salary) instead of what was received
 */
export function computeMoneyPlan({ transactions = [], income = [], monthKey, window, rules = {}, incomeBase }) {
  const sel = window ?? monthKey;
  const inSel = matcher(sel);
  const received = income
    .filter((i) => inSel(i) && !i.isCarryForward && incomeKind(i) === 'income')
    .reduce((s, i) => s + amt(i), 0) / 100;
  const inflow = incomeBase != null && incomeBase > 0 ? incomeBase : received;
  const b = bucketTotals(transactions, sel, rules);
  const out = b.essentials + b.lifestyle + b.emis + b.investments;
  const leftover = Math.round((inflow - out) * 100) / 100;
  const pctOf = (v) => (inflow > 0 ? (v / inflow) * 100 : 0);

  const rows = BUCKETS.map((meta) => {
    const value = meta.key === 'leftover' ? leftover : b[meta.key];
    const pct = pctOf(value);
    return { ...meta, value, pct, limit: PLAN_LIMITS[meta.key], ...verdict(meta.key, pct, leftover) };
  });
  const scored = rows.filter((r) => r.key !== 'leftover');
  return {
    monthKey, income: inflow, received, outflow: out, leftover, lent: b.lent,
    rows, hasIncome: inflow > 0, hasData: out > 0,
    score: scored.filter((r) => r.ok).length, scoreOf: scored.length,
    emergency: monthKey ? emergencyCover(transactions, monthKey, rules) : null,
  };
}
