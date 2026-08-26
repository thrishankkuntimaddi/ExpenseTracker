// ─── useStats hook ───────────────────────────────────────────────
// Centralises ALL financial calculations used by StatsTab and DesktopDashboard.
import { useMemo } from "react";
import { filterItemsByPeriod } from "../utils/periodHelpers";

// ─── Color palettes keyed by type/direction ───────────────────────────────────
// These are used for chart fills (Recharts doesn't support CSS vars in SVG attrs).
// Must stay in sync with the CSS variables in index.css.
const C_LIGHT = {
  income:       '#059669', // --income
  expense:      '#E11D48', // --expense
  savings:      '#2563EB', // --savings
  lent:         '#D97706', // --lent
  borrowed:     '#DC2626', // --borrowed
  repaymentRec: '#0891B2', // --repayment-rec
  given:        '#7C3AED', // --given
  external:     '#7C3AED', // --external
};
const C_DARK = {
  income:       '#10B981', // --income
  expense:      '#F43F5E', // --expense
  savings:      '#3B82F6', // --savings
  lent:         '#F59E0B', // --lent
  borrowed:     '#F87171', // --borrowed
  repaymentRec: '#22D3EE', // --repayment-rec
  given:        '#A78BFA', // --given
  external:     '#8B5CF6', // --external
};

