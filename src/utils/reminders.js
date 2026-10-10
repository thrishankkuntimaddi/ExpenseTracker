// ─── Reminders: the plan ─────────────────────────────────────────
// Pure: buildSchedule(now, cfg, data) → the notifications for the next 14
// days. Delivery (Android / desktop / web) lives in native/reminders.js.
//
// Rules
//  • everything is off by default; each type has its own switch and time
//  • at most one notification per type per day
//  • daily nudge: skipped today if something was already logged today
//  • recurring: the evening before an entry is due (one combined line)
//  • budget: once when the month passes 80 %, once at 100 % — never repeated
//    (`budgetAt` remembers when each alert was planned, per device)
//  • weekly: one line on the chosen evening; real numbers only when it's
//    planned the same day (otherwise they'd be stale by the time it shows)
//  • copy is short, original and never guilt-trips
import { localDateKey, localMonthKey, formatAmount as fullAmount } from './dateHelpers';
import { occurrencesBetween, toKey } from './recurring';
import { categoryOf, categoryMeta } from './categories';

/* Notifications are one line: drop “.00” on whole rupees (₹15,000, not ₹15,000.00). */
const formatAmount = (n) => (Math.round(n * 100) % 100 === 0
  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(n))
  : fullAmount(n));

export const REMINDER_TYPES = ['daily', 'recurring', 'budget', 'weekly'];
export const TONES = [
  { key: 'friendly', label: 'Friendly' },
  { key: 'brief',    label: 'Brief' },
  { key: 'coach',    label: 'Coach' },
];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** The screen a tapped reminder opens. */
export const REMINDER_ROUTE = { daily: 'today', recurring: 'plan', budget: 'plan', weekly: 'stats' };

export const DEFAULT_REMINDERS = {
  tone: 'friendly',
  daily:     { enabled: false, time: '21:00', days: ALL_DAYS },
  recurring: { enabled: false, time: '20:00' },
  budget:    { enabled: false, time: '19:00' },
  weekly:    { enabled: false, time: '19:00', day: 0 },
};

/** Settings as stored (possibly partial / older) → complete config. */
export function normaliseReminders(raw = {}) {
  const r = raw ?? {};
  const out = { tone: TONES.some((t) => t.key === r.tone) ? r.tone : DEFAULT_REMINDERS.tone };
  for (const type of REMINDER_TYPES) out[type] = { ...DEFAULT_REMINDERS[type], ...(r[type] ?? {}) };
  return out;
}

export const anyReminderOn = (cfg) => REMINDER_TYPES.some((t) => cfg?.[t]?.enabled);

const DAY = 86400000;
const at = (date, hhmm) => { const [h, m] = (hhmm || '20:00').split(':').map(Number); const d = new Date(date); d.setHours(h, m, 0, 0); return d.getTime(); };
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d; };
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const pick = (list, seed) => list[Math.abs(seed) % list.length];
const daySeed = (date) => Math.floor(startOfDay(date).getTime() / DAY);

