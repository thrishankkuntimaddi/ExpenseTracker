// ─── What the home-screen widgets show ───────────────────────────
// A small, flat object the native widgets read (Android stores it in
// SharedPreferences). Strings arrive already formatted, so the widgets never
// do maths or currency formatting themselves. Pure — unit-tested.
// settings.widgets = { headline: 'safe' | 'left' | 'spent', chart: true, theme: 'auto' | 'light' | 'dark' }
import { localDateKey, localMonthKey } from './dateHelpers';
import { computeBudgetStatus } from './budget';
import { upcomingBills, dueLabel } from './bills';
import { toKey, fromKey } from './recurring';

export const WIDGET_DEFAULTS = { headline: 'safe', chart: true, theme: 'auto' };

export function widgetData({ transactions = [], income = [], settings = {}, rules = [], now = new Date(), money }) {
  const prefs = { ...WIDGET_DEFAULTS, ...(settings?.widgets ?? {}) };
  const todayKey = toKey(now);
  const monthKey = todayKey.slice(0, 7);
  const exp = transactions.filter((t) => t.type === 'expense' && !t.isCarryForward);
  const spent = exp.filter((t) => localMonthKey(t.date) === monthKey).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const today = exp.filter((t) => localDateKey(t.date) === todayKey).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const status = computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey, rules: settings?.categoryRules ?? {}, now });
  const total = status.total.limit ? status.total : null;

  // The big number, as chosen in Profile → Widgets (falls back when there's no budget)
  let headline = prefs.headline;
  if (!total && headline !== 'spent') headline = 'spent';
  const big = headline === 'safe' ? { label: 'Safe to spend today', value: money(Math.max(0, total.safeToday ?? 0)) }
    : headline === 'left' ? { label: total.remaining >= 0 ? 'Left in budget' : 'Over budget', value: money(Math.abs(total.remaining)) }
    : { label: 'Spent this month', value: money(spent) };

  // Last seven days, oldest first
  const days = Array.from({ length: 7 }, (_, i) => { const d = fromKey(todayKey); d.setDate(d.getDate() - (6 - i)); return toKey(d); });
  const byDay = Object.fromEntries(days.map((k) => [k, 0]));
  exp.forEach((t) => { const k = localDateKey(t.date); if (k in byDay) byDay[k] += Number(t.amount) || 0; });
  const week = days.map((k) => ({ label: 'SMTWTFS'[fromKey(k).getDay()], value: Math.round(byDay[k]) }));

  const ids = new Set([...transactions, ...income].map((e) => e.id));
  const bills = upcomingBills(rules, ids, todayKey, 30).slice(0, 3).map((b) => ({
    name: String(b.rule.name).slice(0, 28), when: dueLabel(b.dateKey, todayKey), amount: money(b.amount), late: b.status === 'overdue',
  }));

  return {
    v: 1, updatedAt: now.getTime(), theme: prefs.theme, chart: !!prefs.chart,
    month: now.toLocaleDateString('en-IN', { month: 'long' }),
    bigLabel: big.label, bigValue: big.value,
    spent: money(spent), today: money(today),
    budget: total ? money(total.limit) : '', pct: total ? Math.min(100, Math.round((total.spent / total.limit) * 100)) : -1,
    over: !!(total && total.remaining < 0),
    week, bills,
  };
}
