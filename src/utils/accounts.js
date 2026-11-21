// ─── Accounts: banks, cash, credit cards ─────────────────────────
// Where money actually sits. settings.accounts = [{
//   id, name, kind: 'bank' | 'cash' | 'card',
//   bank?    'HDFC', 'SBI' …              (optional)
//   last4?   '4521'                        (optional)
//   tag?     'Salary', 'Savings', 'Bills' … what it's for (optional)
//   color    1–8, a slot of the chart palette (ACCOUNT_COLORS)
//   opening  balance at the START of openingDate (cards: negative = due)
//   openingDate 'YYYY-MM-DD'
//   limit?   credit limit (cards)
//   archived?  closed: hidden from pickers, kept for history
// }]
// settings.defaultAccount   the account new entries start on
// settings.accountsLegacy   where entries without an accountId belong
//                           (everything logged before accounts existed)
//
// Every entry may carry accountId. Moving money between your own accounts
// (bank → bank, ATM withdrawal, paying a card bill) is a transaction of
// type 'cash' — the same neutral entry "Withdrew cash" always was — from
// accountId to toAccountId (no toAccountId: to your cash). It is left out
// of every total, so budgets and stats never count it.
//
// Balance of an account = opening + every entry on it dated openingDate or
// later. Days before openingDate are worked out backwards, so the history
// line still reaches back to the first entry.
//
// Before someone sets up accounts (no settings.accounts) the app shows two:
// MAIN ("Bank · UPI") and CASH, with today's Home balance split between them
// exactly as before (cash in hand = withdrawn − spent in cash). Nothing is
// written until they save an account, so nothing can race the settings load.
import { localDateKey, localMonthKey } from './dateHelpers';
import { cashSummary } from './cash';
import { computeStats } from './finance';
import { computeCarryForward } from './carryForward';
import { toKey, fromKey } from './recurring';

export const MAIN = 'main';
export const CASH = 'cash';

export const ACCOUNT_KINDS = {
  bank: { label: 'Bank account', short: 'Bank' },
  cash: { label: 'Cash',         short: 'Cash' },
  card: { label: 'Credit card',  short: 'Card' },
};
export const ACCOUNT_TAGS = ['Salary', 'Savings', 'Expenses', 'Bills', 'Business', 'Joint', 'Emergency'];
export const BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Canara', 'Indian Bank', 'Bank of Baroda', 'PNB', 'Union Bank', 'IDFC First', 'Yes Bank', 'IndusInd', 'Federal', 'Paytm Payments', 'Airtel Payments'];

/* The chart palette (validated light + dark), in its fixed order */
export const ACCOUNT_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
};
export const colorOf = (acc, dark = false) => ACCOUNT_COLORS[dark ? 'dark' : 'light'][((Number(acc?.color) || 1) - 1) % 8];

const paise = (n) => Math.round((Number(n) || 0) * 100);
const r2 = (p) => Math.round(p) / 100 || 0;   // never -0
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };

/** Display name: "HDFC ••4521" / nickname. */
export function accountLabel(acc) {
  if (!acc) return '';
  return acc.name || [acc.bank, acc.last4 ? `••${acc.last4}` : ''].filter(Boolean).join(' ') || ACCOUNT_KINDS[acc.kind]?.label || 'Account';
}

/* ── The account list ─────────────────────────────────────────── */

/** True once the person has saved their own accounts. */
export const accountsSetUp = (settings) => Array.isArray(settings?.accounts) && settings.accounts.length > 0;

/** Every account (closed ones too). Before set-up: the two starter accounts. */
export function listAccounts(settings) {
  if (accountsSetUp(settings)) return settings.accounts;
  return [
    { id: MAIN, name: 'Bank · UPI', kind: 'bank', color: 1, starter: true },
    { id: CASH, name: 'Cash', kind: 'cash', color: 3, starter: true },
  ];
}
export const openAccounts = (settings) => listAccounts(settings).filter((a) => !a.archived);

