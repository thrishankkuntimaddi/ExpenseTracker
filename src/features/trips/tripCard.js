// ─── The trip as a share card (PNG) ───────────────────────────────
// Everything the group needs in one picture: totals, who pays whom, what's
// already paid, each wallet's paid vs share (and who owes whom inside a
// wallet), where the money went, and every row.
import { computeTripSummary } from '../../utils/split';
import { categoryMeta } from '../../utils/categories';
import { formatAmount, formatDateShort } from '../../utils/dateHelpers';
import { renderShareCard } from '../../utils/shareCard';

export function tripCard(trip) {
  const money = (n) => formatAmount(n, trip.currency);
  const s = computeTripSummary(trip);
  const nameOf = Object.fromEntries((trip.members ?? []).map((m) => [m.id, m.name]));
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));
  const closed = trip.status === 'closed' || trip.status === 'archived';
  const dates = trip.startDate ? `${formatDateShort(trip.startDate)}${trip.endDate ? ` – ${formatDateShort(trip.endDate)}` : ''}` : null;
  const external = (trip.settlements ?? []).filter((x) => x.fromUnit !== x.toUnit);

  const sections = [];
  sections.push({
    title: s.transfers.length ? `Who pays whom · ${money(s.outstanding)} to settle` : 'Who pays whom',
    empty: s.count ? 'All settled ✓' : 'No expenses yet',
    rows: s.transfers.map((t) => ({ left: `${t.fromName} → ${t.toName}`, right: money(t.amount), tone: 'expense' })),
  });
  if (external.length) {
    sections.push({
      title: `Already paid · ${money(s.settledTotal)}`,
      rows: external.map((x) => ({ left: `✓ ${unitName[x.fromUnit] ?? '?'} → ${unitName[x.toUnit] ?? '?'}`, sub: x.date ? formatDateShort(x.date) : undefined, right: money(x.amount), tone: 'income' })),
    });
  }
  sections.push({
    title: 'Paid vs share',
    rows: s.units.map((u) => ({
      left: `${u.name}${u.isGroup ? ' · one wallet' : ''}`,
      sub: `paid ${money(u.paid)} · share ${money(u.share)}`,
      right: u.remaining > 0.004 ? `gets ${money(u.remaining)}` : u.remaining < -0.004 ? `owes ${money(-u.remaining)}` : 'settled',
      tone: u.remaining > 0.004 ? 'income' : u.remaining < -0.004 ? 'expense' : 'sub',
    })),
  });
  s.units.filter((u) => u.isGroup).forEach((u) => {
    sections.push({
      title: `Inside ${u.name}`,
      empty: 'Square between them ✓',
      rows: [
        ...u.memberIds.map((id) => { const r = s.members.find((m) => m.id === id); return { left: r.name, sub: `paid ${money(r.paid)} · share ${money(r.share)}`, right: '', dim: true }; }),
        ...(u.inside ?? []).map((t) => ({ left: `${t.fromName} owes ${t.toName}`, right: money(t.amount), tone: 'expense' })),
      ],
    });
  });
  if (s.categories.length) {
    sections.push({
      title: 'Where the money went',
      rows: s.categories.map((c) => ({ left: categoryMeta(c.key).label, right: `${money(c.amount)} · ${Math.round((c.amount / s.total) * 100)}%`, tone: 'text' })),
    });
  }
  const rows = (trip.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0);
  sections.push({
    title: `All expenses · ${rows.length}`,
    empty: 'No expenses yet',
    rows: rows.map((e) => ({ left: `${nameOf[e.paidBy] ?? '?'} · ${e.title || '—'}`, right: money(Number(e.amount)), tone: 'expense' })),
    total: { left: `Total · ${money(s.perHead)} per head`, right: money(s.total), tone: 'expense' },
  });

  return {
    kicker: 'Expense Tracker · Trip',
    title: trip.name,
    subtitle: [dates, `${(trip.members ?? []).length} people`, trip.ownerName ? `by ${trip.ownerName}` : null].filter(Boolean).join(' · '),
    badge: closed ? { text: s.isSettled ? 'Closed · settled' : 'Closed', tone: 'income' } : { text: s.isSettled ? 'Settled' : 'Open', tone: s.isSettled ? 'income' : 'accent' },
    hero: [
      { label: 'Total spent', value: money(s.total), tone: 'text' },
      { label: 'Per head', value: money(s.perHead), tone: 'accent' },
      { label: s.isSettled ? 'Status' : 'To settle', value: s.isSettled ? 'Settled ✓' : money(s.outstanding), tone: s.isSettled ? 'income' : 'expense' },
    ],
    sections,
  };
}

export const tripImageBlob = (trip) => renderShareCard(tripCard(trip));
