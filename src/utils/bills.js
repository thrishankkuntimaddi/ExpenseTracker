// ─── Bills ───────────────────────────────────────────────────────
// The month's essential payments — rent, electricity, EMIs, SIPs,
// subscriptions — as dated occurrences of the user's recurring rules, each
// with a status. Pure functions; the Bills page and Home read these.
import { occurrencesBetween, occurrenceId, toKey, fromKey } from './recurring';

/** Outgoing rules count as bills: expenses and savings (SIPs). */
export const isBill = (rule) => rule && rule.kind !== 'income';

/**
 * Status of one scheduled occurrence:
 *  'paid'     an entry with its deterministic id exists
 *  'skipped'  handled without paying (on or before lastHandledKey)
 *  'overdue'  before today, not handled
 *  'today'    due today
 *  'upcoming' later
 */
export function occurrenceStatus(rule, dateKey, todayKey, existingIds) {
  if (existingIds.has(occurrenceId(rule.id, dateKey))) return 'paid';
  if (rule.lastHandledKey && dateKey <= rule.lastHandledKey) return 'skipped';
  if (dateKey < todayKey) return 'overdue';
  if (dateKey === todayKey) return 'today';
  return 'upcoming';
}

const monthBounds = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return { before: toKey(new Date(y, m - 1, 0)), last: toKey(new Date(y, m, 0)) };
};

/**
 * Every bill occurrence in `monthKey` (YYYY-MM), date order, with totals.
 * Paused rules are left out unless they were already paid this month.
 */
export function monthBills(rules = [], existingIds = new Set(), monthKey, todayKey) {
  const { before, last } = monthBounds(monthKey);
  const items = [];
  rules.filter(isBill).forEach((rule) => {
    occurrencesBetween(rule, before, last).forEach((dateKey) => {
      const status = occurrenceStatus(rule, dateKey, todayKey, existingIds);
      if (rule.active === false && status !== 'paid') return;
      items.push({ rule, dateKey, status, amount: Number(rule.amount) || 0 });
    });
  });
  items.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : a.rule.name.localeCompare(b.rule.name)));
  const sum = (pred) => items.filter(pred).reduce((s, i) => s + i.amount, 0);
  return {
    items,
    total: sum((i) => i.status !== 'skipped'),
    paid: sum((i) => i.status === 'paid'),
    remaining: sum((i) => i.status === 'overdue' || i.status === 'today' || i.status === 'upcoming'),
    overdueCount: items.filter((i) => i.status === 'overdue').length,
  };
}

/**
 * What needs attention soon: every unpaid overdue occurrence (any month)
 * plus what falls due in the next `days` days. Auto-pay rules are left out
 * of "overdue" (they post themselves) but shown as upcoming.
 */
export function upcomingBills(rules = [], existingIds = new Set(), todayKey, days = 7) {
  const horizon = toKey(new Date(fromKey(todayKey).getTime() + days * 86400000));
  const out = [];
  rules.filter((r) => isBill(r) && r.active !== false).forEach((rule) => {
    occurrencesBetween(rule, rule.lastHandledKey ?? null, horizon).forEach((dateKey) => {
      const status = occurrenceStatus(rule, dateKey, todayKey, existingIds);
      if (status === 'paid' || status === 'skipped') return;
      if (status === 'overdue' && rule.autoPost) return;
      out.push({ rule, dateKey, status, amount: Number(rule.amount) || 0 });
    });
  });
  out.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
  return out;
}

/** "Today", "Tomorrow", "In 3 days", "2 days late" */
export function dueLabel(dateKey, todayKey) {
  const diff = Math.round((fromKey(dateKey) - fromKey(todayKey)) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  return diff === -1 ? '1 day late' : `${-diff} days late`;
}

/* One-tap starting points for "Add a bill" */
export const BILL_PRESETS = [
  { key: 'rent',        label: 'Rent',             name: 'House rent',        kind: 'expense', category: 'rent', dayOfMonth: 5 },
  { key: 'electricity', label: 'Electricity',      name: 'Electricity bill',  kind: 'expense', category: 'bills' },
  { key: 'mobile',      label: 'Mobile',           name: 'Mobile recharge',   kind: 'expense', category: 'bills' },
  { key: 'internet',    label: 'Internet',         name: 'Internet',          kind: 'expense', category: 'bills' },
  { key: 'home',        label: 'Send home',        name: 'Money to parents',  kind: 'expense', category: 'family' },
  { key: 'emi',         label: 'Loan EMI',         name: 'Loan EMI',          kind: 'expense', category: 'bills' },
  { key: 'sip',         label: 'SIP',              name: 'Mutual fund SIP',   kind: 'savings', savingsType: 'sip' },
  { key: 'fd',          label: 'FD / RD',          name: 'Recurring deposit', kind: 'savings', savingsType: 'other' },
  { key: 'term',        label: 'Term insurance',   name: 'Term insurance',    kind: 'expense', category: 'health', frequency: 'yearly' },
  { key: 'health',      label: 'Health insurance', name: 'Health insurance',  kind: 'expense', category: 'health', frequency: 'yearly' },
  { key: 'policy',      label: 'LIC / policy',     name: 'LIC premium',       kind: 'expense', category: 'bills', frequency: 'yearly' },
  { key: 'ott',         label: 'Subscription',     name: 'Netflix',           kind: 'expense', category: 'subscriptions' },
];
