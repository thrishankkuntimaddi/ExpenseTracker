// ─── useStats hook ───────────────────────────────────────────────
// Centralises ALL financial calculations used by StatsTab and DesktopDashboard.
import { useMemo } from "react";
import { filterItemsByPeriod } from "../utils/periodHelpers";

const C_LIGHT = {
  expense: "#DC2626", savings: "#2563EB",
  person:  "#D97706", income:  "#16A34A",
  lent:    "#D97706", repayment: "#16A34A",
};
const C_DARK = {
  expense: "#e05252", savings: "#6b8dd6",
  person:  "#c9943a", income:  "#5aba8a",
  lent:    "#c9943a", repayment: "#5aba8a",
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

  const stats = useMemo(() => {
    const totalIncome  = filtInc.reduce((s, i) => s + (i.amount ?? 0), 0);
    const totalExpense = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalSavings = filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + (t.amount ?? 0), 0);

    // Person: separate lent vs repayment
    const personTxns  = filtTxns.filter(t => t.type === 'person');
    const totalLent   = personTxns.filter(t => t.direction !== 'repayment').reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalRepaid = personTxns.filter(t => t.direction === 'repayment').reduce((s, t) => s + (t.amount ?? 0), 0);
    const netLent     = totalLent - totalRepaid;  // outstanding (positive = I am owed money)
    // Legacy: totalPerson kept for backward compat (net amount of person transactions)
    const totalPerson = totalLent;

    const totalWaste   = filtTxns.reduce((s, t) => s + (t.wasteAmount || 0), 0);

    // External: amount paid is NOT an expense — only the net profit/loss counts
    const externalProfit = filtTxns
      .filter(t => t.type === 'external')
      .reduce((s, t) => s + ((t.settlement ?? t.amount) - t.amount), 0);

    // Balance: income minus outflows. Lent money is an outflow but repayments flow back.
    const balance    = totalIncome + externalProfit - totalExpense - totalSavings - netLent;
    const totalSpend = totalExpense + totalSavings + netLent;
    const wastePercent = totalSpend > 0 ? ((totalWaste / totalSpend) * 100).toFixed(1) : '0.0';

    const now = new Date();
    const all = [...filtTxns, ...filtInc];
    const firstDate = all.reduce((min, t) => { const d = new Date(t.date); return d < min ? d : min; }, now);
    const days   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
    const weeks  = Math.max(1, days / 7);
    const months = Math.max(1, days / 30);
    const spend  = totalExpense + netLent;

    return {
      totalIncome, totalExpense, totalSavings,
      totalPerson, totalLent, totalRepaid, netLent,
      totalWaste, externalProfit, balance, wastePercent,
      avgDay: spend / days, avgWeek: spend / weeks, avgMonth: spend / months,
    };
  }, [filtTxns, filtInc]);

  /* ── Chart data ── */
  const pieData = useMemo(() => {
    const personTxns = filtTxns.filter(t => t.type === 'person');
    const lentTotal  = personTxns.filter(t => t.direction !== 'repayment').reduce((s, t) => s + (t.amount ?? 0), 0);
    const repaidTotal = personTxns.filter(t => t.direction === 'repayment').reduce((s, t) => s + (t.amount ?? 0), 0);
    return [
      { name: "Expense",   value: filtTxns.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount ?? 0), 0), color: C.expense  },
      { name: "Savings",   value: filtTxns.filter(t => t.type === "savings").reduce((s, t) => s + (t.amount ?? 0), 0), color: C.savings  },
      { name: "Lent",      value: lentTotal,   color: C.lent      },
      { name: "Repayment", value: repaidTotal,  color: C.repayment },
    ].filter(d => d.value > 0);
  }, [filtTxns, C]);

  const barData = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toDateString();
    return {
      day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }).split(" ")[0],
      Expense: transactions.filter(t => t.type === "expense" && new Date(t.date).toDateString() === key).reduce((s, t) => s + (t.amount ?? 0), 0),
      Savings: transactions.filter(t => t.type === "savings" && new Date(t.date).toDateString() === key).reduce((s, t) => s + (t.amount ?? 0), 0),
    };
  }), [transactions]);

  const areaData = useMemo(() => {
    // Start from Feb 2025, end at current month — full history
    const start = new Date(2025, 1, 1); // Feb 2025
    const now   = new Date();
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = [];
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month:   cur.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        Income:  income.filter(it => it.date?.slice(0, 7) === key).reduce((s, it) => s + (it.amount ?? 0), 0),
        Expense: transactions.filter(t => t.type === 'expense' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0),
        Savings: transactions.filter(t => t.type === 'savings' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0),
        Lent:    transactions.filter(t => t.type === 'person' && t.direction !== 'repayment' && t.date?.slice(0, 7) === key).reduce((s, t) => s + (t.amount ?? 0), 0),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [transactions, income]);

  return { stats, filtTxns, filtInc, pieData, barData, areaData, C };
}
