// ─── The month the app is looking at ─────────────────────────────
// One month for every page (see MonthSwitcher). Pages read it from the
// shell; outside the shell (tests) they fall back to the period they were
// given, then to the current month.
import { useShell } from './shellContext';
import { getCurrentMonthValue } from '../utils/periodHelpers';

export const monthName = (key, opts = { month: 'long', year: 'numeric' }) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', opts);
};

export const monthPeriod = (key) => ({ type: key === getCurrentMonthValue() ? 'current_month' : 'select_month', value: key });

/** { month: 'YYYY-MM', isNow, setMonth?, period } */
export function useViewMonth(selectedPeriod) {
  const shell = useShell();
  const fromPeriod = selectedPeriod && (selectedPeriod.type === 'current_month' || selectedPeriod.type === 'select_month') ? selectedPeriod.value : null;
  const month = shell?.month ?? fromPeriod ?? getCurrentMonthValue();
  return { month, isNow: month === getCurrentMonthValue(), setMonth: shell?.setMonth, period: monthPeriod(month) };
}
