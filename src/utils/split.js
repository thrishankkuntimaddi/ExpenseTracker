// ─── Trip / group expense splitting ──────────────────────────────
// A trip has members, optional pay-groups (members who settle as one wallet,
// e.g. a couple), expenses paid by one member and split equally among a
// chosen subset, and settlements already made. Everything here is pure.
//
// trip = {
//   id, name, startDate, endDate?, status: 'open'|'closed', meMemberId?,
//   members:     [{ id, name, groupId? }],
//   expenses:    [{ id, title, amount, paidBy: memberId, splitAmong: memberId[] (empty = everyone), date, category? }],
//   settlements: [{ id, fromUnit, toUnit, amount, date, note? }],
// }
import { sumAmounts } from './finance';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A "unit" settles as one wallet: a pay-group, or a single member. */
export function unitIdOf(member) {
  return member.groupId ? `g:${member.groupId}` : `m:${member.id}`;
}

export function buildUnits(members = []) {
  const map = new Map();
  members.forEach((m) => {
    const id = unitIdOf(m);
    if (!map.has(id)) map.set(id, { id, memberIds: [], names: [] });
    const u = map.get(id);
    u.memberIds.push(m.id);
    u.names.push(m.name);
  });
  return [...map.values()].map((u) => ({ ...u, name: u.names.join(' & ') }));
}

/** Equal split of one expense: { memberId: shareAmount } (last member absorbs rounding). */
export function expenseShares(expense, members = []) {
  const ids = (expense.splitAmong?.length ? expense.splitAmong : members.map((m) => m.id))
    .filter((id) => members.some((m) => m.id === id));
  if (!ids.length) return {};
  const paise = Math.round((Number(expense.amount) || 0) * 100);
  const base = Math.floor(paise / ids.length);
  const remainder = paise - base * ids.length;
  const out = {};
  ids.forEach((id, i) => { out[id] = (base + (i < remainder ? 1 : 0)) / 100; });
  return out;
}

/**
 * Greedy minimal-transfer settlement over unit balances.
 * balances: { unitId: net }  (+ = should receive, − = owes)
 * @returns [{ from, to, amount }]
 */
export function settleTransfers(balances) {
  const debtors = [], creditors = [];
  Object.entries(balances).forEach(([id, v]) => {
    const p = Math.round(v * 100);
    if (p < 0) debtors.push({ id, p: -p });
    else if (p > 0) creditors.push({ id, p });
  });
  debtors.sort((a, b) => b.p - a.p);
  creditors.sort((a, b) => b.p - a.p);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].p, creditors[j].p);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 });
    debtors[i].p -= pay; creditors[j].p -= pay;
    if (debtors[i].p === 0) i++;
    if (creditors[j].p === 0) j++;
  }
  return out;
}

export function computeTripSummary(trip) {
  const members = trip?.members ?? [];
  // Unfinished table rows (no payer / no amount) are ignored
  const expenses = (trip?.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0);
  const settlements = trip?.settlements ?? [];
  const units = buildUnits(members);
  const unitOfMember = Object.fromEntries(members.map((m) => [m.id, unitIdOf(m)]));

  const paid = {}, share = {};
  members.forEach((m) => { paid[m.id] = 0; share[m.id] = 0; });
  expenses.forEach((e) => {
    if (paid[e.paidBy] !== undefined) paid[e.paidBy] = round2(paid[e.paidBy] + (Number(e.amount) || 0));
    Object.entries(expenseShares(e, members)).forEach(([id, v]) => { share[id] = round2(share[id] + v); });
  });

  const memberRows = members.map((m) => ({
    id: m.id, name: m.name, unitId: unitOfMember[m.id],
    paid: paid[m.id], share: share[m.id], net: round2(paid[m.id] - share[m.id]),
  }));

  const unitRows = units.map((u) => {
    const rows = memberRows.filter((r) => r.unitId === u.id);
    const uPaid = sumAmounts(rows, (r) => r.paid);
    const uShare = sumAmounts(rows, (r) => r.share);
    const net = round2(uPaid - uShare);
    const settledOut = sumAmounts(settlements.filter((s) => s.fromUnit === u.id));
    const settledIn = sumAmounts(settlements.filter((s) => s.toUnit === u.id));
    // Paying a settlement raises your balance; receiving one lowers it
    const remaining = round2(net + settledOut - settledIn);
    return { ...u, paid: uPaid, share: uShare, net, settledOut, settledIn, remaining, isGroup: u.memberIds.length > 1 };
  });

  const total = sumAmounts(expenses);
  const transfers = settleTransfers(Object.fromEntries(unitRows.map((u) => [u.id, u.remaining])));
  const unitName = Object.fromEntries(unitRows.map((u) => [u.id, u.name]));
  const outstanding = sumAmounts(transfers);
  const settledTotal = sumAmounts(settlements);
  const meUnit = trip?.meMemberId ? unitOfMember[trip.meMemberId] : null;

  return {
    total, count: expenses.length,
    perHead: members.length ? round2(total / members.length) : 0,
    members: memberRows, units: unitRows,
    transfers: transfers.map((t) => ({ ...t, fromName: unitName[t.from], toName: unitName[t.to] })),
    outstanding, settledTotal,
    isSettled: expenses.length > 0 && transfers.length === 0,
    meUnit,
    myShare: trip?.meMemberId ? share[trip.meMemberId] ?? 0 : null,
    myPaid: trip?.meMemberId ? paid[trip.meMemberId] ?? 0 : null,
    owedToMe: meUnit ? transfers.filter((t) => t.to === meUnit) : [],
    iOwe: meUnit ? transfers.filter((t) => t.from === meUnit) : [],
  };
}

/** Plain-text summary for sharing on WhatsApp etc. */
export function tripSummaryText(trip, fmt = (n) => `₹${n}`) {
  const s = computeTripSummary(trip);
  const lines = [`${trip.name} — trip summary`, `Total spent: ${fmt(s.total)} · ${s.members.length} people · ${fmt(s.perHead)} per head`, ''];
  lines.push('Paid:');
  s.members.forEach((m) => lines.push(`• ${m.name}: ${fmt(m.paid)} (share ${fmt(m.share)})`));
  lines.push('');
  if (s.transfers.length) {
    lines.push('To settle:');
    s.transfers.forEach((t) => lines.push(`→ ${t.fromName} pays ${t.toName} ${fmt(t.amount)}`));
  } else {
    lines.push(s.count ? 'All settled ✓' : 'No expenses yet');
  }
  return lines.join('\n');
}
