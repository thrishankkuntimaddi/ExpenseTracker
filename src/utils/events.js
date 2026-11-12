// ─── Festival & event budgets ────────────────────────────────────
// settings.events = [{ id, name, start, end, limit }] — Diwali, a wedding,
// Sankranti … Spending inside the dates counts, except the everyday
// essentials that would happen anyway (rent, bills, groceries, fuel, EMIs).
// Pure — unit-tested.
import { localDateKey } from './dateHelpers';
import { categoryOf } from './categories';
import { ESSENTIALS } from './report';
import { isEmiEntry } from './moneyPlan';
import { toKey, fromKey } from './recurring';

const ALWAYS = new Set(['gifts', 'travel', 'shopping', 'food', 'entertainment', 'personal', 'family', 'other']);

/** Does this expense belong to the event? */
export function countsForEvent(t, ev, rules = {}) {
  if (t.type !== 'expense' || t.isCarryForward) return false;
  if (t.eventId) return t.eventId === ev.id;
  const k = localDateKey(t.date);
  if (!k || k < ev.start || k > ev.end) return false;
  if (isEmiEntry(t, rules)) return false;
  const c = categoryOf(t, rules) ?? 'other';
  const word = String(ev.name ?? '').toLowerCase().split(/\s+/)[0];
  if (word && word.length > 3 && String(t.name ?? '').toLowerCase().includes(word)) return true;
  return ALWAYS.has(c) || !ESSENTIALS.has(c);
}

export function eventProgress(ev, transactions = [], rules = {}, todayKey) {
  const items = transactions.filter((t) => countsForEvent(t, ev, rules));
  const spent = Math.round(items.reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) / 100;
  const limit = Number(ev.limit) || 0;
  const state = todayKey < ev.start ? 'upcoming' : todayKey > ev.end ? 'done' : 'on';
  const daysToGo = state === 'upcoming' ? Math.round((fromKey(ev.start) - fromKey(todayKey)) / 86400000) : 0;
  return { spent, limit, left: limit ? limit - spent : null, pct: limit ? (spent / limit) * 100 : 0, items, state, daysToGo };
}

/* Starting points — dates are suggestions the user adjusts */
export const EVENT_PRESETS = [
  { name: 'Diwali', days: 7, limit: 15000 },
  { name: 'Dussehra', days: 5, limit: 8000 },
  { name: 'Sankranti', days: 4, limit: 8000 },
  { name: 'Ganesh Chaturthi', days: 4, limit: 6000 },
  { name: 'Rakhi', days: 2, limit: 3000 },
  { name: 'Christmas & New Year', days: 10, limit: 10000 },
  { name: 'Eid', days: 3, limit: 8000 },
  { name: 'Wedding', days: 3, limit: 25000 },
  { name: 'Birthday', days: 1, limit: 5000 },
];

export function presetEvent(p, todayKey, id) {
  const end = fromKey(todayKey); end.setDate(end.getDate() + p.days - 1);
  return { id, name: p.name, start: todayKey, end: toKey(end), limit: p.limit };
}
