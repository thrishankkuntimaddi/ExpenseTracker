// ─── Net worth ───────────────────────────────────────────────────
// What you own minus what you owe, from your entries plus anything you add
// by hand (a house, gold at today's price, PF balance, a car loan …).
// settings.netWorth = { items: [{ id, name, value, kind: 'asset' | 'liability' }] }
import { computeStats } from './finance';
import { SAVINGS_TYPES } from './typeConfig';
import { debtLedger, debtTotals } from './debts';
import { respSummary } from './responsibilities';
import { computeCarryForward } from './carryForward';
import { localMonthKey } from './dateHelpers';

const amt = (t) => Number(t?.amount) || 0;

export function netWorth({ transactions = [], income = [], settings = {}, todayKey }) {
  const live = transactions.filter((t) => !t.isCarryForward);
  const liveIn = income.filter((i) => !i.isCarryForward);
  // Money in hand / bank: the Balance Home shows — this month's money in minus
  // out, plus what was carried forward into it. NOT every rupee ever logged:
  // months before carry-forward started are over, and what was left of them
  // isn't sitting anywhere (that used to inflate this number).
  const monthKey = (todayKey || localMonthKey(new Date().toISOString())).slice(0, 7);
  const inMonth = (list) => list.filter((x) => localMonthKey(x.date) === monthKey);
  const carry = computeCarryForward({ transactions: live, income: liveIn, settings, upToMonth: monthKey })[monthKey];
  const carried = carry?.amount ?? 0;
  const monthStats = computeStats(inMonth(live), inMonth(liveIn), {});
  const stats = { balance: Math.round((monthStats.balance + carried) * 100) / 100 };
  const balanceHint = carried
    ? 'This month’s money in − out, plus last month’s leftover — the Balance on Home'
    : 'This month’s money in − out — the Balance on Home';
  // Savings by type; money taken out of savings comes off the total
  const byType = {};
  live.filter((t) => t.type === 'savings').forEach((t) => { const k = t.savingsType ?? 'other'; byType[k] = (byType[k] ?? 0) + amt(t); });
  const usedFromSavings = live.filter((t) => t.type === 'expense' && t.paidFrom === 'savings').reduce((s, t) => s + amt(t), 0);
  const savingsRows = SAVINGS_TYPES.filter((s) => byType[s.key] > 0).map((s) => ({ key: `sav-${s.key}`, label: s.label, value: byType[s.key] }));
  if (usedFromSavings > 0) savingsRows.push({ key: 'sav-used', label: 'Taken out of savings', value: -usedFromSavings });
  const debts = debtTotals(debtLedger(transactions, income));
  const resp = respSummary(settings?.responsibilities ?? [], transactions, todayKey);
  const manual = Array.isArray(settings?.netWorth?.items) ? settings.netWorth.items.filter((i) => i && Number(i.value) > 0) : [];

  const assets = [
    { key: 'balance', label: 'Money in hand & bank', value: Math.max(0, stats.balance), auto: true, hint: balanceHint, link: 'today' },
    ...savingsRows.map((r) => ({ ...r, auto: true, hint: r.key === 'sav-used' ? 'Expenses you marked “paid from savings”' : 'Everything you logged as this kind of saving, all time' })),
    ...(debts.owedToYou > 0 ? [{ key: 'owed', label: 'Owed to you', value: debts.owedToYou, auto: true, hint: 'Money you lent that hasn’t come back — see Debts', link: 'people' }] : []),
    ...manual.filter((i) => i.kind !== 'liability').map((i) => ({ key: i.id, label: i.name, value: Number(i.value), id: i.id, hint: 'Added by you' })),
  ];
  const liabilities = [
    ...(stats.balance < 0 ? [{ key: 'overdrawn', label: 'Spent more than came in', value: -stats.balance, auto: true, hint: 'This month you are below zero' }] : []),
    ...(debts.youOwe > 0 ? [{ key: 'owe', label: 'You owe people', value: debts.youOwe, auto: true, hint: 'Borrowed and not yet paid back — see Debts', link: 'people' }] : []),
    ...(resp.remaining > 0 ? [{ key: 'resp', label: 'Responsibilities left', value: resp.remaining, auto: true, hint: 'What is still to clear in Responsibilities', link: 'responsibilities' }] : []),
    ...manual.filter((i) => i.kind === 'liability').map((i) => ({ key: i.id, label: i.name, value: Number(i.value), id: i.id })),
  ];
  const total = (l) => Math.round(l.reduce((s, x) => s + x.value, 0) * 100) / 100;
  const a = total(assets), l = total(liabilities);
  return { assets, liabilities, totalAssets: a, totalLiabilities: l, netWorth: Math.round((a - l) * 100) / 100 };
}
