// ─── useStats hook ───────────────────────────────────────────────
// Centralises ALL financial calculations used by StatsTab and DesktopDashboard.
import { useMemo } from "react";
import { filterItemsByPeriod } from "../utils/periodHelpers";
import { localDateKey, localMonthKey } from "../utils/dateHelpers";
import { computePersonDebts, computeStats, incomeKind, sumAmounts } from "../utils/finance";

// ─── Color palettes keyed by type/direction ───────────────────────────────────
// These are used for chart fills (Recharts doesn't support CSS vars in SVG attrs).
// Must stay in sync with the CSS variables in index.css.
const C_LIGHT = {
  income:       '#059669', // --income
  expense:      '#E11D48', // --expense
  savings:      '#2563EB', // --savings
  lent:         '#D97706', // --lent
  borrowed:     '#8B5CF6', // --borrowed
  repaymentRec: '#0891B2', // --repayment-rec
  given:        '#7C3AED', // --given
  external:     '#7C3AED', // --external
};
const C_DARK = {
  income:       '#10B981', // --income
  expense:      '#F43F5E', // --expense
  savings:      '#3B82F6', // --savings
  lent:         '#F59E0B', // --lent
  borrowed:     '#A78BFA', // --borrowed
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
  const personDebts = useMemo(
    () => computePersonDebts(transactions || [], income || []),
    [transactions, income]
  );

  const stats = useMemo(
    () => computeStats(filtTxns, filtInc, personDebts),
    [filtTxns, filtInc, personDebts]
  );

  /* ── Chart data ── */
  const pieData = useMemo(() => {
    const personTxns   = filtTxns.filter(t => t.type === 'person');
    const lentTotal    = personTxns.filter(t => t.direction === 'lent').reduce((s, t) => s + (t.amount ?? 0), 0);
    const repaidTotal  = personTxns.filter(t => t.direction === 'repaid').reduce((s, t) => s + (t.amount ?? 0), 0);
    const givenTotal   = personTxns.filter(t => t.direction === 'given_gift').reduce((s, t) => s + (t.amount ?? 0), 0);
    const repRecTotal  = sumAmounts(filtInc.filter(i => incomeKind(i) === 'repayment'));
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
    const key = localDateKey(d.toISOString());
    const onDay = transactions.filter(t => localDateKey(t.date) === key);
    return {
      day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0],
      Expense: sumAmounts(onDay.filter(t => t.type === 'expense')),
      Savings: sumAmounts(onDay.filter(t => t.type === 'savings')),
      Lent:    sumAmounts(onDay.filter(t => t.type === 'person' && t.direction === 'lent')),
    };
  }), [transactions]);

  const areaData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthInc   = income.filter(it => localMonthKey(it.date) === key);
      const monthTxns  = transactions.filter(t => localMonthKey(t.date) === key);
      const expTotal   = sumAmounts(monthTxns.filter(t => t.type === 'expense'));
      const savTotal   = sumAmounts(monthTxns.filter(t => t.type === 'savings'));
      const lentTotal  = sumAmounts(monthTxns.filter(t => t.type === 'person' && t.direction === 'lent'));
      const repaidTotal= sumAmounts(monthTxns.filter(t => t.type === 'person' && t.direction === 'repaid'));
      months.push({
        month:          d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        // All three income kinds are cash inflows
        Income:         sumAmounts(monthInc),
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
