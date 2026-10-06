// ─── CSV export ──────────────────────────────────────────────────
// Produces a file the app's own CSV importer (importHelpers.csvToRecords)
// accepts: the first four columns are date,name,amount,type; the rest are
// extra detail for spreadsheets.
import { localDateKey } from './dateHelpers';
import { incomeKind } from './finance';
import { categoryOf } from './categories';

export function csvEscape(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ['date', 'name', 'amount', 'type', 'category', 'direction', 'savingsType', 'platform', 'wasteAmount', 'note', 'id'];

export function recordsToCSV({ transactions = [], income = [] }, rules = {}) {
  const rows = [];
  transactions.forEach((t) => rows.push([
    localDateKey(t.date) ?? '', t.name, t.amount, t.type,
    categoryOf(t, rules) ?? '', t.direction ?? '', t.savingsType ?? '', t.platform ?? '',
    t.wasteAmount ?? '', t.note ?? '', t.id,
  ]));
  income.forEach((i) => rows.push([
    localDateKey(i.date) ?? '', i.name, i.amount, incomeKind(i),
    '', '', '', '', '', i.note ?? '', i.id,
  ]));
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return [CSV_HEADER, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}
