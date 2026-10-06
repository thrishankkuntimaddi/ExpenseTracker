// ─── Insights engine ─────────────────────────────────────────────
// Rule-based, fully offline: turns the ledger into short plain-language
// observations ("Food is up 32 % vs last month", "5 no-spend days").
// Pure function, unit-tested; nothing here touches React or Firestore.
import { localDateKey, localMonthKey, formatAmount } from './dateHelpers';
import { sumAmounts, computePersonDebts, incomeKind } from './finance';
import { categoryOf, categoryMeta, categoryTotals } from './categories';
import { monthlyEquivalent } from './recurring';

const pad2 = (n) => String(n).padStart(2, '0');
const monthKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const prevMonthKey = (key) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 2, 1); return monthKeyOf(d); };
const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const fmtPct = (p) => `${Math.abs(Math.round(p))}%`;
const money = (n) => formatAmount(Math.round(n));

/**
 * @returns {Array<{ id, tone: 'good'|'bad'|'info', title, detail, priority }>}
 *   sorted by priority (lower first). tone drives the colour in the UI.
 */
export function generateInsights({
  transactions = [], income = [], now = new Date(), rules = {},
  budgetStatus = null, recurringRules = [], limit = 8,
} = {}) {
  const out = [];
  const push = (id, tone, title, detail, priority = 50) => out.push({ id, tone, title, detail, priority });

  const thisKey = monthKeyOf(now);
  const lastKey = prevMonthKey(thisKey);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const exp = transactions.filter((t) => t.type === 'expense');
  const thisExp = exp.filter((t) => localMonthKey(t.date) === thisKey);
  const lastExp = exp.filter((t) => localMonthKey(t.date) === lastKey);
  // Same-day-count slice of last month so month-to-date comparisons are fair
  const lastExpToDate = lastExp.filter((t) => new Date(t.date).getDate() <= dayOfMonth);

  const thisTotal = sumAmounts(thisExp);
  const lastTotal = sumAmounts(lastExp);
  const lastToDate = sumAmounts(lastExpToDate);

  /* 1 ── Month-to-date vs same point last month */
  if (thisExp.length && lastExpToDate.length) {
    const ch = pctChange(thisTotal, lastToDate);
    if (ch != null && Math.abs(ch) >= 5) {
      push('mtd-vs-last', ch > 0 ? 'bad' : 'good',
        `Spending ${ch > 0 ? 'up' : 'down'} ${fmtPct(ch)} vs this time last month`,
        `${money(thisTotal)} so far, against ${money(lastToDate)} by the ${dayOfMonth}${ordinal(dayOfMonth)} last month.`,
        ch > 0 ? 10 : 20);
    } else if (ch != null) {
      push('mtd-flat', 'info', 'Spending is on par with last month',
        `${money(thisTotal)} so far vs ${money(lastToDate)} at this point last month.`, 60);
    }
  }

  /* 2 ── Projected month end */
  if (dayOfMonth >= 5 && thisExp.length && lastTotal > 0 && dayOfMonth < daysInMonth) {
    const projected = (thisTotal / dayOfMonth) * daysInMonth;
    const ch = pctChange(projected, lastTotal);
    if (ch != null && Math.abs(ch) >= 8) {
      push('projection', ch > 0 ? 'bad' : 'good',
        `On pace to ${ch > 0 ? 'spend' : 'save'} ${fmtPct(ch)} ${ch > 0 ? 'more' : 'less'} than last month`,
        `Projected ${money(projected)} by month end; last month closed at ${money(lastTotal)}.`, 15);
    }
  }

  /* 3 ── Top category + its movement */
  const thisCats = categoryTotals(thisExp, rules);
  const lastCatsToDate = Object.fromEntries(categoryTotals(lastExpToDate, rules).map((c) => [c.key, c.amount]));
  if (thisCats.length) {
    const top = thisCats[0];
    const prev = lastCatsToDate[top.key] ?? 0;
    const ch = pctChange(top.amount, prev);
    const move = ch == null ? '' : ` · ${ch >= 0 ? '↑' : '↓'} ${fmtPct(ch)} vs last month`;
    push('top-category', ch != null && ch >= 25 ? 'bad' : 'info',
      `${top.label} is your biggest category — ${Math.round(top.share)}% of spending`,
      `${money(top.amount)} across ${top.count} entr${top.count === 1 ? 'y' : 'ies'}${move}.`, ch != null && ch >= 25 ? 12 : 30);

    // A category that jumped sharply (not the top one)
    const jumper = thisCats.slice(1).map((c) => ({ ...c, ch: pctChange(c.amount, lastCatsToDate[c.key] ?? 0) }))
      .filter((c) => c.ch != null && c.ch >= 50 && c.amount >= 500)
      .sort((a, b) => b.ch - a.ch)[0];
    if (jumper) {
      push('category-jump', 'bad', `${jumper.label} is up ${fmtPct(jumper.ch)} this month`,
        `${money(jumper.amount)} vs ${money(lastCatsToDate[jumper.key])} by this point last month.`, 14);
    }
  }

  /* 4 ── Most frequent merchant */
  const freq = {};
  thisExp.forEach((t) => {
    const k = String(t.name ?? '').trim().toLowerCase();
    if (!k) return;
    freq[k] = freq[k] || { name: t.name.trim(), count: 0, paise: 0 };
    freq[k].count++; freq[k].paise += Math.round((Number(t.amount) || 0) * 100);
  });
  const topMerchant = Object.values(freq).sort((a, b) => b.count - a.count || b.paise - a.paise)[0];
  if (topMerchant && topMerchant.count >= 3) {
    push('top-merchant', 'info', `${topMerchant.name} ×${topMerchant.count} this month`,
      `${money(topMerchant.paise / 100)} in total — about ${money(topMerchant.paise / 100 / topMerchant.count)} each time.`, 35);
  }

  /* 5 ── No-spend days */
  if (dayOfMonth >= 3) {
    const spentDays = new Set(thisExp.map((t) => localDateKey(t.date)));
    const noSpend = dayOfMonth - spentDays.size;
    if (noSpend >= 1 && thisExp.length) {
      push('no-spend', 'good', `${noSpend} no-spend day${noSpend === 1 ? '' : 's'} this month`,
        `You logged nothing on ${noSpend} of ${dayOfMonth} days so far. Streaks like this move the needle.`, noSpend >= 5 ? 22 : 45);
    }
  }

  /* 6 ── Last 7 days vs previous 7 */
  const dayKeysBack = (from, n) => Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - from - i); return localDateKey(d.toISOString()); });
  const w1 = new Set(dayKeysBack(0, 7)), w2 = new Set(dayKeysBack(7, 7));
  const w1Total = sumAmounts(exp.filter((t) => w1.has(localDateKey(t.date))));
  const w2Total = sumAmounts(exp.filter((t) => w2.has(localDateKey(t.date))));
  if (w1Total > 0 && w2Total > 0) {
    const ch = pctChange(w1Total, w2Total);
    if (Math.abs(ch) >= 15) {
      push('week-vs-week', ch > 0 ? 'bad' : 'good',
        `This week ${ch > 0 ? 'up' : 'down'} ${fmtPct(ch)} on last week`,
        `${money(w1Total)} in the last 7 days vs ${money(w2Total)} the week before.`, ch > 0 ? 18 : 28);
    }
  }

  /* 7 ── Weekend vs weekday daily average */
  const byDay = {};
  thisExp.forEach((t) => { const k = localDateKey(t.date); byDay[k] = (byDay[k] ?? 0) + (Number(t.amount) || 0); });
  const dayKeys = Object.keys(byDay);
  if (dayKeys.length >= 6) {
    const we = [], wd = [];
    dayKeys.forEach((k) => { const d = new Date(k); (d.getDay() === 0 || d.getDay() === 6 ? we : wd).push(byDay[k]); });
    if (we.length >= 2 && wd.length >= 3) {
      const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      const ratio = avg(we) / avg(wd);
      if (ratio >= 1.4) push('weekend', 'info', `Weekends cost ${ratio.toFixed(1)}× a weekday`,
        `Avg ${money(avg(we))} on weekend days vs ${money(avg(wd))} on weekdays this month.`, 40);
    }
  }

  /* 8 ── Wastage */
  const thisWaste = sumAmounts(thisExp, (t) => t.wasteAmount || 0);
  const lastWaste = sumAmounts(lastExpToDate, (t) => t.wasteAmount || 0);
  if (thisWaste > 0) {
    const share = thisTotal > 0 ? (thisWaste / thisTotal) * 100 : 0;
    const ch = pctChange(thisWaste, lastWaste);
    push('waste', share >= 15 ? 'bad' : 'info',
      `${money(thisWaste)} marked as wasted — ${share.toFixed(0)}% of spending`,
      ch == null ? 'Tap an entry in History to mark it as wasted.' : `${ch >= 0 ? 'Up' : 'Down'} ${fmtPct(ch)} vs this point last month.`,
      share >= 15 ? 13 : 42);
  } else if (thisExp.length >= 5 && lastWaste > 0) {
    push('no-waste', 'good', 'Zero wastage logged this month', `Last month you had ${money(lastWaste)} by this point.`, 25);
  }

  /* 9 ── Savings rate */
  const thisInc = income.filter((i) => localMonthKey(i.date) === thisKey && incomeKind(i) === 'income');
  const incTotal = sumAmounts(thisInc);
  const savTotal = sumAmounts(transactions.filter((t) => t.type === 'savings' && localMonthKey(t.date) === thisKey));
  if (incTotal > 0) {
    const rate = (savTotal / incTotal) * 100;
    push('savings-rate', rate >= 20 ? 'good' : rate >= 10 ? 'info' : 'bad',
      `Savings rate ${rate.toFixed(0)}% of income`,
      rate >= 20 ? `${money(savTotal)} saved from ${money(incTotal)} — above the 20% guideline.`
        : `${money(savTotal)} saved from ${money(incTotal)}. 20% is a common target.`,
      rate >= 20 ? 26 : 24);
  }

  /* 10 ── Biggest single expense */
  const biggest = thisExp.slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
  if (biggest && thisTotal > 0 && biggest.amount / thisTotal >= 0.2 && thisExp.length >= 3) {
    push('biggest', 'info', `"${biggest.name}" alone is ${Math.round((biggest.amount / thisTotal) * 100)}% of the month`,
      `${money(biggest.amount)} on ${new Date(biggest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${categoryMeta(categoryOf(biggest, rules)).label}.`, 38);
  }

  /* 11 ── Outstanding lending */
  const debts = computePersonDebts(transactions, income);
  const owedToMe = Object.entries(debts).filter(([, d]) => d.netLent > 0).sort((a, b) => b[1].netLent - a[1].netLent);
  if (owedToMe.length) {
    const [name, d] = owedToMe[0];
    const totalOwed = owedToMe.reduce((s, [, x]) => s + x.netLent, 0);
    push('owed', 'info', `${money(totalOwed)} is still owed to you`,
      owedToMe.length === 1 ? `${name} owes ${money(d.netLent)}.` : `${name} owes the most (${money(d.netLent)}); ${owedToMe.length - 1} other${owedToMe.length === 2 ? '' : 's'} also pending.`, 36);
  }
  const iOwe = Object.values(debts).reduce((s, d) => s + d.netOwed, 0);
  if (iOwe > 0) push('i-owe', 'bad', `You owe ${money(iOwe)} to others`, 'Settle from the Expenses tab → Person → Debt Repayment.', 19);

  /* 12 ── Budget alerts */
  if (budgetStatus?.hasBudget) {
    const t = budgetStatus.total;
    if (t.limit) {
      if (t.status === 'over') push('budget-over', 'bad', `Over budget by ${money(t.spent - t.limit)}`,
        `${money(t.spent)} spent against a ${money(t.limit)} monthly budget.`, 5);
      else if (t.status === 'warn') push('budget-warn', 'bad', `${Math.round(t.pct)}% of the monthly budget used`,
        `${money(t.remaining)} left for ${budgetStatus.daysLeft} more day${budgetStatus.daysLeft === 1 ? '' : 's'}.`, 7);
      else if (t.status === 'pace') push('budget-pace', 'bad', 'At this pace you will exceed the budget',
        `Projected ${money(t.projected)} vs ${money(t.limit)}. Safe to spend today: ${money(t.safeToday ?? 0)}.`, 9);
      else if (budgetStatus.isCurrent && t.safeToday != null) push('budget-ok', 'good', `Budget on track — ${money(t.safeToday)} safe to spend today`,
        `${money(t.remaining)} left with ${Math.round(100 - t.pct)}% of the budget and ${Math.round(100 - budgetStatus.pacePct)}% of the month remaining.`, 27);
    }
    budgetStatus.categories.filter((c) => c.status === 'over' || c.status === 'warn').slice(0, 2).forEach((c) => {
      push(`budget-cat-${c.key}`, 'bad', `${c.label}: ${Math.round(c.pct)}% of its budget`,
        c.status === 'over' ? `Over by ${money(c.spent - c.limit)}.` : `${money(c.remaining)} left this month.`, 8);
    });
  }

  /* 13 ── Recurring commitments */
  const committed = recurringRules.filter((r) => r.active !== false && r.kind === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  if (committed > 0) {
    const avgIncome = (() => {
      const months = {};
      income.filter((i) => incomeKind(i) === 'income').forEach((i) => { const k = localMonthKey(i.date); months[k] = (months[k] ?? 0) + (Number(i.amount) || 0); });
      const vals = Object.values(months);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    })();
    push('committed', 'info', `${money(committed)}/month goes to recurring expenses`,
      avgIncome > 0 ? `That is ${Math.round((committed / avgIncome) * 100)}% of your average monthly income.` : 'Rent, EMIs and subscriptions set up in Plan.', 44);
  }

  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, limit);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
