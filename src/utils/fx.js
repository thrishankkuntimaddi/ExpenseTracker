// ─── Multi-currency views (pure) ─────────────────────────────────
// The rule the whole app follows:
//   • What happened (spending, income, history, reports, budgets) is converted
//     at the rate of the DAY IT HAPPENED. $10 of fuel in March stays what it
//     cost in March, whatever the dollar does later.
//   • What you still hold (the balance) is converted at TODAY'S rate: money
//     is kept per currency — $150 left and ₹-10,000 spent from it — and only
//     the remainder is valued live.
//
// Stored entries never change: they keep their own amount and currency.
// The app works on *views* — copies whose money fields are in the display
// currency, with the originals kept in `orig`. Entries already in the display
// currency are passed through untouched (same object), so a one-currency
// account behaves exactly as before.
import { currencyOf, isCurrency } from './money';
import { localDateKey } from './dateHelpers';

export const MONEY_FIELDS = ['amount', 'wasteAmount', 'settlement'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * An entry in the display currency `to`.
 * `rateFn(from, to, day)` gives the rate for a day (day undefined = today).
 * The rate the user saw when entering it (entry.fx snapshot) wins.
 */
export function viewEntry(entry, to, rateFn) {
  const from = currencyOf(entry);
  if (from === to || !entry) return entry;
  let rate = null;
  if (entry.fx && entry.fx[from] > 0 && entry.fx[to] > 0 && !entry.fxLive) rate = entry.fx[to] / entry.fx[from];
  if (rate == null) rate = rateFn(from, to, entry.fxLive ? undefined : localDateKey(entry.date) ?? undefined);
  if (!(rate > 0)) rate = 1;
  const out = { ...entry, orig: { currency: from }, fxRate: rate };
  MONEY_FIELDS.forEach((f) => {
    if (typeof entry[f] === 'number') { out.orig[f] = entry[f]; out[f] = round2(entry[f] * rate); }
  });
  return out;
}

export function viewEntries(list, to, rateFn) {
  let changed = false;
  const out = (list ?? []).map((e) => { const v = viewEntry(e, to, rateFn); if (v !== e) changed = true; return v; });
  return changed ? out : list;
}

/** The entry as stored: its own amounts and currency, without view fields. */
export function rawOf(entry) {
  if (!entry?.orig) return entry;
  const { orig, fxRate: _rate, ...rest } = entry;
  MONEY_FIELDS.forEach((f) => { if (f in orig) rest[f] = orig[f]; });
  rest.currency = orig.currency;
  return rest;
}

/**
 * Turn an edited view back into something to store.
 *  • money untouched (name, date, category edits)  → original amounts and currency
 *  • money edited on the converted figures        → the entry now is in the
 *    display currency (the numbers the user typed are display-currency numbers)
 *  • no `orig` (same currency, or a currency-aware form) → as given
 */
export function unviewEntry(updated, display) {
  if (!updated?.orig) return updated;
  const { orig, fxRate, ...rest } = updated;
  const moneyUntouched = MONEY_FIELDS.every((f) => !(f in orig) || rest[f] === round2(orig[f] * fxRate));
  if (moneyUntouched) return rawOf(updated);
  const { fx: _fx, ...inDisplay } = rest;
  return { ...inDisplay, currency: isCurrency(display) ? display : orig.currency };
}

/** Group stored-form entries by currency: { USD: [...], INR: [...] }. */
export function byCurrency(list) {
  const out = {};
  (list ?? []).forEach((e) => { const r = rawOf(e); (out[currencyOf(r)] ||= []).push(r); });
  return out;
}

/** Do these entries use more than one currency, or one other than `display`? */
export function isMixed(lists, display) {
  for (const list of lists) for (const e of list ?? []) if (currencyOf(e.orig ?? e) !== display) return true;
  return false;
}

/**
 * Balance valued at today's rates.
 * `balanceOf(txns, inc)` computes a balance in one currency (finance.computeStats).
 * Returns { total, parts: [{ currency, amount, rate, value }] } — parts sorted
 * biggest first, display currency included.
 */
export function liveBalance(txns, inc, display, rateFn, balanceOf) {
  const t = byCurrency(txns), i = byCurrency(inc);
  const codes = [...new Set([...Object.keys(t), ...Object.keys(i)])];
  const parts = codes.map((currency) => {
    const amount = round2(balanceOf(t[currency] ?? [], i[currency] ?? []));
    const rate = currency === display ? 1 : (rateFn(currency, display) || 1);
    return { currency, amount, rate, value: round2(amount * rate) };
  }).filter((p) => p.amount !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { total: round2(parts.reduce((s, p) => s + p.value, 0)), parts };
}

/* Plans in settings — budget limits, deductions, goal targets and monthly
   shares — are amounts "in your currency". When the display currency
   changes they can be re-stated at today's rate (rounded to whole units). */
const roundPlan = (n) => (n >= 100 ? Math.round(n) : round2(n));
export function convertSettingsMoney(settings, rate) {
  if (!(rate > 0) || rate === 1) return {};
  const conv = (v) => (typeof v === 'number' && isFinite(v) ? roundPlan(v * rate) : v);
  const patch = {};
  const b = settings?.budgets;
  if (b && typeof b === 'object') {
    patch.budgets = {
      ...b,
      ...(b.total != null ? { total: conv(b.total) } : {}),
      ...(b.categories ? { categories: Object.fromEntries(Object.entries(b.categories).map(([k, v]) => [k, conv(v)])) } : {}),
      ...(Array.isArray(b.deductions) ? { deductions: b.deductions.map((d) => ({ ...d, amount: conv(d.amount) })) } : {}),
    };
  }
  if (Array.isArray(settings?.goals) && settings.goals.length) {
    patch.goals = settings.goals.map((g) => ({ ...g, ...(g.target != null ? { target: conv(Number(g.target)) } : {}), ...(g.monthly != null ? { monthly: conv(Number(g.monthly)) } : {}) }));
  }
  return patch;
}
