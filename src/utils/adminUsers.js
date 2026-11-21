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
    case 'self_delete_requested': return 'leaving';   // they deleted their account; the server finishes it
    case 'purged': return 'purged';
    default: return 'none';
  }
}
const inDeleted = (s) => ['closing', 'closed', 'restoring', 'purging', 'leaving', 'purged'].includes(s);

export const daysQuiet = (u, now = Date.now()) => Math.floor((now - (Number(u?.lastOpenedAt) || 0)) / DAY);

/** Active: opened in the last INACTIVE_DAYS. Inactive: quieter than that (or never). */
export const TABS = [
  { key: 'active',   label: 'Active',       test: (u, now, a) => !inDeleted(a) && daysQuiet(u, now) < INACTIVE_DAYS },
  { key: 'inactive', label: 'Inactive',     hint: `Not opened for ${INACTIVE_DAYS}+ days — tap someone to see details or close the account`, test: (u, now, a) => !inDeleted(a) && daysQuiet(u, now) >= INACTIVE_DAYS },
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

/* ── Insights: what people use, which versions, who needs a look ──
   From user_activity only — counts and switches, never amounts or entries. */
const verParts = (v) => String(v ?? '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
/** Compare two "4.5.2" versions: <0, 0, >0. */
export function compareVersions(a, b) {
  const x = verParts(a), y = verParts(b);
  for (let i = 0; i < 3; i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export function insights(users = [], now = Date.now()) {
  const n = users.length || 1;
  const pct = (c) => Math.round((c / n) * 100);
  const count = (test) => users.filter(test).length;
  const known = (k) => users.filter((u) => u[k] != null);
  const row = (key, label, test, base = users) => { const c = base.filter(test).length; return { key, label, count: c, of: base.length, pct: base.length ? Math.round((c / base.length) * 100) : 0 }; };

  const adoption = [
    row('accounts', 'Set up accounts', (u) => Number(u.accounts) > 0, known('accounts')),
    row('multi', '2+ bank / card accounts', (u) => Number(u.accounts) > 2, known('accounts')),
    row('budget', 'Monthly budget', (u) => u.budget === true, known('budget')),
    row('goals', 'Savings goals', (u) => Number(u.goals) > 0, known('goals')),
    row('rules', 'Bills & recurring', (u) => Number(u.rules) > 0, known('rules')),
    row('carry', 'Carry forward', (u) => u.carry === true, known('carry')),
    row('lock', 'App lock', (u) => u.lockOn === true, known('lockOn')),
  ];
  const split = (k, fallback = 'unknown') => {
    const m = {};
    users.forEach((u) => { const v = u[k] || fallback; m[v] = (m[v] ?? 0) + 1; });
    return Object.entries(m).map(([value, c]) => ({ value, count: c, pct: pct(c) })).sort((a, b) => b.count - a.count);
  };

  // Versions: newest first; everyone behind the newest one seen is flagged
  const latest = users.map((u) => u.version).filter(Boolean).sort(compareVersions).pop() ?? null;
  const vm = {};
  users.forEach((u) => {
    const key = `${u.version || '—'}|${u.platform || 'unknown'}`;
    (vm[key] ||= { version: u.version || '—', platform: u.platform || 'unknown', count: 0 }).count += 1;
  });
  const versions = Object.values(vm).sort((a, b) => compareVersions(b.version, a.version) || b.count - a.count)
    .map((v) => ({ ...v, behind: !!latest && v.version !== '—' && compareVersions(v.version, latest) < 0 }));
  const behind = count((u) => latest && u.version && compareVersions(u.version, latest) < 0);

  // Data health: settings nearly empty for someone with a real history (the
  // 4.4.0–4.5.0 settings wipe), and problems on their devices this week
  const wiped = users.filter((u) => u.settingsKeys != null && Number(u.settingsKeys) <= 2 && Number(u.entries) >= 20)
    .sort((a, b) => (Number(b.lastOpenedAt) || 0) - (Number(a.lastOpenedAt) || 0));
  const WEEK = 7 * DAY;
  const problems = users.filter((u) => Number(u.lastErrAt) && now - Number(u.lastErrAt) < WEEK)
    .sort((a, b) => Number(b.lastErrAt) - Number(a.lastErrAt));

  return {
    adoption, versions, latest, behind,
    looks: split('look'), platforms: split('platform'), languages: split('lang', 'en'),
    wiped, problems,
  };
}
