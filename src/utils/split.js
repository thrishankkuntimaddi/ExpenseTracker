// ─── Trip / group expense splitting ──────────────────────────────
// A trip has members, optional pay-groups (members who settle as one wallet,
// e.g. a couple), expenses paid by one member and split equally among a
// chosen subset, and settlements already made. Everything here is pure.
//
// trip = {
//   id, name, startDate, endDate?, status: 'open'|'closed', meMemberId?,
//   members:     [{ id, name, groupId? }],
//   expenses:    [{ id, title, amount, paidBy: memberId, splitAmong: memberId[] (empty = everyone), date, category? }],
//   settlements: [{ id, fromUnit, toUnit, amount, date, note?, fromMember?, toMember? }],
// }
//
// A settlement inside one wallet (fromUnit === toUnit) is the partner paying
// back what the other covered — e.g. Hanudeep repaying Muza after the trip.
import { sumAmounts } from './finance';
import { formatMoney } from './money';
import { inferCategory, categoryMeta } from './categories';

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

/**
 * Inside a pay-together wallet: who still owes whom between the partners.
 * Each member's out-of-pocket is what they paid for the trip plus wallet
 * settlements they made (minus ones they received); the wallet's dues that
 * are still open are assumed to be handled by its lead — the member who paid
 * the most (the one "responsible" for the others).
 */
function walletInside(unit, memberRows, settlements) {
  const ids = unit.memberIds;
  const net = Object.fromEntries(memberRows.filter((r) => ids.includes(r.id)).map((r) => [r.id, round2(r.paid - r.share)]));
  const lead = memberRows.filter((r) => ids.includes(r.id)).sort((a, b) => b.paid - a.paid)[0]?.id ?? ids[0];
  const pick = (m) => (ids.includes(m) ? m : lead);
  settlements.forEach((s) => {
    const amt = Number(s.amount) || 0;
    if (s.fromUnit === unit.id && s.toUnit === unit.id) {
      if (net[s.fromMember] !== undefined) net[s.fromMember] = round2(net[s.fromMember] + amt);
      if (net[s.toMember] !== undefined) net[s.toMember] = round2(net[s.toMember] - amt);
    } else if (s.fromUnit === unit.id) net[pick(s.fromMember)] = round2(net[pick(s.fromMember)] + amt);
    else if (s.toUnit === unit.id) net[pick(s.toMember)] = round2(net[pick(s.toMember)] - amt);
  });
  net[lead] = round2(net[lead] - unit.remaining);
  return { lead, transfers: settleTransfers(net) };
}

export function computeTripSummary(trip) {
  const members = trip?.members ?? [];
  // Unfinished table rows (no payer / no amount) are ignored
  const expenses = (trip?.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0);
  const settlements = trip?.settlements ?? [];
  const external = settlements.filter((s) => s.fromUnit !== s.toUnit);
  const units = buildUnits(members);
  const unitOfMember = Object.fromEntries(members.map((m) => [m.id, unitIdOf(m)]));
  const memberName = Object.fromEntries(members.map((m) => [m.id, m.name]));

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
    const settledOut = sumAmounts(external.filter((s) => s.fromUnit === u.id));
    const settledIn = sumAmounts(external.filter((s) => s.toUnit === u.id));
    // Paying a settlement raises your balance; receiving one lowers it
    const remaining = round2(net + settledOut - settledIn);
    const row = { ...u, paid: uPaid, share: uShare, net, settledOut, settledIn, remaining, isGroup: u.memberIds.length > 1 };
    if (row.isGroup) {
      const inside = walletInside(row, memberRows, settlements);
      row.lead = inside.lead;
      row.inside = inside.transfers.map((t) => ({ ...t, fromName: memberName[t.from], toName: memberName[t.to] }));
    }
    return row;
  });

  const total = sumAmounts(expenses);
  const transfers = settleTransfers(Object.fromEntries(unitRows.map((u) => [u.id, u.remaining])));
  const unitName = Object.fromEntries(unitRows.map((u) => [u.id, u.name]));
  const outstanding = sumAmounts(transfers);
  const settledTotal = sumAmounts(external);
  const meUnit = trip?.meMemberId ? unitOfMember[trip.meMemberId] : null;

  // Where the money went: by category, by day
  const byCategory = {};
  expenses.forEach((e) => { const k = e.category || inferCategory(e.title); byCategory[k] = round2((byCategory[k] ?? 0) + Number(e.amount)); });
  const categories = Object.entries(byCategory).map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);

  return {
    total, count: expenses.length,
    perHead: members.length ? round2(total / members.length) : 0,
    members: memberRows, units: unitRows, categories,
    transfers: transfers.map((t) => ({ ...t, fromName: unitName[t.from], toName: unitName[t.to] })),
    outstanding, settledTotal,
    isSettled: expenses.length > 0 && transfers.length === 0,
    meUnit,
    myShare: trip?.meMemberId ? share[trip.meMemberId] ?? 0 : null,
    myPaid: trip?.meMemberId ? paid[trip.meMemberId] ?? 0 : null,
    owedToMe: meUnit ? transfers.filter((t) => t.to === meUnit).map((t) => ({ ...t, fromName: unitName[t.from], toName: unitName[t.to] })) : [],
    iOwe: meUnit ? transfers.filter((t) => t.from === meUnit).map((t) => ({ ...t, fromName: unitName[t.from], toName: unitName[t.to] })) : [],
  };
}

