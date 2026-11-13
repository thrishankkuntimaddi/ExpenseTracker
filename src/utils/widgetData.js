// ─── What the home-screen widgets show ───────────────────────────
// A small, flat object the native widgets read (Android stores it in
// SharedPreferences). Strings arrive already formatted, so the widgets never
// do maths or currency formatting themselves. Pure — unit-tested.
// settings.widgets = { headline: 'balance' | 'safe' | 'left' | 'spent', chart: true, theme: 'auto' | 'light' | 'dark' }
// `raw` carries the same figures as plain numbers, so an entry typed on the
// home screen (the quick-entry card) can move them before the app next opens.
import { localDateKey, localMonthKey } from './dateHelpers';
import { computeBudgetStatus } from './budget';
import { upcomingBills, dueLabel } from './bills';
import { toKey, fromKey } from './recurring';
import { computeStats } from './finance';
import { computeCarryForward } from './carryForward';

export const WIDGET_DEFAULTS = { headline: 'safe', chart: true, theme: 'auto' };

export function widgetData({ transactions = [], income = [], settings = {}, rules = [], now = new Date(), money, symbol = '₹' }) {
  const prefs = { ...WIDGET_DEFAULTS, ...(settings?.widgets ?? {}) };
  const todayKey = toKey(now);
  const monthKey = todayKey.slice(0, 7);
  const exp = transactions.filter((t) => t.type === 'expense' && !t.isCarryForward);
  const spent = exp.filter((t) => localMonthKey(t.date) === monthKey).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const today = exp.filter((t) => localDateKey(t.date) === todayKey).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const status = computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey, rules: settings?.categoryRules ?? {}, now });
  const total = status.total.limit ? status.total : null;

  // Balance: this month's money in − out with what was carried in — the number on Home
  const live = transactions.filter((t) => !t.isCarryForward), liveIn = income.filter((i) => !i.isCarryForward);
  const inMonth = (list) => list.filter((x) => localMonthKey(x.date) === monthKey);
  const carried = computeCarryForward({ transactions: live, income: liveIn, settings, upToMonth: monthKey })[monthKey]?.amount ?? 0;
  const balance = Math.round((computeStats(inMonth(live), inMonth(liveIn), {}).balance + carried) * 100) / 100;

  // The big number, as chosen in Profile → Widgets (without a budget: the balance)
  let headline = prefs.headline;
  if (!total && (headline === 'safe' || headline === 'left')) headline = 'balance';
  const big = headline === 'safe' ? { label: 'Safe to spend today', n: Math.max(0, total.safeToday ?? 0), mode: 'left' }
    : headline === 'left' ? { label: total.remaining >= 0 ? 'Left in budget' : 'Over budget', n: Math.abs(total.remaining), mode: total.remaining >= 0 ? 'left' : 'spent' }
    : headline === 'spent' ? { label: 'Spent this month', n: spent, mode: 'spent' }
    : { label: 'Balance', n: balance, mode: 'balance' };
  big.value = big.mode === 'balance' && big.n < 0 ? `−${money(-big.n)}` : money(big.n);
  // Beside "Today": whichever of spent / balance the big number isn't
  const side = headline === 'spent' ? { label: 'Balance', n: balance, mode: 'balance' } : { label: 'Spent', n: spent, mode: 'spent' };

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
    sideLabel: side.label, sideValue: side.n < 0 ? `−${money(-side.n)}` : money(side.n),
    spent: money(spent), today: money(today),
    raw: { symbol, big: big.n, bigMode: big.mode, side: side.n, sideMode: side.mode, today, spent, balance },
    budget: total ? money(total.limit) : '', pct: total ? Math.min(100, Math.round((total.spent / total.limit) * 100)) : -1,
    over: !!(total && total.remaining < 0),
    week, bills,
  };
}

/**
 * Entries typed on the home screen → ledger entries. The id comes from the
 * phone's queue, so the same item always becomes the same entry.
 * items: [{ id, kind: 'expense' | 'income' | 'savings', amount, name, at }]
 */
export function queuedEntries(items = []) {
  const transactions = [], income = [], ids = [];
  for (const it of Array.isArray(items) ? items : []) {
    const amount = Math.round((Number(it?.amount) || 0) * 100) / 100;
    if (!it?.id) continue;
    ids.push(String(it.id));                       // even a bad one leaves the queue
    if (!(amount > 0)) continue;
    const when = new Date(Number(it.at) || Date.now());
    const date = when.toISOString();
    const base = { id: `w_${String(it.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}`, amount, date, month: localMonthKey(date), fromWidget: true };
    const name = String(it.name ?? '').trim().slice(0, 120);
    if (it.kind === 'income') income.push({ ...base, type: 'income', name: name || 'Money in' });
    else if (it.kind === 'savings') transactions.push({ ...base, type: 'savings', name: name || 'Savings', savingsType: 'other' });
    else transactions.push({ ...base, type: 'expense', name: name || 'Expense' });
  }
  return { transactions, income, ids };
}
