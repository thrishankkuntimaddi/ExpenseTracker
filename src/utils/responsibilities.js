// ─── Responsibilities ────────────────────────────────────────────
// Money you didn't borrow but have taken on to clear: a parent's loan, a
// promise to someone. It is never a debt in the Debts page (nobody lent it
// to you) — it is the past you are clearing, the way goals are the future
// you are saving for.
//
// settings.responsibilities = [{
//   id, title,                       "Mom's gold loan"
//   forWhom?: string,                "Mom" — whose it was / who you promised
//   owedTo?: string,                 "Ramesh uncle", "SBI gold loan" — who gets paid
//   total: number,                   what has to be cleared in all
//   priority: number,                1 = clear first (the list's order)
//   plan: 'anytime' | 'monthly' | 'by_date',
//   monthly?: number,                planned per month (plan 'monthly')
//   dueBy?: 'YYYY-MM-DD',            clear it all by (plan 'by_date')
//   remindDay?: 1-31,                the day of the month to be reminded (salary day)
//   note?, createdAt,
//   status?: 'active' | 'cleared' | 'closed', endedOn?
// }]
// A payment is an ordinary expense with category 'responsibility' and
// responsibilityId, so totals and the balance stay right. Paid from savings
// (an FD broken): paidFrom 'savings' (see finance.computeStats).
import { localDateKey } from './dateHelpers';
import { sumAmounts } from './finance';
import { toKey, fromKey } from './recurring';

export const RESP_PLANS = [
  { key: 'anytime', label: 'When I can',  hint: 'Pay any amount, any time' },
  { key: 'monthly', label: 'Every month', hint: 'A fixed amount from each salary' },
  { key: 'by_date', label: 'By a date',   hint: 'Clear it all by a deadline' },
];

export const isRespOpen = (r) => !r?.status || r.status === 'active';
export const isRespPayment = (t) => t?.type === 'expense' && !!t.responsibilityId;

/** Open first by priority, then cleared / closed (latest first). */
export function sortResponsibilities(list = []) {
  const open = list.filter(isRespOpen).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const done = list.filter((r) => !isRespOpen(r)).sort((a, b) => String(b.endedOn ?? '').localeCompare(String(a.endedOn ?? '')));
  return [...open, ...done];
}

/** Re-number priorities 1..n in the given order (open ones only). */
export function renumber(list) {
  let n = 0;
  return list.map((r) => (isRespOpen(r) ? { ...r, priority: ++n } : r));
}

const monthsUntil = (todayKey, dueKey) => {
  const a = fromKey(todayKey), b = fromKey(dueKey);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 1 : 0));
};

/** Progress of one responsibility from its payments. */
export function respProgress(resp, transactions = [], todayKey = toKey(new Date())) {
  const payments = transactions.filter((t) => isRespPayment(t) && t.responsibilityId === resp.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const paid = sumAmounts(payments);
  const total = Number(resp.total) || 0;
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const month = todayKey.slice(0, 7);
  const paidThisMonth = sumAmounts(payments.filter((t) => localDateKey(t.date)?.slice(0, 7) === month));
  const fromSavings = sumAmounts(payments.filter((t) => t.paidFrom === 'savings'));

  // What this month asks for
  let monthlyTarget = 0;
  if (resp.plan === 'monthly') monthlyTarget = Number(resp.monthly) || 0;
  if (resp.plan === 'by_date' && resp.dueBy) {
    // spread what was left at the start of this month over the months to go
    const leftAtStart = remaining + paidThisMonth;
    monthlyTarget = Math.ceil(leftAtStart / monthsUntil(todayKey, resp.dueBy));
  }
  monthlyTarget = Math.min(monthlyTarget, remaining + paidThisMonth);
  const dueThisMonth = Math.max(0, Math.round((monthlyTarget - paidThisMonth) * 100) / 100);

  // At the current pace: months left (monthly plans) / late (dated plans)
  const monthsLeft = resp.plan === 'monthly' && Number(resp.monthly) > 0 && remaining > 0 ? Math.ceil(remaining / Number(resp.monthly)) : null;
  const overdue = resp.plan === 'by_date' && resp.dueBy && resp.dueBy < todayKey && remaining > 0;
  const daysToDue = resp.plan === 'by_date' && resp.dueBy ? Math.round((fromKey(resp.dueBy) - fromKey(todayKey)) / 86400000) : null;

  return {
    payments, paid, total, remaining, pct: total > 0 ? Math.min(100, (paid / total) * 100) : 0,
    done: total > 0 && remaining <= 0, paidThisMonth, dueThisMonth, monthlyTarget, monthsLeft, overdue, daysToDue,
    fromSavings, lastPaid: payments[0]?.date ?? null,
  };
}

/** Totals across the open ones, and what's next. */
export function respSummary(list = [], transactions = [], todayKey = toKey(new Date())) {
  const open = sortResponsibilities(list).filter(isRespOpen);
  const rows = open.map((r) => ({ resp: r, ...respProgress(r, transactions, todayKey) }));
  return {
    rows,
    count: rows.length,
    remaining: Math.round(rows.reduce((s, r) => s + r.remaining, 0) * 100) / 100,
    total: rows.reduce((s, r) => s + r.total, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    dueThisMonth: Math.round(rows.reduce((s, r) => s + r.dueThisMonth, 0) * 100) / 100,
    paidThisMonth: rows.reduce((s, r) => s + r.paidThisMonth, 0),
    next: rows.find((r) => r.remaining > 0) ?? null,
  };
}