/** Plain-text summary for sharing on WhatsApp etc. — everything the image shows. */
export function tripSummaryText(trip, fmt = (n) => formatMoney(n, trip?.currency)) {
  const s = computeTripSummary(trip);
  const nameOf = Object.fromEntries((trip.members ?? []).map((m) => [m.id, m.name]));
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));
  const status = trip.status === 'closed' ? 'closed' : 'open';
  const lines = [`🧳 *${trip.name}* — trip summary (${status})`];
  if (trip.startDate) lines.push(`📅 ${trip.startDate}${trip.endDate ? ` → ${trip.endDate}` : ''}`);
  lines.push(`💰 Total ${fmt(s.total)} · ${s.members.length} people · ${fmt(s.perHead)} per head · ${s.count} expenses`, '');

  if (s.categories.length) {
    lines.push('*Where it went*');
    s.categories.forEach((c) => lines.push(`• ${categoryMeta(c.key)?.label ?? c.key}: ${fmt(c.amount)}`));
    lines.push('');
  }
  lines.push('*Paid vs share*');
  s.units.forEach((u) => {
    const tail = u.remaining > 0.004 ? `gets ${fmt(u.remaining)}` : u.remaining < -0.004 ? `owes ${fmt(-u.remaining)}` : 'settled';
    lines.push(`• ${u.name}${u.isGroup ? ' (one wallet)' : ''}: paid ${fmt(u.paid)} · share ${fmt(u.share)} → ${tail}`);
  });
  lines.push('');
  if (s.transfers.length) {
    lines.push('*To settle*');
    s.transfers.forEach((t) => lines.push(`→ ${t.fromName} pays ${t.toName} ${fmt(t.amount)}`));
  } else {
    lines.push(s.count ? '✅ All settled' : 'No expenses yet');
  }
  const external = (trip.settlements ?? []).filter((x) => x.fromUnit !== x.toUnit);
  if (external.length) {
    lines.push('', '*Already paid*');
    external.forEach((x) => lines.push(`✓ ${unitName[x.fromUnit] ?? '?'} → ${unitName[x.toUnit] ?? '?'} ${fmt(x.amount)}`));
  }
  s.units.filter((u) => u.inside?.length).forEach((u) => {
    lines.push('', `*Inside ${u.name}*`);
    u.inside.forEach((t) => lines.push(`→ ${t.fromName} pays ${t.toName} ${fmt(t.amount)}`));
  });
  const rows = (trip.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0);
  if (rows.length) {
    lines.push('', '*All expenses*');
    rows.forEach((e) => lines.push(`${nameOf[e.paidBy] ?? '?'} · ${e.title || '—'} · ${fmt(Number(e.amount))}`));
  }
  lines.push('', 'Shared from Expense Tracker');
  return lines.join('\n');
}
