// ─── Borrowed money: was it used? ────────────────────────────────
// Borrowed money counts as money in. But you borrow for a reason, so after
// a while the app asks about it:
//   • unused — the check date has passed, part of it is still owed, and you
//     have spent less than that since borrowing. "Pay some back, or note what
//     it's for."
//   • unexplained — you paid it back quickly without spending that much in
//     between and never noted what it was for. "What was it for?"
// When to check is chosen per entry (`checkOn`): 'week' (the default),
// 'month_end', or a date 'YYYY-MM-DD'. `note` is what it was for; `borrowAck`
// means "I'm keeping it on purpose" and stops the questions.
// Repayments are matched to the oldest borrowing from that person first.
import { localDateKey } from './dateHelpers';
import { debtMoveOf } from './debts';
import { toKey, fromKey } from './recurring';

export const CHECK_OPTIONS = [
  { key: 'week',      label: 'In a week' },
  { key: 'month_end', label: 'At month end' },
  { key: 'date',      label: 'On a date' },
];
const UNEXPLAINED_DAYS = 14;   // a quick payback is asked about for two weeks, then dropped

const paise = (n) => Math.round((Number(n) || 0) * 100);
const norm = (s) => String(s ?? '').trim().toLowerCase();
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };

/** The day the app checks on a borrowing (YYYY-MM-DD). */
export function checkDateOf(entry) {
  const day = localDateKey(entry?.date);
  if (!day) return null;
  const c = entry.checkOn;
  if (c && /^\d{4}-\d{2}-\d{2}$/.test(c)) return c > day ? c : addDays(day, 1);
  if (c === 'month_end') {
    const d = fromKey(day);
    let end = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    // Borrowed on the last day: the end of next month
    if (end <= day) end = toKey(new Date(d.getFullYear(), d.getMonth() + 2, 0));
    return end;
  }
  return addDays(day, 7);
}

/** Money that left after `fromKey` (inclusive) and up to `toKey` (inclusive), except paybacks to `lender`. */
function outflowBetween(transactions, from, to, lender) {
  let p = 0;
  transactions.forEach((t) => {
    const k = localDateKey(t.date);
    if (!k || k < from || (to && k > to)) return;
    const out = t.type === 'expense' || t.type === 'savings' || (t.type === 'person' && ['lent', 'given_gift', 'repaid'].includes(t.direction ?? 'lent'));
    if (!out) return;
    if (t.type === 'person' && t.direction === 'repaid' && norm(t.name) === lender) return;
    p += paise(t.amount);
  });
  return p / 100;
}

/**
 * Every borrowing with how much of it is still owed (oldest paid first).
 * @returns {Array<{ entry, source, lender, name, amount, outstanding, day, checkDay, repaidDay }>}
 */
export function borrowings(transactions = [], income = []) {
  const people = new Map();
  const add = (entry, source) => {
    const move = debtMoveOf(entry, source);
    if (move !== 'borrowed' && move !== 'paid_back') return;
    const key = norm(entry.name);
    if (!key) return;
    if (!people.has(key)) people.set(key, { borrowed: [], paid: [] });
    people.get(key)[move === 'borrowed' ? 'borrowed' : 'paid'].push({ entry, source, day: localDateKey(entry.date) ?? '' });
  };
  transactions.forEach((t) => add(t, 'transaction'));
  income.forEach((i) => { if (!i.isCarryForward) add(i, 'income'); });

  const out = [];
  people.forEach(({ borrowed, paid }, lender) => {
    borrowed.sort((a, b) => a.day.localeCompare(b.day));
    paid.sort((a, b) => a.day.localeCompare(b.day));
    let pi = 0, left = paid[0] ? paise(paid[0].entry.amount) : 0;
    borrowed.forEach((b) => {
      let owed = paise(b.entry.amount);
      let repaidDay = null;
      while (owed > 0 && pi < paid.length) {
        const take = Math.min(owed, left);
        owed -= take; left -= take;
        if (owed === 0) repaidDay = paid[pi].day;
        if (left === 0) { pi += 1; left = paid[pi] ? paise(paid[pi].entry.amount) : 0; }
      }
      out.push({
        entry: b.entry, source: b.source, lender, name: b.entry.name.trim(),
        amount: paise(b.entry.amount) / 100, outstanding: owed / 100,
        day: b.day, checkDay: checkDateOf(b.entry), repaidDay,
      });
    });
  });
  return out;
}

/**
 * What to ask about today.
 * @returns {Array<{ kind: 'unused'|'unexplained', id, entry, source, name, amount, outstanding, spentSince, day, checkDay, repaidDay, days }>}
 */
export function borrowAlerts(transactions = [], income = [], todayKey = toKey(new Date())) {
  const alerts = [];
  borrowings(transactions, income).forEach((b) => {
    if (b.entry.borrowAck || !b.day || !b.checkDay) return;
    const days = Math.round((fromKey(todayKey) - fromKey(b.day)) / 86400000);
    if (b.outstanding > 0) {
      if (todayKey < b.checkDay) return;
      const spentSince = outflowBetween(transactions, b.day, todayKey, b.lender);
      if (spentSince >= b.outstanding) return;
      alerts.push({ kind: 'unused', id: b.entry.id, ...b, spentSince, days });
    } else if (b.repaidDay && !b.entry.note?.trim()) {
      // Paid back before the check date, without much spending in between
      if (b.repaidDay > b.checkDay) return;
      if ((fromKey(todayKey) - fromKey(b.repaidDay)) / 86400000 > UNEXPLAINED_DAYS) return;
      const spentSince = outflowBetween(transactions, b.day, b.repaidDay, b.lender);
      if (spentSince >= b.amount) return;
      alerts.push({ kind: 'unexplained', id: b.entry.id, ...b, spentSince, days });
    }
  });
  return alerts.sort((a, b) => b.outstanding - a.outstanding || a.day.localeCompare(b.day));
}
