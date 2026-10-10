// ─── Full backup (JSON) ──────────────────────────────────────────
// A backup holds every ExpenseTracker collection, so it can rebuild an
// account from scratch — including in a different Firebase project.
// Record ids are kept, which preserves the links between billings / trips
// and the income or expense entries they posted, and makes re-importing
// the same file overwrite instead of duplicate.
//
// v1 files (older exports) carried only { transactions, income, settings };
// parseBackup() still accepts them.

export const BACKUP_FORMAT  = 'expensetracker-backup';
export const BACKUP_VERSION = 2;

/** Every per-user collection, in the order they are restored. */
export const BACKUP_COLLECTIONS = [
  'transactions', 'income', 'external_transactions', 'trips', 'recurring', 'recently_deleted',
];

/* Server bookkeeping — re-stamped on restore, never needed in a file. */
const META_FIELDS = ['updatedAt', 'createdAt'];

/** Convert Firestore values (Timestamps) into plain JSON, recursively. */
export function toPlain(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
}

export function buildBackup({ email, settings = {}, collections = {} }, now = new Date()) {
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    email: email ?? null,
    settings: toPlain(settings),
  };
  for (const name of BACKUP_COLLECTIONS) backup[name] = toPlain(collections[name] ?? []);
  return backup;
}

/* ── Validation — mirrors firestore.rules so one bad row can't fail a batch ── */
const validId    = (r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0 && !r.id.includes('/');
const validMoney = (v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) < 1e12;
const validName  = (n, max) => typeof n === 'string' && n.trim().length > 0 && n.length <= max;

const VALIDATORS = {
  transactions: (r) => validId(r) && validMoney(r.amount) && typeof r.date === 'string' && r.date.length <= 40 && validName(r.name, 500),
  income:       (r) => validId(r) && validMoney(r.amount) && typeof r.date === 'string' && r.date.length <= 40 && validName(r.name, 500),
  recurring:    (r) => validId(r) && validMoney(r.amount) && validName(r.name, 200) && ['expense', 'savings', 'income'].includes(r.kind),
  trips:        (r) => validId(r) && validName(r.name, 200)
    && Array.isArray(r.members) && r.members.length <= 50
    && Array.isArray(r.expenses) && r.expenses.length <= 1000
    && (r.settlements === undefined || (Array.isArray(r.settlements) && r.settlements.length <= 1000)),
  external_transactions: validId,
  recently_deleted:      validId,
};

const stripMeta = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !META_FIELDS.includes(k)));
const withNumberAmount = (r) => (r.amount === undefined ? r : { ...r, amount: Number(r.amount) });

/**
 * Parse and validate a backup file's text.
 * Returns { version, settings, <collection>: records[], skipped: { [collection]: n } }.
 * Throws an Error with a readable message when the file isn't a backup.
 */
export function parseBackup(text) {
  let p;
  try { p = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('This file is not an ExpenseTracker backup.');

  const isV2 = p.format === BACKUP_FORMAT;
  if (!isV2 && !(Array.isArray(p.transactions) && Array.isArray(p.income))) {
    throw new Error('This file is not an ExpenseTracker backup.');
  }
  if (isV2 && p.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update the app, then import again.');
  }

  const result = { version: isV2 ? p.version : 1, skipped: {} };
  for (const name of BACKUP_COLLECTIONS) {
    const rows = Array.isArray(p[name]) ? p[name] : [];
    const valid = rows.filter(VALIDATORS[name]).map(stripMeta);
    result[name] = name === 'transactions' || name === 'income' || name === 'recurring' ? valid.map(withNumberAmount) : valid;
    if (rows.length !== valid.length) result.skipped[name] = rows.length - valid.length;
  }
  result.settings = p.settings && typeof p.settings === 'object' && !Array.isArray(p.settings) ? stripMeta(p.settings) : null;
  return result;
}

/** Human summary like "120 expenses, 14 income, 3 billings, 2 trips". */
export function describeBackup(b) {
  const parts = [
    [b.transactions?.length, 'transactions'],
    [b.income?.length, 'income entries'],
    [b.external_transactions?.length, 'billings'],
    [b.trips?.length, 'trips'],
    [b.recurring?.length, 'recurring rules'],
    [b.recently_deleted?.length, 'items in trash'],
  ];
  return parts.filter(([n]) => n).map(([n, label]) => `${n} ${label}`).join(', ') || 'no records';
}