/** Where entries without an accountId belong. */
export function legacyAccountId(settings) {
  const all = listAccounts(settings);
  const pinned = settings?.accountsLegacy;
  if (pinned && all.some((a) => a.id === pinned)) return pinned;
  return all.find((a) => a.id === MAIN)?.id ?? all.find((a) => a.kind === 'bank')?.id ?? all[0]?.id ?? MAIN;
}
export function cashAccountId(settings) {
  const all = listAccounts(settings);
  return all.find((a) => a.id === CASH && a.kind === 'cash')?.id ?? all.find((a) => a.kind === 'cash' && !a.archived)?.id ?? all.find((a) => a.kind === 'cash')?.id ?? null;
}
/** The account a new entry starts on. */
export function defaultAccountId(settings) {
  const open = openAccounts(settings);
  const d = settings?.defaultAccount;
  if (d && open.some((a) => a.id === d)) return d;
  return open.find((a) => a.kind === 'bank')?.id ?? open[0]?.id ?? MAIN;
}

/** The account an entry is on. `source` 'transaction' | 'income'. */
export function accountOf(entry, settings, ids = null) {
  const known = ids ?? new Set(listAccounts(settings).map((a) => a.id));
  if (entry?.accountId && known.has(entry.accountId)) return entry.accountId;
  if (entry?.paidWith === 'cash') return cashAccountId(settings) ?? legacyAccountId(settings);
  return legacyAccountId(settings);
}

/** The open account whose last 4 digits match "••3889" / "3889" (SMS, statements), or null. */
export function accountByLast4(settings, digits) {
  const d = String(digits ?? '').replace(/\D/g, '').slice(-4);
  if (d.length < 3) return null;
  const hits = openAccounts(settings).filter((a) => a.last4 && (a.last4 === d || a.last4.endsWith(d) || d.endsWith(a.last4)));
  return hits.length === 1 ? hits[0].id : null;   // two cards ending the same: don't guess
}

/** Fields to store on an entry for an account (keeps paidWith for older screens and exports). */
export function accountFields(accountId, settings) {
  const acc = listAccounts(settings).find((a) => a.id === accountId);
  if (!acc) return {};
  return { accountId: acc.id, ...(acc.kind === 'cash' ? { paidWith: 'cash' } : {}) };
}
/** Same, for an update: removes paidWith when the account isn't cash. */
export function applyAccount(entry, accountId, settings) {
  const { paidWith: _p, ...rest } = entry;
  return { ...rest, ...accountFields(accountId, settings) };
}

/* ── What an entry does to accounts ───────────────────────────── */

const OUT_DIRECTIONS = new Set(['lent', 'repaid', 'given_gift']);
const IN_DIRECTIONS = new Set(['borrowed', 'repayment']);

/** True for a move between your own accounts (incl. a cash withdrawal). */
export const isTransfer = (t) => t?.type === 'cash';

/**
 * [{ id, p }] — the change (in paise) the entry makes to each account.
 * Mirrors the Home balance (utils/finance.computeStats).
 */
export function entryEffects(entry, source, settings, ids = null) {
  if (!entry || entry.isCarryForward) return [];
  const p = paise(entry.amount);
  if (!p) return [];
  const acc = accountOf(entry, settings, ids);
  if (source === 'income') return [{ id: acc, p }];
  switch (entry.type) {
    case 'cash': {
      const known = ids ?? new Set(listAccounts(settings).map((a) => a.id));
      const to = entry.toAccountId && known.has(entry.toAccountId) ? entry.toAccountId : cashAccountId(settings);
      if (!to || to === acc) return [];
      // A legacy withdrawal marked paidWith never existed, so `acc` is the bank
      const from = entry.accountId && known.has(entry.accountId) ? entry.accountId : legacyAccountId(settings);
      return from === to ? [] : [{ id: from, p: -p }, { id: to, p }];
    }
    case 'external': return [];   // only the profit counts, posted as income
    case 'expense': return entry.paidFrom === 'savings' ? [] : [{ id: acc, p: -p }];
    case 'savings': return [{ id: acc, p: -p }];
    case 'person': {
      const dir = entry.direction ?? 'lent';
      if (IN_DIRECTIONS.has(dir)) return [{ id: acc, p }];
      if (OUT_DIRECTIONS.has(dir)) return [{ id: acc, p: -p }];
      return [];
    }
    default: return [{ id: acc, p: -p }];
  }
}

