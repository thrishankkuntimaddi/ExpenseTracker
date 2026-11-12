// ─── Admin sees: who uses the app ────────────────────────────────
// Pure helpers over user_activity docs ({ uid, email, name, createdAt,
// lastOpenedAt, lastEntryAt, entries, opens, platform, version }).
const DAY = 86400000;

export const STATUS = {
  today:  { label: 'Active today',   tone: 'income' },
  active: { label: 'Active this week', tone: 'income' },
  idle:   { label: 'Quiet 7–30 days', tone: 'lent' },
  gone:   { label: 'Stopped (30+ days)', tone: 'expense' },
};

/** Where someone stands by when they last opened the app. */
export function statusOf(u, now = Date.now()) {
  const ago = now - (Number(u?.lastOpenedAt) || 0);
  if (ago < DAY) return 'today';
  if (ago < 7 * DAY) return 'active';
  if (ago < 30 * DAY) return 'idle';
  return 'gone';
}

export const FILTERS = [
  { key: 'all',     label: 'Everyone',          test: () => true },
  { key: 'today',   label: 'Today',             test: (u, now) => statusOf(u, now) === 'today' },
  { key: 'active',  label: 'This week',         test: (u, now) => ['today', 'active'].includes(statusOf(u, now)) },
  { key: 'logging', label: 'Adding entries',    hint: 'Added something in the last 7 days', test: (u, now) => now - (Number(u.lastEntryAt) || 0) < 7 * DAY },
  { key: 'lurking', label: 'Opens, adds nothing', hint: 'Opened this week, no entry in 14 days', test: (u, now) => ['today', 'active'].includes(statusOf(u, now)) && now - (Number(u.lastEntryAt) || 0) >= 14 * DAY },
  { key: 'nodata',  label: 'No entries',        test: (u) => !(Number(u.entries) > 0) },
  { key: 'new',     label: 'New this week',     test: (u, now) => now - (Number(u.createdAt) || 0) < 7 * DAY },
  { key: 'idle',    label: 'Going quiet',       hint: 'Last opened 7–30 days ago', test: (u, now) => statusOf(u, now) === 'idle' },
  { key: 'gone',    label: 'Stopped using',     hint: 'Not opened for 30+ days', test: (u, now) => statusOf(u, now) === 'gone' },
];

export const SORTS = [
  { key: 'opened',  label: 'Last opened', value: (u) => Number(u.lastOpenedAt) || 0 },
  { key: 'entry',   label: 'Last entry',  value: (u) => Number(u.lastEntryAt) || 0 },
  { key: 'joined',  label: 'Newest',      value: (u) => Number(u.createdAt) || 0 },
  { key: 'entries', label: 'Most entries', value: (u) => Number(u.entries) || 0 },
];

/** Filter, search (name / email) and sort; newest/highest first. */
export function viewUsers(users = [], { filter = 'all', platform = 'all', search = '', sort = 'opened' } = {}, now = Date.now()) {
  const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
  const s = SORTS.find((x) => x.key === sort) ?? SORTS[0];
  const q = search.trim().toLowerCase();
  return users
    .filter((u) => f.test(u, now))
    .filter((u) => platform === 'all' || (u.platform ?? 'web') === platform || (platform === 'android' && u.platform === 'ios'))
    .filter((u) => !q || `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => s.value(b) - s.value(a));
}

/** Headline numbers and a count per filter. */
export function summarise(users = [], now = Date.now()) {
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, users.filter((u) => f.test(u, now)).length]));
  const platforms = {};
  users.forEach((u) => { const p = u.platform ?? 'web'; platforms[p] = (platforms[p] ?? 0) + 1; });
  const entries = users.reduce((s, u) => s + (Number(u.entries) || 0), 0);
  // Returning: opened this week and joined more than a week ago
  const returning = users.filter((u) => ['today', 'active'].includes(statusOf(u, now)) && now - (Number(u.createdAt) || 0) >= 7 * DAY).length;
  return { total: users.length, counts, platforms, entries, returning };
}

/** "3 h ago", "yesterday", "12 Oct" — for a timestamp or null. */
export function agoLabel(ts, now = Date.now()) {
  const t = Number(ts) || 0;
  if (!t) return 'never';
  const min = Math.round((now - t) / 60000);
  if (min < 2) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}
