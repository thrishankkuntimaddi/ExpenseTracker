// ─── Wrapped: your month or year as a shareable card ─────────────
// Shares, habits and favourites by default — rupee amounts only when you
// choose to show them. Pure (the card object); shareCard.js draws it.
import { localDateKey } from './dateHelpers';
import { categoryOf, categoryMeta } from './categories';
import { incomeKind } from './finance';
import { toKey, fromKey } from './recurring';

const amt = (t) => Number(t?.amount) || 0;
const norm = (s) => String(s ?? '').trim().toLowerCase();
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };

/**
 * @param win { start, last, label } — date keys, both included
 */
export function wrappedStats({ transactions = [], income = [], rules = {}, win }) {
  const inWin = (e) => { const k = localDateKey(e.date); return !!k && k >= win.start && k <= win.last && !e.isCarryForward; };
  const tx = transactions.filter(inWin), inc = income.filter(inWin);
  const exp = tx.filter((t) => t.type === 'expense');
  const spent = exp.reduce((s, t) => s + amt(t), 0);
  const saved = tx.filter((t) => t.type === 'savings').reduce((s, t) => s + amt(t), 0);
  const earned = inc.filter((i) => incomeKind(i) === 'income').reduce((s, i) => s + amt(i), 0);

  const byCat = {};
  exp.forEach((t) => { const c = categoryOf(t, rules) ?? 'other'; byCat[c] = (byCat[c] ?? 0) + amt(t); });
  const categories = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([key, v]) => ({ key, label: categoryMeta(key)?.label ?? key, amount: v, share: spent ? Math.round((v / spent) * 100) : 0 }));

  const byName = {};
  exp.forEach((t) => { const k = norm(t.name); if (!k) return; (byName[k] ??= { name: String(t.name).trim(), count: 0, amount: 0 }).count++; byName[k].amount += amt(t); });
  const regulars = Object.values(byName).filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 3);

  // Days: logged, no-spend, the longest logging run inside the window
  const today = toKey(new Date());
  const lastDay = win.last < today ? win.last : today;
  const logged = new Set([...tx, ...inc].map((e) => localDateKey(e.date)));
  const spentDays = new Set(exp.map((t) => localDateKey(t.date)));
  let days = 0, noSpend = 0, run = 0, bestRun = 0;
  for (let k = win.start; k <= lastDay; k = addDays(k, 1)) {
    days++;
    if (!spentDays.has(k)) noSpend++;
    run = logged.has(k) ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  const biggestDay = Object.entries(exp.reduce((m, t) => { const k = localDateKey(t.date); m[k] = (m[k] ?? 0) + amt(t); return m; }, {}))
    .sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    label: win.label, entries: tx.length + inc.length, days, loggedDays: [...logged].filter((k) => k >= win.start && k <= lastDay).length,
    spent, saved, earned, savingsRate: earned > 0 ? Math.round((saved / earned) * 100) : null,
    categories, regulars, noSpend, bestRun, biggestDay: biggestDay && { key: biggestDay[0], amount: biggestDay[1] },
  };
}

/** The card for shareCard.js. `money` formats amounts; `showAmounts` adds rupees. */
export function wrappedCard(w, { money, showAmounts = false, appUrl = '' }) {
  const hero = [
    { label: 'Entries', value: String(w.entries) },
    { label: 'Saved', value: w.savingsRate != null ? `${w.savingsRate}%` : '—', tone: 'income' },
    { label: 'No-spend days', value: String(w.noSpend), tone: 'gold' },
  ];
  if (showAmounts) hero.splice(1, 0, { label: 'Spent', value: money(w.spent), tone: 'expense' });
  const sections = [
    { title: 'Where it went', rows: w.categories.slice(0, 5).map((c) => ({ left: c.label, right: showAmounts ? `${c.share}% · ${money(c.amount)}` : `${c.share}%` })), empty: 'No spending' },
  ];
  if (w.regulars.length) sections.push({ title: 'My regulars', rows: w.regulars.map((r) => ({ left: r.name, right: `${r.count} times${showAmounts ? ` · ${money(r.amount)}` : ''}` })) });
  sections.push({
    title: 'Habits',
    rows: [
      { left: 'Longest logging streak', right: `${w.bestRun} day${w.bestRun === 1 ? '' : 's'}`, tone: 'gold' },
      { left: 'Days with an entry', right: `${w.loggedDays} of ${w.days}` },
      ...(showAmounts && w.saved ? [{ left: 'Put aside', right: money(w.saved), tone: 'income' }] : []),
    ],
  });
  return {
    kicker: 'MY MONEY, WRAPPED',
    title: w.label,
    subtitle: w.savingsRate != null && w.savingsRate >= 20 ? 'Saved a fifth or more of what came in ✨' : w.noSpend >= Math.max(4, w.days / 5) ? 'Plenty of no-spend days 🌿' : 'Every rupee accounted for',
    hero, sections,
    footer: `Expense Tracker${appUrl ? ` · ${appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}`,
  };
}

export function wrappedText(w, { money, showAmounts = false, appUrl = '' }) {
  const lines = [`My money, wrapped — ${w.label}`, ''];
  lines.push(`${w.entries} entries · ${w.noSpend} no-spend days · longest streak ${w.bestRun} days`);
  if (w.savingsRate != null) lines.push(`Saved ${w.savingsRate}% of what came in${showAmounts ? ` (${money(w.saved)})` : ''}`);
  if (w.categories.length) lines.push(`Where it went: ${w.categories.slice(0, 3).map((c) => `${c.label} ${c.share}%`).join(', ')}`);
  if (w.regulars.length) lines.push(`My regulars: ${w.regulars.map((r) => `${r.name} ×${r.count}`).join(', ')}`);
  if (appUrl) lines.push('', `Tracked with Expense Tracker — ${appUrl}`);
  return lines.join('\n');
}

/** The year to wrap: this year so far, or last year during January. */
export function yearWindow(todayKey) {
  const [y, m] = todayKey.split('-').map(Number);
  const year = m === 1 ? y - 1 : y;
  return { start: `${year}-01-01`, last: m === 1 ? `${year}-12-31` : todayKey, label: m === 1 || todayKey.endsWith('12-31') ? `${year}` : `${year} so far` };
}
