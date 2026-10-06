// ─── Month-to-month carry forward ────────────────────────────────
// From a start month onwards, whatever was left at the end of a month
// becomes an inflow of the next one ("Carried forward from October 2026").
// The chain is cumulative: November's remainder (which already includes
// October's carry) rolls into December, and so on.
//
// Nothing is stored. Carry lines are synthetic income entries computed from
// the ledger on every render, so a late edit to October automatically
// corrects November. They are flagged isCarryForward and never editable.
//
// settings.carryForward = { enabled, startMonth: 'YYYY-MM', includeNegative }
import { localMonthKey } from './dateHelpers';
import { formatMonthLabel } from './periodHelpers';
import { computeStats } from './finance';

export const DEFAULT_CARRY_SETTINGS = { enabled: true, startMonth: '2026-11', includeNegative: false };

export function getCarrySettings(settings) {
  return { ...DEFAULT_CARRY_SETTINGS, ...(settings?.carryForward ?? {}) };
}

const pad2 = (n) => String(n).padStart(2, '0');
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Carry-in per month, for every month from startMonth to upToMonth.
 * @returns {{ [monthKey]: { amount: number, from: string, balance: number } }}
 *   amount  — what the month receives from the previous one
 *   from    — the month it came from
 *   balance — the previous month's closing balance before clamping
 */
export function computeCarryForward({ transactions = [], income = [], settings, upToMonth }) {
  const cfg = getCarrySettings(settings);
  if (!cfg.enabled || !/^\d{4}-\d{2}$/.test(cfg.startMonth || '')) return {};
  if (!upToMonth || upToMonth < cfg.startMonth) return {};

  const txByMonth = {}, incByMonth = {};
  transactions.forEach((t) => { const k = localMonthKey(t.date); if (k) (txByMonth[k] ||= []).push(t); });
  income.forEach((i) => { const k = localMonthKey(i.date); if (k) (incByMonth[k] ||= []).push(i); });

  const out = {};
  let carryIn = 0;                              // nothing flows into the month before startMonth
  let m = shiftMonth(cfg.startMonth, -1);
  let guard = 0;
  while (m < upToMonth && guard++ < 600) {
    const balance = round2(computeStats(txByMonth[m] ?? [], incByMonth[m] ?? [], {}).balance + carryIn);
    const next = cfg.includeNegative ? balance : Math.max(0, balance);
    const target = shiftMonth(m, 1);
    out[target] = { amount: round2(next), from: m, balance };
    carryIn = next;
    m = target;
  }
  return out;
}

/** The synthetic income entry shown for a month's carry-in. */
export function carryEntry(monthKey, { amount, from }) {
  const [y, mo] = monthKey.split('-').map(Number);
  return {
    id: `carry_${monthKey}`,
    name: `Carried forward from ${formatMonthLabel(from)}`,
    amount,
    type: 'income',
    date: new Date(y, mo - 1, 1, 0, 0, 1).toISOString(),   // first moment of the month, local time
    month: monthKey,
    isCarryForward: true,
    carriedFrom: from,
  };
}

/** income + synthetic carry entries (zero amounts are skipped). */
export function withCarryForward(income = [], transactions = [], settings, upToMonth) {
  const map = computeCarryForward({ transactions, income, settings, upToMonth });
  const extra = Object.entries(map).filter(([, v]) => v.amount !== 0).map(([k, v]) => carryEntry(k, v));
  return extra.length ? [...income, ...extra] : income;
}

export const isCarryForward = (entry) => !!entry?.isCarryForward;