/** Per account, per day: Map(id → Map(dayKey → paise)). */
function dailyByAccount(transactions, income, settings) {
  const ids = new Set(listAccounts(settings).map((a) => a.id));
  const out = new Map();
  const bump = (id, key, p) => {
    if (!out.has(id)) out.set(id, new Map());
    const m = out.get(id);
    m.set(key, (m.get(key) ?? 0) + p);
  };
  const run = (list, source) => list.forEach((e) => {
    const key = localDateKey(e.date);
    if (!key) return;
    entryEffects(e, source, settings, ids).forEach(({ id, p }) => bump(id, key, p));
  });
  run(transactions, 'transaction');
  run(income, 'income');
  return out;
}

/* ── Starter balances (before set-up) ─────────────────────────── */

/** Today's Home balance (this month + what carried in) — as netWorth does. */
function homeBalance(transactions, income, settings, todayKey) {
  const live = transactions.filter((t) => !t.isCarryForward);
  const liveIn = income.filter((i) => !i.isCarryForward);
  const monthKey = todayKey.slice(0, 7);
  const inMonth = (list) => list.filter((x) => localMonthKey(x.date) === monthKey);
  const carry = computeCarryForward({ transactions: live, income: liveIn, settings, upToMonth: monthKey })[monthKey];
  return computeStats(inMonth(live), inMonth(liveIn), {}).balance + (carry?.amount ?? 0);
}

/**
 * Anchors for the starter accounts: { [id]: { opening, openingDate } } so
 * that today MAIN + CASH = the Home balance and CASH = cash in hand.
 * Also what gets saved when the person first sets accounts up.
 */
export function starterAnchors(transactions = [], income = [], settings = {}, todayKey = toKey(new Date())) {
  const inHand = cashSummary(transactions).inHand;
  const total = homeBalance(transactions, income, settings, todayKey);
  const daily = dailyByAccount(transactions, income, { ...settings, accounts: undefined });
  const today = (id) => daily.get(id)?.get(todayKey) ?? 0;
  return {
    [MAIN]: { opening: r2(paise(total - inHand) - today(MAIN)), openingDate: todayKey },
    [CASH]: { opening: r2(paise(inHand) - today(CASH)), openingDate: todayKey },
  };
}

/** The accounts to save the first time someone edits them. */
export function materialise(transactions, income, settings, todayKey = toKey(new Date())) {
  if (accountsSetUp(settings)) return settings.accounts;
  const a = starterAnchors(transactions, income, settings, todayKey);
  return listAccounts(settings).map(({ starter: _s, ...acc }) => ({ ...acc, ...a[acc.id] }));
}

/* ── Balances ─────────────────────────────────────────────────── */

/**
 * Every account with its balance today and this month's in / out.
 * @returns {{ accounts: Array<acc & { balance, monthIn, monthOut, count }>, total, banks, cash, cardsDue, setUp }}
 */
export function accountBalances(transactions = [], income = [], settings = {}, todayKey = toKey(new Date())) {
  const setUp = accountsSetUp(settings);
  const anchors = setUp ? null : starterAnchors(transactions, income, settings, todayKey);
  const daily = dailyByAccount(transactions, income, settings);
  const month = todayKey.slice(0, 7);
  const accounts = listAccounts(settings).map((acc) => {
    const a = anchors?.[acc.id] ?? acc;
    const from = a.openingDate ?? '0000-00-00';
    let p = paise(a.opening), mIn = 0, mOut = 0, count = 0;
    (daily.get(acc.id) ?? new Map()).forEach((v, key) => {
      count += 1;
      if (key >= from && key <= todayKey) p += v;
      if (key.slice(0, 7) === month) { if (v > 0) mIn += v; else mOut -= v; }
    });
    return { ...acc, opening: r2(paise(a.opening)), openingDate: a.openingDate ?? null, balance: r2(p), monthIn: r2(mIn), monthOut: r2(mOut), days: count };
  });
  const open = accounts.filter((a) => !a.archived || Math.abs(a.balance) >= 0.005);
  const sum = (f) => r2(open.filter(f).reduce((s, a) => s + paise(a.balance), 0));
  return {
    accounts, setUp,
    total: sum(() => true),
    banks: sum((a) => a.kind === 'bank'),
    cash: sum((a) => a.kind === 'cash'),
    cardsDue: r2(-open.filter((a) => a.kind === 'card').reduce((s, a) => s + paise(a.balance), 0)),
  };
}

