// ─── Savings goals ───────────────────────────────────────────────
// settings.goals = [{
//   id, name, target, startDate: 'YYYY-MM-DD', deadline?: 'YYYY-MM-DD',
//   monthly?: number              planned amount per month (reminder + pace)
//   heldWith?: string             where the money sits: "Cash", "Pritam", "HDFC savings"
//   moves?: [{ date, from, to }]  every time the money changed hands
//   status?: 'active' | 'collected' | 'used' | 'closed'
//   endedOn?: 'YYYY-MM-DD', endNote?: string
//   linked?: true                 only savings entries tagged with goalId count
//   savingsType?, keyword?        (older goals) which savings entries count
// }]
// Money put towards a goal is an ordinary savings entry with goalId (and
// heldWith), so balances stay right. Progress is derived, never stored.
import { localDateKey } from './dateHelpers';
import { sumAmounts } from './finance';

export const GOAL_STATUS = {
  active:    { label: 'In progress' },
  collected: { label: 'Reached & collected' },
  used:      { label: 'Used before reaching it' },
  closed:    { label: 'Closed' },
};
export const isGoalOpen = (g) => !g?.status || g.status === 'active';

export function goalMatches(goal, txn) {
  if (txn.type !== 'savings') return false;
  if (txn.goalId) return txn.goalId === goal.id;
  if (goal.linked) return false;
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

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

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

  const thisMonth = monthKeyOf(now);
  const savedThisMonth = sumAmounts(matched.filter((t) => localDateKey(t.date)?.slice(0, 7) === thisMonth));
  // Where the money sits: per holder, from each entry's heldWith (else the goal's)
  const byHolder = {};
  matched.forEach((t) => { const h = (goal.heldWith || t.heldWith || t.platform || 'Not set').trim(); byHolder[h] = (byHolder[h] ?? 0) + (Number(t.amount) || 0); });

  return {
    saved, target, pct, remaining, done: remaining <= 0 && target > 0,
    count: matched.length, ratePerMonth, monthsLeft, neededPerMonth, onTrack, daysLeft, eta,
    overdue: goal.deadline ? goal.deadline < todayKey && remaining > 0 : false,
    savedThisMonth, entries: matched, byHolder,
    monthlyDue: Number(goal.monthly) > 0 ? Math.max(0, Number(goal.monthly) - savedThisMonth) : 0,
  };
}

/** Move the money to someone / somewhere else (keeps the history). */
export function moveGoal(goal, to, dateKey) {
  const from = goal.heldWith || '';
  const next = String(to ?? '').trim();
  if (!next || next === from) return goal;
  return { ...goal, heldWith: next, moves: [...(goal.moves ?? []), { date: dateKey, from, to: next }] };
}

/** Finish a goal: 'collected' (reached and taken back), 'used' (spent early), 'closed'. */
export function endGoal(goal, status, dateKey, note) {
  if (!GOAL_STATUS[status] || status === 'active') return goal;
  return { ...goal, status, endedOn: dateKey, endNote: note?.trim() || undefined };
}
export const reopenGoal = (goal) => { const { endedOn: _e, endNote: _n, ...rest } = goal; return { ...rest, status: 'active' }; };
