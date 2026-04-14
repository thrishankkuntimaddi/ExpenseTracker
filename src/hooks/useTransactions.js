// ─── useTransactions ─────────────────────────────────────────────────────────
// Filters and groups a transaction list by the given period.
// Eliminates the duplicated filtTxns + grouped useMemo blocks that previously
// existed independently in both HistoryTab and DesktopDashboard.

import { useMemo } from 'react';
import { filterItemsByPeriod, getSmartGrouping } from '../utils/periodHelpers';
import { groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';

/**
 * @param {any[]}  transactions  — raw full transaction list (from Firestore)
 * @param {string} selectedPeriod — e.g. 'this-month', 'last-30', '2025-03'
 * @returns {{ filtTxns, grouped, grouping }}
 *   filtTxns — transactions that fall inside the selected period
 *   grouped  — filtTxns bucketed by day | week | month (auto-chosen by grouping)
 *   grouping — 'day' | 'week' | 'month'  (for label rendering)
 */
export function useTransactions(transactions, selectedPeriod) {
  const filtTxns = useMemo(
    () => filterItemsByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod],
  );

  const grouping = getSmartGrouping(selectedPeriod);

  const grouped = useMemo(() => {
    if (grouping === 'month') return groupByMonth(filtTxns);
    if (grouping === 'week')  return groupByWeek(filtTxns);
    return groupByDay(filtTxns);
  }, [filtTxns, grouping]);

  return { filtTxns, grouped, grouping };
}