/** Stable positive 31-bit id (Android notification ids are ints). */
export function reminderId(type, key) {
  let h = 2166136261;
  for (const ch of `${type}:${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 1) || 1;
}

/* ── Copy ─────────────────────────────────────────────────────── */
const COPY = {
  daily: {
    friendly: [
      ['Anything to log today?', 'A quick entry now keeps your month easy to read.'],
      ['Today’s spending', 'Got a minute? Note what went out today while it’s fresh.'],
      ['End-of-day check-in', 'Add today’s expenses — small ones count too.'],
    ],
    brief: [['Log today', 'Add today’s expenses.']],
    coach: [
      ['Close the day', 'Log today’s spending — 30 seconds, then you’re done.'],
      ['Keep the record clean', 'Today’s entries in, tomorrow starts fresh.'],
    ],
  },
  weeklyGeneric: {
    friendly: [['Your week in money', 'Your weekly summary is ready — see where this week went.']],
    brief: [['Weekly summary', 'Tap to see this week.']],
    coach: [['Week review', 'Two minutes: check this week’s spending and plan the next.']],
  },
};

function dailyCopy(tone, seed) { const [t, b] = pick(COPY.daily[tone] ?? COPY.daily.friendly, seed); return { title: t, body: b }; }

function recurringCopy(tone, entries) {
  const one = entries[0];
  const amount = (e) => formatAmount(e.amount);
  const list = entries.length === 1
    ? `${one.name} · ${amount(one)}`
    : entries.length === 2
      ? `${entries[0].name} ${amount(entries[0])} and ${entries[1].name} ${amount(entries[1])}`
      : `${entries[0].name} ${amount(entries[0])}, ${entries[1].name} ${amount(entries[1])} and ${entries.length - 2} more`;
  const anyIncome = entries.some((e) => e.kind === 'income');
  const title = tone === 'brief' ? 'Due tomorrow' : anyIncome && entries.length === 1 ? 'Expected tomorrow' : entries.length === 1 ? 'Due tomorrow' : `${entries.length} entries due tomorrow`;
  const tail = tone === 'coach' ? ' Make sure the money’s where it needs to be.' : '';
  return { title, body: list + (tone === 'brief' ? '' : '.') + tail };
}

function budgetCopy(tone, pct, { monthName, spent, limit, daysLeft }) {
  const left = limit - spent;
  const days = `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  if (pct >= 100) {
    const over = spent - limit;
    if (tone === 'brief') return { title: `${monthName} budget used`, body: over > 0 ? `${formatAmount(over)} over · ${days} left.` : `${days} left.` };
    return {
      title: `${monthName}’s budget is used up`,
      body: tone === 'coach'
        ? `${formatAmount(spent)} of ${formatAmount(limit)} with ${days} to go. Plan a few light days to finish steady.`
        : `${formatAmount(spent)} of ${formatAmount(limit)} so far, ${days} to go. A few light days will even it out.`,
    };
  }
  if (tone === 'brief') return { title: `${Math.floor((spent / limit) * 100)}% of ${monthName} budget`, body: `${formatAmount(left)} left · ${days}.` };
  return {
    title: `${Math.floor((spent / limit) * 100)}% of ${monthName}’s budget used`,
    body: tone === 'coach'
      ? `${formatAmount(left)} left for ${days} — about ${formatAmount(left / Math.max(1, daysLeft))} a day.`
      : `${formatAmount(left)} left for the next ${days}. You’re still in control.`,
  };
}

function weeklyCopy(tone, { total, top, prevTotal }) {
  if (!total) return tone === 'brief'
    ? { title: 'Weekly summary', body: 'No expenses logged this week.' }
    : { title: 'Your week in money', body: 'No expenses logged this week — if that’s right, nice and quiet.' };
  const share = top ? ` · most on ${top.label} (${formatAmount(top.amount)})` : '';
  const change = prevTotal > 0 ? (total < prevTotal ? `, ${formatAmount(prevTotal - total)} less than last week` : total > prevTotal ? `, ${formatAmount(total - prevTotal)} more than last week` : '') : '';
  if (tone === 'brief') return { title: 'Weekly summary', body: `${formatAmount(total)} spent${share}.` };
  return { title: 'Your week in money', body: `${formatAmount(total)} spent this week${change}${share}.` + (tone === 'coach' ? ' Set one small goal for next week.' : '') };
}

/* ── Data helpers ─────────────────────────────────────────────── */
function weekTotals(transactions, endDate, rules) {
  const end = startOfDay(endDate.getTime());
  const start = addDays(end, -6);
  const prevStart = addDays(start, -7);
  const inRange = (t, a, b) => { const k = localDateKey(t.date); return k >= toKey(a) && k <= toKey(b); };
  const expenses = transactions.filter((t) => t.type === 'expense');
  const week = expenses.filter((t) => inRange(t, start, end));
  const prev = expenses.filter((t) => inRange(t, prevStart, addDays(start, -1)));
  const byCat = {};
  week.forEach((t) => { const c = categoryOf(t, rules) ?? 'other'; byCat[c] = (byCat[c] ?? 0) + Number(t.amount || 0); });
  const [topKey, topAmt] = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0] ?? [];
  return {
    total: week.reduce((s, t) => s + Number(t.amount || 0), 0),
    prevTotal: prev.reduce((s, t) => s + Number(t.amount || 0), 0),
    top: topKey ? { label: categoryMeta(topKey)?.label ?? topKey, amount: topAmt } : null,
  };
}

/** First day this month on which cumulative expense spending reached `pct`% of `limit`. */
function crossingDay(transactions, monthKey, limit, pct) {
  const days = {};
  transactions.filter((t) => t.type === 'expense' && localMonthKey(t.date) === monthKey)
    .forEach((t) => { const k = localDateKey(t.date); days[k] = (days[k] ?? 0) + Number(t.amount || 0); });
  let sum = 0;
  for (const k of Object.keys(days).sort()) { sum += days[k]; if (sum >= (limit * pct) / 100) return k; }
  return null;
}

/**
 * @param {number} now   epoch ms
 * @param {object} cfg   normaliseReminders(settings.reminders)
 * @param {object} data  { transactions, income, recurring, budgets, categoryRules, budgetAt }
 *   budgetAt: { 'YYYY-MM:80': epochMs, … } — when each budget alert was planned (per device)
 * @returns {Array<{ id, type, at, title, body, route, key }>} sorted by time
 */