/** Cash in hand: the balance of your cash account(s). */
export function cashInHand(transactions, income, settings, todayKey) {
  return accountBalances(transactions, income, settings, todayKey).cash;
}

/**
 * The opening to store so the account shows `balance` today (what the
 * bank app says now). Today's entries already on it are kept out.
 */
export function anchorFor(accountId, balance, transactions, income, settings, todayKey = toKey(new Date())) {
  const today = dailyByAccount(transactions, income, settings).get(accountId)?.get(todayKey) ?? 0;
  return { opening: r2(paise(balance) - today), openingDate: todayKey };
}

/* ── History lines (Stats) ────────────────────────────────────── */

export const GROUPS = [
  { key: 'bank', label: 'Banks', color: 1 },
  { key: 'cash', label: 'Cash', color: 3 },
  { key: 'card', label: 'Cards', color: 2 },
];

/**
 * Balance at the end of each day, per account and per kind, plus the total.
 * @returns {{ points: Array<{ key, total, [accountId], [g_kind] }>, accounts, groups }}
 */
export function accountTimeline(transactions = [], income = [], settings = {}, { days = 30, todayKey = toKey(new Date()) } = {}) {
  const { accounts } = accountBalances(transactions, income, settings, todayKey);
  const daily = dailyByAccount(transactions, income, settings);
  let first = todayKey;
  daily.forEach((m) => m.forEach((_, k) => { if (k < first) first = k; }));
  accounts.forEach((a) => { if (a.openingDate && a.openingDate < first) first = a.openingDate; });
  let from = days ? addDays(todayKey, -(days - 1)) : first;
  if (from < first) from = first;
  // Walk back from today's balance: end of day d = balance − changes after d
  const shown = accounts.filter((a) => !a.archived || Math.abs(a.balance) >= 0.005 || a.days > 0);
  const series = shown.map((a) => {
    const m = daily.get(a.id) ?? new Map();
    const vals = new Map();
    let p = paise(a.balance);
    for (let k = todayKey; k >= from; k = addDays(k, -1)) {
      vals.set(k, p);
      p -= m.get(k) ?? 0;   // end of the day before
    }
    return { a, vals };
  });
  const points = [];
  for (let k = from; k <= todayKey; k = addDays(k, 1)) {
    const pt = { key: k, total: 0 };
    GROUPS.forEach((g) => { pt[`g_${g.key}`] = 0; });
    series.forEach(({ a, vals }) => {
      const v = vals.get(k) ?? 0;
      pt[a.id] = v / 100;
      pt[`g_${a.kind}`] += v / 100;
      pt.total += v / 100;
    });
    pt.total = Math.round(pt.total * 100) / 100;
    GROUPS.forEach((g) => { pt[`g_${g.key}`] = Math.round(pt[`g_${g.key}`] * 100) / 100; });
    points.push(pt);
  }
  const groups = GROUPS.filter((g) => shown.some((a) => a.kind === g.key));
  return { points, accounts: shown, groups };
}

/** Entries on one account, newest first: [{ entry, source, p }] */
export function accountEntries(accountId, transactions = [], income = [], settings = {}) {
  const ids = new Set(listAccounts(settings).map((a) => a.id));
  const out = [];
  const run = (list, source) => list.forEach((e) => {
    const hit = entryEffects(e, source, settings, ids).find((x) => x.id === accountId);
    if (hit) out.push({ entry: e, source, p: hit.p / 100 });
  });
  run(transactions, 'transaction');
  run(income, 'income');
  return out.sort((a, b) => new Date(b.entry.date) - new Date(a.entry.date));
}

/** Next unused colour slot (1–8, then repeats). */
export function nextColor(accounts = []) {
  const used = new Set(accounts.map((a) => Number(a.color)));
  for (let i = 1; i <= 8; i += 1) if (!used.has(i)) return i;
  return (accounts.length % 8) + 1;
}
