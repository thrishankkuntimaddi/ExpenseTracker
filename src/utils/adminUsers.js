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

// Quiet this long and an account may be closed (the notifier checks again)
export const INACTIVE_DAYS = 25;
export const KEEP_DAYS = 90;
export const RUN_NOW_URL = 'https://github.com/thrishankkuntimaddi/ExpenseTracker/actions/workflows/notifier.yml';

/** What the owner did with an account: none | closing | closed | restoring | purging | refused */
export function adminStateOf(rec) {
  switch (rec?.state) {
    case 'delete_requested': return 'closing';
    case 'deleted': return 'closed';
    case 'restore_requested': return 'restoring';
    case 'purge_requested': return 'purging';
    case 'refused': return 'refused';
    default: return 'none';
  }
}
const inDeleted = (s) => ['closing', 'closed', 'restoring', 'purging'].includes(s);

export const daysQuiet = (u, now = Date.now()) => Math.floor((now - (Number(u?.lastOpenedAt) || 0)) / DAY);

/** Active: opened in the last INACTIVE_DAYS. Inactive: quieter than that (or never). */
export const TABS = [
  { key: 'active',   label: 'Active',       test: (u, now, a) => !inDeleted(a) && daysQuiet(u, now) < INACTIVE_DAYS },
  { key: 'inactive', label: 'Inactive',     hint: `Not opened for ${INACTIVE_DAYS}+ days — you can close these accounts`, test: (u, now, a) => !inDeleted(a) && daysQuiet(u, now) >= INACTIVE_DAYS },
  { key: 'deleted',  label: 'Closed',       hint: `Sign-in is off and the data is kept ${KEEP_DAYS} days — restore it any time before then`, test: (u, now, a) => inDeleted(a) },
  { key: 'all',      label: 'All accounts', test: () => true },
];

export const SORTS = [
  { key: 'opened',  label: 'Last opened', value: (u) => Number(u.lastOpenedAt) || 0 },
  { key: 'quiet',   label: 'Quiet longest', value: (u) => -(Number(u.lastOpenedAt) || 0) },
  { key: 'joined',  label: 'Newest',      value: (u) => Number(u.createdAt) || 0 },
  { key: 'entries', label: 'Most entries', value: (u) => Number(u.entries) || 0 },
];

/** One tab, searched (name / email) and sorted. `admin` is { uid: account_admin record }. */
export function viewUsers(users = [], { tab = 'active', search = '', sort = 'opened', admin = {} } = {}, now = Date.now()) {
  const t = TABS.find((x) => x.key === tab) ?? TABS[0];
  const s = SORTS.find((x) => x.key === sort) ?? SORTS[0];
  const q = search.trim().toLowerCase();
  return users
    .filter((u) => t.test(u, now, adminStateOf(admin[u.uid])))
    .filter((u) => !q || `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => s.value(b) - s.value(a));
}

/** A count per tab, and the few numbers worth a line. */
export function summarise(users = [], now = Date.now(), admin = {}) {
  const counts = Object.fromEntries(TABS.map((t) => [t.key, users.filter((u) => t.test(u, now, adminStateOf(admin[u.uid]))).length]));
  const today = users.filter((u) => statusOf(u, now) === 'today').length;
  const week = users.filter((u) => ['today', 'active'].includes(statusOf(u, now))).length;
  const newWeek = users.filter((u) => now - (Number(u.createdAt) || 0) < 7 * DAY).length;
  const neverUsed = users.filter((u) => !(Number(u.entries) > 0) && !u.lastEntryAt).length;
  return { total: users.length, counts, today, week, newWeek, neverUsed };
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
