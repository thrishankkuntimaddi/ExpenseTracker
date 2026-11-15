// ─── Trip insights: budget pace, the trip's story, timing ────────
// Pure helpers over a trip ({ startDate, endDate, budget, expenses, members })
// and its computeTripSummary(). Dates are 'YYYY-MM-DD'.
const DAY = 86400000;
const day = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`) : null);
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const round = (n) => Math.round(n * 100) / 100;

/** Where the trip is in time: upcoming (in N days), on (day X of Y), done, or undated. */
export function tripTiming(trip, today = new Date()) {
  const start = day(trip?.startDate), end = day(trip?.endDate) ?? start;
  const t = day(keyOf(today));
  if (!start) return { phase: 'undated' };
  const length = Math.max(1, Math.round((end - start) / DAY) + 1);
  if (t < start) return { phase: 'upcoming', inDays: Math.round((start - t) / DAY), length };
  if (t > end) return { phase: 'done', length, endedDaysAgo: Math.round((t - end) / DAY) };
  const dayN = Math.round((t - start) / DAY) + 1;
  return { phase: 'on', day: dayN, length, daysLeft: length - dayN };
}

/** Budget against what's spent, and the pace: per day so far vs what's left per day. */
export function budgetPace(trip, total, today = new Date()) {
  const budget = Number(trip?.budget) || 0;
  if (budget <= 0) return null;
  const timing = tripTiming(trip, today);
  const left = round(budget - total);
  const used = total / budget;
  let perDayLeft = null, perDaySoFar = null, projected = null;
  if (timing.phase === 'on') {
    perDaySoFar = round(total / timing.day);
    const daysToGo = timing.daysLeft + 1;            // today still counts
    perDayLeft = round(Math.max(0, left) / daysToGo);
    projected = round(perDaySoFar * timing.length);
  }
  const tone = used >= 1 ? 'over' : used >= 0.85 || (projected != null && projected > budget * 1.05) ? 'tight' : 'ok';
  return { budget, spent: total, left, used, perDayLeft, perDaySoFar, projected, tone, timing };
}

/** The trip's story: spend per day, biggest moments, who paid most. */
export function tripStory(trip, summary) {
  const rows = (trip?.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0);
  if (!rows.length) return null;
  const names = Object.fromEntries((trip.members ?? []).map((m) => [m.id, m.name]));
  const byDay = {};
  rows.forEach((e) => { const k = String(e.date || trip.startDate || '').slice(0, 10) || 'undated'; byDay[k] = round((byDay[k] ?? 0) + Number(e.amount)); });
  const days = Object.entries(byDay).filter(([k]) => k !== 'undated').sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  const biggest = rows.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a));
  const topPayer = (summary?.members ?? []).slice().sort((a, b) => b.paid - a.paid)[0];
  const priciestDay = days.slice().sort((a, b) => b.amount - a.amount)[0] ?? null;
  const n = (trip.members ?? []).length || 1;
  const nDays = Math.max(1, days.length, tripTiming(trip).length ?? 1);
  return {
    days,
    biggest: { title: biggest.title, amount: Number(biggest.amount), by: names[biggest.paidBy] ?? '' },
    topPayer: topPayer && topPayer.paid > 0 ? { name: topPayer.name, paid: topPayer.paid, share: summary.total ? topPayer.paid / summary.total : 0 } : null,
    priciestDay,
    perPersonPerDay: round((summary?.total ?? 0) / n / nDays),
    count: rows.length,
  };
}

/** "Settle up" message for the group chat: who pays whom, with the amounts. */
export function settleUpMessage(trip, summary, money) {
  if (!summary?.transfers?.length) return `✅ “${trip.name}” is all settled — thanks everyone!`;
  return [
    `🧾 Settling up “${trip.name}” — ${money(summary.total)} spent, ${money(summary.perHead)} each.`,
    '',
    ...summary.transfers.map((t) => `• ${t.fromName} → ${t.toName}: ${money(t.amount)}`),
    '',
    'Mark it paid in Expense Tracker once you’ve sent it 🙏',
  ].join('\n');
}