export function useStats(transactions, income, selectedPeriod, theme) {
  const C = theme === "monoflow" ? C_DARK : C_LIGHT;

  const filtTxns = useMemo(
    () => filterItemsByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod]
  );
  const filtInc = useMemo(
    () => filterItemsByPeriod(income, selectedPeriod),
    [income, selectedPeriod]
  );

  /* ── All-time person debt balances (carries over across months) ── */
  const personDebts = useMemo(() => {
    const map = {};
    (transactions || []).forEach(t => {
      if (t.type !== 'person' || !t.name) return;
      const name = t.name.trim();
      if (!name) return;
      if (!map[name]) map[name] = { borrowed: 0, repaid: 0, lent: 0, repaymentRec: 0 };
      const amt = t.amount ?? 0;
      if      (t.direction === 'borrowed')  map[name].borrowed     += amt;
      else if (t.direction === 'repaid')    map[name].repaid       += amt;
      else if (t.direction === 'lent')      map[name].lent         += amt;
      else if (t.direction === 'repayment') map[name].repaymentRec += amt;
    });

    (income || []).forEach(i => {
      if (!i.name) return;
      const name = i.name.trim();
      if (!name) return;
      if (!map[name]) map[name] = { borrowed: 0, repaid: 0, lent: 0, repaymentRec: 0 };
      if (i.isBorrowed)     map[name].borrowed     += (i.amount ?? 0);
      if (i.isRepaymentRec) map[name].repaymentRec += (i.amount ?? 0);
    });

    const balances = {};
    Object.keys(map).forEach(name => {
      const { borrowed, repaid, lent, repaymentRec } = map[name];
      const netOwed = Math.max(0, borrowed - repaid);   // Money I owe this person
      const netLent = Math.max(0, lent - repaymentRec); // Money this person owes me
      balances[name] = { borrowed, repaid, lent, repaymentRec, netOwed, netLent };
    });
    return balances;
  }, [transactions, income]);

  const stats = useMemo(() => {
    const personTxns      = filtTxns.filter(t => t.type === 'person');

    // Cash OUTFLOWS (money I gave out)
    const totalLent       = personTxns.filter(t => t.direction === 'lent').reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalRepaidThem = personTxns.filter(t => t.direction === 'repaid').reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalGivenGift  = personTxns.filter(t => t.direction === 'given_gift').reduce((s, t) => s + (t.amount ?? 0), 0);

    // Cash INFLOWS from person — 'repayment' entries now live in income (isRepaymentRec)
    const totalRepaymentRec = filtInc.filter(i => i.isRepaymentRec).reduce((s, i) => s + (i.amount ?? 0), 0);

    // Borrowed money (I took money from someone — cash inflow, but I owe it back)
    const borrowedTxnsAmt = personTxns.filter(t => t.direction === 'borrowed').reduce((s, t) => s + (t.amount ?? 0), 0);
    const borrowedIncAmt  = filtInc.filter(i => i.isBorrowed).reduce((s, i) => s + (i.amount ?? 0), 0);
    const totalBorrowed   = borrowedTxnsAmt + borrowedIncAmt;

    // Pure income = regular income entries (not borrowed, not repayment received)
    const pureIncome   = filtInc.filter(i => !i.isBorrowed && !i.isRepaymentRec).reduce((s, i) => s + (i.amount ?? 0), 0);
    const totalExpense = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalSavings = filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + (t.amount ?? 0), 0);

    // Total Income = regular income + borrowed money received + repayments received back from people I lent to
    const totalIncome = pureIncome + totalBorrowed + totalRepaymentRec;

    // All-time debt balances derived directly from personDebts map for 100% synchronization
    const allTimeNetOwed = Object.values(personDebts).reduce((s, p) => s + p.netOwed, 0);  // what I owe others
    const allTimeNetLent = Object.values(personDebts).reduce((s, p) => s + p.netLent, 0);  // what others owe me
    const allTimeNetPerson = allTimeNetLent - allTimeNetOwed;

    const totalWaste   = filtTxns.reduce((s, t) => s + (t.wasteAmount || 0), 0);

    const externalProfit = filtTxns
      .filter(t => t.type === 'external')
      .reduce((s, t) => s + ((t.settlement ?? t.amount) - t.amount), 0);

    // Balance = all cash inflows − all cash outflows
    // Inflows:  pureIncome, borrowed money, repayments received back
    // Outflows: expenses, savings, money lent to others, debt repaid to others, gifts given
    const balance = pureIncome + totalBorrowed + totalRepaymentRec + externalProfit
                    - totalExpense - totalSavings - totalLent - totalRepaidThem - totalGivenGift;

    const totalSpend = totalExpense + totalSavings + totalLent + totalRepaidThem + totalGivenGift;
    const wastePercent = totalSpend > 0 ? ((totalWaste / totalSpend) * 100).toFixed(1) : '0.0';

    const now = new Date();
    const all = [...filtTxns, ...filtInc];
    const firstDate = all.reduce((min, t) => { const d = new Date(t.date); return d < min ? d : min; }, now);
    const days   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
    const weeks  = Math.max(1, days / 7);
    const months = Math.max(1, days / 30);
    const spend  = totalExpense + totalLent + totalRepaidThem + totalGivenGift;

    return {
      totalIncome, pureIncome, totalExpense, totalSavings,
      totalLent, totalRepaidThem, totalBorrowed, totalRepaymentRec, totalGivenGift,
      allTimeNetOwed, allTimeNetLent, allTimeNetPerson, personDebts,
      totalWaste, externalProfit, balance, wastePercent,
      avgDay: spend / days, avgWeek: spend / weeks, avgMonth: spend / months,
    };
  }, [filtTxns, filtInc, transactions, personDebts]);

  /* ── Chart data ── */
  const pieData = useMemo(() => {
    const personTxns   = filtTxns.filter(t => t.type === 'person');
    const lentTotal    = personTxns.filter(t => t.direction === 'lent').reduce((s, t) => s + (t.amount ?? 0), 0);
    const repaidTotal  = personTxns.filter(t => t.direction === 'repaid').reduce((s, t) => s + (t.amount ?? 0), 0);
    const givenTotal   = personTxns.filter(t => t.direction === 'given_gift').reduce((s, t) => s + (t.amount ?? 0), 0);
    const repRecTotal  = filtInc.filter(i => i.isRepaymentRec).reduce((s, i) => s + (i.amount ?? 0), 0);
    return [
      { name: 'Expense',          value: filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0), color: C.expense      },
      { name: 'Savings',          value: filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + (t.amount ?? 0), 0), color: C.savings      },
      { name: 'Lent',             value: lentTotal,   color: C.lent         },
      { name: 'Debt Repaid',      value: repaidTotal, color: C.borrowed     },
      { name: 'Given (Gift)',     value: givenTotal,  color: C.given        },
      { name: 'Repayment Rec.',   value: repRecTotal, color: C.repaymentRec },
    ].filter(d => d.value > 0);
  }, [filtTxns, filtInc, C]);

  const barData = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toDateString();
    return {
      day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0],
      Expense: transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === key).reduce((s, t) => s + (t.amount ?? 0), 0),
      Savings: transactions.filter(t => t.type === 'savings' && new Date(t.date).toDateString() === key).reduce((s, t) => s + (t.amount ?? 0), 0),
      Lent:    transactions.filter(t => t.type === 'person' && t.direction === 'lent' && new Date(t.date).toDateString() === key).reduce((s, t) => s + (t.amount ?? 0), 0),
    };
  }), [transactions]);

  const areaData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const pureInc    = income.filter(it => it.date?.slice(0, 7) === key && !it.isBorrowed && !it.isRepaymentRec).reduce((s, it) => s + (it.amount ?? 0), 0);
      const borInc     = income.filter(it => it.date?.slice(0, 7) === key && it.isBorrowed).reduce((s, it) => s + (it.amount ?? 0), 0);
      const repRecInc  = income.filter(it => it.date?.slice(0, 7) === key && it.isRepaymentRec).reduce((s, it) => s + (it.amount ?? 0), 0);
      const expTotal   = transactions.filter(t => t.type === 'expense' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0);
      const savTotal   = transactions.filter(t => t.type === 'savings' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0);
      const lentTotal  = transactions.filter(t => t.type === 'person' && t.direction === 'lent' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0);
      const repaidTotal= transactions.filter(t => t.type === 'person' && t.direction === 'repaid' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0);
      months.push({
        month:          d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        Income:         pureInc + borInc + repRecInc,
        Expense:        expTotal,
        Savings:        savTotal,
        Lent:           lentTotal,
        'Debt Repaid':  repaidTotal,
      });
    }
    return months;
  }, [transactions, income]);

  const areaData4 = useMemo(() => areaData.slice(-4), [areaData]);

  return { stats, filtTxns, filtInc, pieData, barData, areaData, areaData4, C };
}