export function buildSchedule(now, cfg, data = {}, horizonDays = 14) {
  const c = normaliseReminders(cfg);
  const { transactions = [], income = [], recurring = [], budgets = null, categoryRules = {}, budgetAt = {} } = data;
  const tone = c.tone;
  const today = startOfDay(now);
  const todayKey = toKey(today);
  const items = [];
  const push = (type, key, when, copy, route) => items.push({ id: reminderId(type, key), type, key, at: when, route, ...copy });

  const loggedToday = [...transactions, ...income].some((e) => localDateKey(e.date) === todayKey);

  for (let d = 0; d < horizonDays; d++) {
    const date = addDays(today, d);
    const key = toKey(date);
    const weekday = date.getDay();

    // Daily nudge
    if (c.daily.enabled && (c.daily.days ?? ALL_DAYS).includes(weekday)) {
      const when = at(date, c.daily.time);
      if (when > now && !(d === 0 && loggedToday)) push('daily', key, when, dailyCopy(tone, daySeed(date)), REMINDER_ROUTE.daily);
    }

    // Recurring entries due tomorrow
    if (c.recurring.enabled) {
      const when = at(date, c.recurring.time);
      if (when > now) {
        const dueKey = toKey(addDays(date, 1));
        const due = recurring
          .filter((r) => r.active !== false && !(r.lastHandledKey && r.lastHandledKey >= dueKey))
          .filter((r) => occurrencesBetween(r, key, dueKey).includes(dueKey))
          .sort((a, b) => Number(b.amount) - Number(a.amount));
        if (due.length) push('recurring', key, when, recurringCopy(tone, due), REMINDER_ROUTE.recurring);
      }
    }

    // Weekly summary
    if (c.weekly.enabled && weekday === Number(c.weekly.day ?? 0)) {
      const when = at(date, c.weekly.time);
      if (when > now) {
        const copy = d === 0
          ? weeklyCopy(tone, weekTotals(transactions, date, categoryRules))
          : (() => { const [t, b] = pick(COPY.weeklyGeneric[tone] ?? COPY.weeklyGeneric.friendly, 0); return { title: t, body: b }; })();
        push('weekly', key, when, copy, REMINDER_ROUTE.weekly);
      }
    }
  }

  // Budget alerts (current month, total budget)
  const limit = Number(budgets?.total) > 0 ? Number(budgets.total) : null;
  if (c.budget.enabled && limit) {
    const monthKey = todayKey.slice(0, 7);
    const monthName = today.toLocaleString('en-IN', { month: 'long' });
    const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const spent = transactions.filter((t) => t.type === 'expense' && localMonthKey(t.date) === monthKey).reduce((s, t) => s + Number(t.amount || 0), 0);
    // The highest threshold reached wins; a lower one never fires after it
    const pct = [100, 80].find((p) => crossingDay(transactions, monthKey, limit, p));
    if (pct) {
      const bKey = `${monthKey}:${pct}`;
      const planned = budgetAt[bKey];
      const nextSlot = (() => { const t = at(today, c.budget.time); return t > now ? t : at(addDays(today, 1), c.budget.time); })();
      const when = planned ?? nextSlot;
      const stillThisMonth = toKey(new Date(when)).slice(0, 7) === monthKey;
      const alreadyFired = planned != null && planned <= now;
      if (!alreadyFired && stillThisMonth) {
        const daysLeft = dim - new Date(when).getDate() + 1;
        push('budget', bKey, when, budgetCopy(tone, pct, { monthName, spent, limit, daysLeft }), REMINDER_ROUTE.budget);
      }
    }
  }

  return items.sort((a, b) => a.at - b.at);
}

/** Preview for Settings: what the next notification of `type` would say. */
export function previewReminder(type, cfg, data, now = Date.now()) {
  const c = normaliseReminders(cfg);
  const forced = { ...c, [type]: { ...c[type], enabled: true, days: ALL_DAYS, day: new Date(now).getDay(), time: '23:59' } };
  for (const t of REMINDER_TYPES) if (t !== type) forced[t] = { ...forced[t], enabled: false };
  const d = { ...data, budgetAt: {} };
  const item = buildSchedule(now, forced, d, 8).find((i) => i.type === type);
  if (item) return item;
  // Nothing to plan from the real data (no budget / no recurring due) — show an example
  const examples = {
    daily:     dailyCopy(c.tone, 0),
    recurring: recurringCopy(c.tone, [{ name: 'Rent', amount: 15000, kind: 'expense' }]),
    budget:    budgetCopy(c.tone, 80, { monthName: new Date(now).toLocaleString('en-IN', { month: 'long' }), spent: 16400, limit: 20000, daysLeft: 9 }),
    weekly:    weeklyCopy(c.tone, { total: 4320, prevTotal: 5100, top: { label: 'Food & Dining', amount: 1850 } }),
  };
  return { type, example: true, route: REMINDER_ROUTE[type], ...examples[type] };
}
