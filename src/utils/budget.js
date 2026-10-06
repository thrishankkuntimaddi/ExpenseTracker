// ─── Monthly budgets ─────────────────────────────────────────────
// settings.budgets = { total: number|null, categories: { [categoryKey]: number } }
// All maths here is pure; the UI only renders what computeBudgetStatus returns.
import { localMonthKey, localDateKey } from './dateHelpers';
import { categoryOf, categoryMeta } from './categories';
import { sumAmounts } from './finance';

export const EMPTY_BUDGETS = { total: null, categories: {} };

export function hasAnyBudget(budgets) {
  if (!budgets) return false;
  if (Number(budgets.total) > 0) return true;
  return Object.values(budgets.categories ?? {}).some((v) => Number(v) > 0);
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 'ok' | 'pace' (on track to exceed) | 'warn' (≥85 %) | 'over' */
export function budgetStatusFor(limit, spent, projected) {
  if (!(limit > 0)) return 'none';
  const pct = (spent / limit) * 100;
  if (pct >= 100) return 'over';
  if (pct >= 85) return 'warn';
  if (projected > limit) return 'pace';
  return 'ok';
}

/**
 * @param {object}  p
 * @param {object}  p.budgets      settings.budgets
 * @param {array}   p.transactions ALL transactions (filtered here by month)
 * @param {string}  p.monthKey     'YYYY-MM' to evaluate
 * @param {object}  p.rules        category rules (settings.categoryRules)
 * @param {Date}    p.now
 */
export function computeBudgetStatus({ budgets, transactions = [], monthKey, rules = {}, now = new Date() }) {
  const b = budgets ?? EMPTY_BUDGETS;
  const key = monthKey ?? localMonthKey(now.toISOString());
  const dim = daysInMonth(key);
  const nowMonth = localMonthKey(now.toISOString());

  let daysElapsed;
  if (key === nowMonth) daysElapsed = now.getDate();
  else if (key < nowMonth) daysElapsed = dim;
  else daysElapsed = 0;
  const daysLeft = Math.max(0, dim - daysElapsed);
  const isCurrent = key === nowMonth;

  const monthTxns = transactions.filter((t) => t.type === 'expense' && localMonthKey(t.date) === key);
  const spentToday = isCurrent
    ? sumAmounts(monthTxns.filter((t) => localDateKey(t.date) === localDateKey(now.toISOString())))
    : 0;

  const project = (spent) => (daysElapsed > 0 ? (spent / daysElapsed) * dim : 0);
  const pacePct = dim > 0 ? (daysElapsed / dim) * 100 : 0;

  const totalLimit = Number(b.total) > 0 ? Number(b.total) : null;
  const totalSpent = sumAmounts(monthTxns);
  const totalProjected = project(totalSpent);
  const remaining = totalLimit != null ? totalLimit - totalSpent : null;
  // "Safe to spend today": what's left spread over the remaining days,
  // counting today as one of them and adding back what was already spent today.
  const safeToday = totalLimit != null && isCurrent
    ? Math.max(0, (remaining + spentToday) / Math.max(1, daysLeft + 1))
    : null;

  const total = {
    limit: totalLimit,
    spent: totalSpent,
    remaining,
    pct: totalLimit ? (totalSpent / totalLimit) * 100 : 0,
    projected: totalProjected,
    status: budgetStatusFor(totalLimit, totalSpent, totalProjected),
    safeToday,
    spentToday,
  };

  const perCat = {};
  monthTxns.forEach((t) => {
    const c = categoryOf(t, rules);
    perCat[c] = (perCat[c] ?? 0) + Math.round((Number(t.amount) || 0) * 100);
  });

  const categories = Object.entries(b.categories ?? {})
    .filter(([, v]) => Number(v) > 0)
    .map(([catKey, limit]) => {
      const spent = (perCat[catKey] ?? 0) / 100;
      const lim = Number(limit);
      const projected = project(spent);
      return {
        key: catKey,
        label: categoryMeta(catKey).label,
        limit: lim,
        spent,
        remaining: lim - spent,
        pct: (spent / lim) * 100,
        projected,
        status: budgetStatusFor(lim, spent, projected),
      };
    })
    .sort((a, b2) => b2.pct - a.pct);

  const alerts = [
    ...(total.status === 'over' || total.status === 'warn' || total.status === 'pace' ? [{ key: 'total', ...total, label: 'Monthly budget' }] : []),
    ...categories.filter((c) => c.status !== 'ok'),
  ];

  return {
    monthKey: key, isCurrent, daysInMonth: dim, daysElapsed, daysLeft, pacePct,
    hasBudget: hasAnyBudget(b),
    total, categories, alerts,
  };
}
