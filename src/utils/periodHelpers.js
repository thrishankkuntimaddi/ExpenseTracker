// ─── Period Helpers ────────────────────────────────────────────────

/* Returns YYYY-MM for today */
export function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/* Default period: current month */
export function getDefaultPeriod() {
  return { type: 'current_month', value: getCurrentMonthValue() };
}

/* Human-readable label for a period */
export function getPeriodLabel(period) {
  switch (period.type) {
    case 'current_month':
    case 'select_month': {
      const [y, m] = period.value.split('-');
      return new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    case 'year':
      return `Year ${period.value}`;
    case 'last_3_months':
      return 'Last 3 Months';
    case 'custom_range': {
      if (!period.start || !period.end) return 'Custom Range';
      const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return `${fmt(period.start)} – ${fmt(period.end)}`;
    }
    default: return 'Current Month';
  }
}

/* Get array of YYYY-MM strings for "last 3 months" */
export function getLast3Months() {
  const now = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/* Filter any array of items by a period (uses item.date ISO string) */
export function filterItemsByPeriod(items, period) {
  if (!items?.length) return [];
  switch (period.type) {
    case 'current_month':
    case 'select_month':
      return items.filter(item => item.date?.slice(0, 7) === period.value);
    case 'year':
      return items.filter(item => item.date?.slice(0, 4) === period.value);
    case 'last_3_months': {
      const months = getLast3Months();
      return items.filter(item => months.includes(item.date?.slice(0, 7)));
    }
    case 'custom_range':
      return items.filter(item => {
        const d = item.date?.slice(0, 10);
        return d >= period.start && d <= period.end;
      });
    default:
      return items;
  }
}

/* Get start Date of a period (for opening balance calculation) */
export function getPeriodStartDate(period) {
  switch (period.type) {
    case 'current_month':
    case 'select_month': {
      const [y, m] = period.value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    case 'year':
      return new Date(Number(period.value), 0, 1);
    case 'last_3_months': {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }
    case 'custom_range':
      return new Date(period.start + 'T00:00:00');
    default: {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}

/* Carry-forward opening balance = everything earned/spent BEFORE the period starts */
export function getOpeningBalance(period, transactions, income) {
  const startDate = getPeriodStartDate(period);
  const before = item => item.date && new Date(item.date) < startDate;

  const prevIncome  = income.filter(before).reduce((s, i) => s + i.amount, 0);
  const prevExpense = transactions.filter(t => before(t) && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevSavings = transactions.filter(t => before(t) && t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const prevPerson  = transactions.filter(t => before(t) && t.type === 'person').reduce((s, t) => s + t.amount, 0);

  return prevIncome - prevExpense - prevSavings - prevPerson;
}

/* Determine smart grouping for a period */
export function getSmartGrouping(period) {
  switch (period.type) {
    case 'current_month':
    case 'select_month': return 'day';
    case 'year':         return 'month';
    case 'last_3_months': return 'week';
    case 'custom_range': {
      if (!period.start || !period.end) return 'day';
      const days = (new Date(period.end) - new Date(period.start)) / 86400000;
      if (days > 90) return 'month';
      if (days > 31) return 'week';
      return 'day';
    }
    default: return 'day';
  }
}

/* Collect all unique YYYY-MM values from data + current month */
export function getAvailableMonths(transactions, income) {
  const months = new Set([getCurrentMonthValue()]);
  [...transactions, ...income].forEach(item => {
    if (item.date) months.add(item.date.slice(0, 7));
  });
  return Array.from(months).sort().reverse();
}

/* Collect all unique years from data + current year */
export function getAvailableYears(transactions, income) {
  const years = new Set([String(new Date().getFullYear())]);
  [...transactions, ...income].forEach(item => {
    if (item.date) years.add(item.date.slice(0, 4));
  });
  return Array.from(years).sort().reverse();
}

/* Add month field to a transaction/income item */
export function withMonth(item) {
  return item.month ? item : { ...item, month: item.date?.slice(0, 7) || getCurrentMonthValue() };
}

/* Format a YYYY-MM string into a human label */
export function formatMonthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
