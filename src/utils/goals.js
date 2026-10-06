// ─── Savings goals ───────────────────────────────────────────────
// settings.goals = [{ id, name, target, deadline?: 'YYYY-MM-DD', startDate: 'YYYY-MM-DD',
//                     savingsType?: key|null, keyword?: string, color?: string }]
// Progress is derived from savings transactions, never stored.
import { localDateKey } from './dateHelpers';
import { sumAmounts } from './finance';

export function goalMatches(goal, txn) {
  if (txn.type !== 'savings') return false;
  const day = localDateKey(txn.date);
  if (!day) return false;
  if (goal.startDate && day < goal.startDate) return false;
  if (goal.savingsType && txn.savingsType !== goal.savingsType) return false;
  if (goal.keyword) {
    const kw = goal.keyword.toLowerCase();
    const hay = `${txn.name ?? ''} ${txn.platform ?? ''}`.toLowerCase();
    if (!hay.includes(kw)) return false;
  }
  return true;
}

export function computeGoalProgress(goal, transactions = [], now = new Date()) {
  const matched = transactions.filter((t) => goalMatches(goal, t));
  const saved = sumAmounts(matched);
  const target = Number(goal.target) || 0;
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const remaining = Math.max(0, target - saved);

  const todayKey = localDateKey(now.toISOString());
  const start = goal.startDate ? new Date(goal.startDate) : (matched.length ? new Date(Math.min(...matched.map((t) => new Date(t.date)))) : now);
  const elapsedMonths = Math.max(1 / 30, (now - start) / (1000 * 60 * 60 * 24 * 30.44));
  const ratePerMonth = saved / elapsedMonths;

  let monthsLeft = null, neededPerMonth = null, onTrack = null, daysLeft = null, eta = null;
  if (goal.deadline) {
    const dl = new Date(goal.deadline);
    daysLeft = Math.max(0, Math.ceil((dl - now) / 86400000));
    monthsLeft = Math.max(0, daysLeft / 30.44);
    neededPerMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;
    onTrack = remaining <= 0 || (monthsLeft > 0 && ratePerMonth >= neededPerMonth * 0.95);
  }
  if (remaining > 0 && ratePerMonth > 0) {
    const d = new Date(now);
    d.setDate(d.getDate() + Math.round((remaining / ratePerMonth) * 30.44));
    eta = d;
  }

  return {
    saved, target, pct, remaining, done: remaining <= 0 && target > 0,
    count: matched.length, ratePerMonth, monthsLeft, neededPerMonth, onTrack, daysLeft, eta,
    overdue: goal.deadline ? goal.deadline < todayKey && remaining > 0 : false,
  };
}
