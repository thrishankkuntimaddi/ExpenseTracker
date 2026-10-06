// ─── Recurring entries ───────────────────────────────────────────
// A rule describes something that repeats (rent, SIP, salary, Netflix).
// Occurrences are generated on the fly; posting one creates an ordinary
// transaction / income entry with a DETERMINISTIC id, so posting the same
// occurrence twice (two devices, a retry) overwrites instead of duplicating.
//
// Rule shape (users/{uid}/recurring/{id}):
//   { id, name, amount, kind: 'expense'|'savings'|'income',
//     category?, savingsType?, platform?,
//     frequency: 'daily'|'weekly'|'monthly'|'yearly',
//     dayOfMonth?: 1-31, weekday?: 0-6 (Sun-Sat),
//     startDate: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD',
//     autoPost: boolean, active: boolean,
//     lastHandledKey?: 'YYYY-MM-DD'   // latest occurrence posted OR skipped }
import { dateInputToISO, isoToMonth } from './dateHelpers';

export const FREQUENCIES = [
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly'  },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const dim = (y, m0) => new Date(y, m0 + 1, 0).getDate();

export function occurrenceId(ruleId, dateKey) {
  return `rec_${ruleId}_${dateKey}`;
}

/** Does `key` fall on the rule's schedule? (ignores start/end bounds) */
function matches(rule, key) {
  const d = fromKey(key);
  switch (rule.frequency) {
    case 'daily':   return true;
    case 'weekly':  return d.getDay() === (rule.weekday ?? fromKey(rule.startDate).getDay());
    case 'monthly': {
      const want = rule.dayOfMonth ?? fromKey(rule.startDate).getDate();
      return d.getDate() === Math.min(want, dim(d.getFullYear(), d.getMonth()));
    }
    case 'yearly': {
      const s = fromKey(rule.startDate);
      const wantDay = Math.min(s.getDate(), dim(d.getFullYear(), s.getMonth()));
      return d.getMonth() === s.getMonth() && d.getDate() === wantDay;
    }
    default: return false;
  }
}

/** All occurrence keys in (fromExclusive, toInclusive], bounded by start/end. */
export function occurrencesBetween(rule, fromExclusive, toInclusive) {
  if (!rule?.startDate || !toInclusive) return [];
  let cur = rule.startDate;
  if (fromExclusive && fromExclusive >= cur) cur = addDays(fromExclusive, 1);
  const end = rule.endDate && rule.endDate < toInclusive ? rule.endDate : toInclusive;
  const out = [];
  // Hard cap so a daily rule from years ago can't spin forever
  let guard = 0;
  while (cur <= end && guard++ < 4000) {
    if (matches(rule, cur)) out.push(cur);
    // Skip ahead cheaply for sparse frequencies
    if (rule.frequency === 'monthly' || rule.frequency === 'yearly') {
      const d = fromKey(cur);
      if (matches(rule, cur) || d.getDate() === dim(d.getFullYear(), d.getMonth())) {
        // jump to the 1st of next month
        cur = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
        continue;
      }
    }
    cur = addDays(cur, 1);
  }
  return out;
}

/** Occurrences that still need a decision (post / skip), oldest first. */
export function dueOccurrences(rule, todayKey, existingIds = new Set()) {
  if (!rule || rule.active === false) return [];
  const from = rule.lastHandledKey ?? null;
  return occurrencesBetween(rule, from, todayKey)
    .filter((k) => !existingIds.has(occurrenceId(rule.id, k)));
}

/** Next scheduled key strictly after `afterKey` (null if the rule has ended). */
export function nextOccurrence(rule, afterKey) {
  if (!rule?.startDate) return null;
  const horizon = addDays(afterKey, rule.frequency === 'yearly' ? 400 : 62);
  const list = occurrencesBetween(rule, afterKey, horizon);
  return list[0] ?? null;
}

export function monthlyEquivalent(rule) {
  const a = Number(rule?.amount) || 0;
  switch (rule?.frequency) {
    case 'daily':   return a * 30.44;
    case 'weekly':  return a * 4.345;
    case 'monthly': return a;
    case 'yearly':  return a / 12;
    default: return 0;
  }
}

/** Build the entry a posted occurrence creates. Income rules → income entry. */
export function entryFromRule(rule, dateKey) {
  const date = dateInputToISO(dateKey);
  const base = {
    id: occurrenceId(rule.id, dateKey),
    name: rule.name,
    amount: Number(rule.amount),
    date,
    month: isoToMonth(date),
    recurringId: rule.id,
  };
  if (rule.kind === 'income') return { entry: { ...base, type: 'income' }, target: 'income' };
  if (rule.kind === 'savings') {
    return {
      entry: { ...base, type: 'savings', savingsType: rule.savingsType ?? 'cash', ...(rule.platform ? { platform: rule.platform } : {}) },
      target: 'transaction',
    };
  }
  return {
    entry: { ...base, type: 'expense', ...(rule.category ? { category: rule.category } : {}) },
    target: 'transaction',
  };
}

export function describeSchedule(rule) {
  switch (rule?.frequency) {
    case 'daily':   return 'Every day';
    case 'weekly':  return `Every ${WEEKDAYS[rule.weekday ?? fromKey(rule.startDate).getDay()]}`;
    case 'monthly': {
      const d = rule.dayOfMonth ?? fromKey(rule.startDate).getDate();
      const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
      return `Monthly on the ${d}${suffix}`;
    }
    case 'yearly': {
      const s = fromKey(rule.startDate);
      return `Yearly on ${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    default: return '';
  }
}
