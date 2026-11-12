// ─── Habits: streaks, no-spend days, saving challenges ───────────
// Pure — unit-tested. A "logged day" is any day with an entry dated on it
// (expense, income, saving, debt …); carried-forward balances don't count.
import { localDateKey } from './dateHelpers';
import { toKey, fromKey } from './recurring';

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];

const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };

export function loggedDays(transactions = [], income = []) {
  const set = new Set();
  for (const e of [...transactions, ...income]) {
    if (e?.isCarryForward) continue;
    const k = localDateKey(e?.date);
    if (k) set.add(k);
  }
  return set;
}

/**
 * current — days in a row up to today (or up to yesterday while today is
 *           still open: the streak is alive until midnight)
 * best    — the longest run ever
 */
export function streak(transactions = [], income = [], todayKey) {
  const days = loggedDays(transactions, income);
  const loggedToday = days.has(todayKey);
  let current = 0;
  for (let k = loggedToday ? todayKey : addDays(todayKey, -1); days.has(k); k = addDays(k, -1)) current++;
  let best = 0;
  for (const k of days) {
    if (k > todayKey || days.has(addDays(k, -1))) continue;   // only start counting at the first day of a run
    let n = 0;
    for (let d = k; days.has(d) && d <= todayKey; d = addDays(d, 1)) n++;
    best = Math.max(best, n);
  }
  const next = STREAK_MILESTONES.find((m) => m > current) ?? null;
  return { current, best: Math.max(best, current), loggedToday, atRisk: !loggedToday && current > 0, next };
}

/** The milestone just reached today (to celebrate once), or null. */
export const milestoneReached = (s) => (s.loggedToday && STREAK_MILESTONES.includes(s.current) ? s.current : null);

/**
 * No-spend days in a month: days with no expense at all. In the current
 * month only finished days count (today can still be one).
 */
export function noSpendDays(transactions = [], monthKey, todayKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const curMonth = todayKey.slice(0, 7);
  if (monthKey > curMonth) return { count: 0, days: [], counted: 0, run: 0, todayClean: false };
  const lastDay = monthKey === curMonth ? Number(todayKey.slice(8)) - 1 : dim;
  const spent = new Set();
  for (const t of transactions) {
    if (t.type !== 'expense' || t.isCarryForward) continue;
    const k = localDateKey(t.date);
    if (k && k.startsWith(monthKey)) spent.add(k);
  }
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const k = `${monthKey}-${String(d).padStart(2, '0')}`;
    if (!spent.has(k)) days.push(k);
  }
  // The current run of no-spend days, ending yesterday (or month end)
  let run = 0;
  for (let d = lastDay; d >= 1 && !spent.has(`${monthKey}-${String(d).padStart(2, '0')}`); d--) run++;
  return { count: days.length, days, counted: Math.max(0, lastDay), run, todayClean: monthKey === curMonth && !spent.has(todayKey) };
}

/* ── 52-week challenge ────────────────────────────────────────────
   A goal with challenge: { kind: '52week', base }: put base × week number
   aside every week (₹100, ₹200 … ₹5,200) — ₹1,37,800 in a year at ₹100. */
export const weekChallengeTarget = (base) => base * (52 * 53) / 2;

export function weekChallenge(goal, todayKey) {
  const base = Number(goal?.challenge?.base) || 0;
  const start = goal?.startDate ?? todayKey;
  const days = Math.max(0, Math.round((fromKey(todayKey) - fromKey(start)) / 86400000));
  const week = Math.min(52, Math.floor(days / 7) + 1);
  const dueSoFar = base * (week * (week + 1)) / 2;
  return { week, thisWeek: base * week, dueSoFar, target: weekChallengeTarget(base), done: days >= 52 * 7 };
}

export function newWeekChallenge(base, todayKey, id) {
  const end = addDays(todayKey, 52 * 7 - 1);
  return {
    id, name: '52-week challenge', target: weekChallengeTarget(base), startDate: todayKey, deadline: end,
    linked: true, challenge: { kind: '52week', base },
  };
}
