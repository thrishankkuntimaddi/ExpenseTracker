// ─── Finance calculations (pure, unit-tested) ────────────────────
// Every balance / total in the app is derived here so the rules live in one
// place. useStats wraps these in useMemo; nothing here touches React.

/* ── Income kinds ────────────────────────────────────────────────
   Income entries record *cash inflows*. They come in three kinds,
   historically stored as boolean flags on the document:
     'income'    — real earnings
     'borrowed'  — money I borrowed (inflow, but I owe it back)   isBorrowed
     'repayment' — money returned by someone I lent to            isRepaymentRec
   Always classify through incomeKind() rather than reading the flags.
─────────────────────────────────────────────────────────────────── */
export const INCOME_KINDS = ['income', 'borrowed', 'repayment'];

export function incomeKind(entry) {
  if (entry?.isRepaymentRec) return 'repayment';
  if (entry?.isBorrowed) return 'borrowed';
  return 'income';
}

/** Flags to store for a given income kind (inverse of incomeKind). */
export function incomeKindFlags(kind) {
  return { isBorrowed: kind === 'borrowed', isRepaymentRec: kind === 'repayment' };
}

/* ── Money arithmetic ──
   Sum in integer paise so 0.1 + 0.2 style float error never accumulates. */
export function sumAmounts(items, pick = (x) => x.amount) {
  const paise = items.reduce((s, x) => s + Math.round((Number(pick(x)) || 0) * 100), 0);
  return paise / 100;
}

const byType = (type) => (t) => t.type === type;
const byDirection = (dir) => (t) => t.type === 'person' && t.direction === dir;
const byKind = (kind) => (i) => incomeKind(i) === kind;

/* ── All-time per-person balances (carry across months) ── */
export function computePersonDebts(transactions = [], income = []) {
  const map = {};
  const entry = (name) => (map[name] ??= { borrowed: 0, repaid: 0, lent: 0, repaymentRec: 0 });
  const add = (bucket, field, amount) => { bucket[field] = sumAmounts([{ amount: bucket[field] }, { amount }]); };

  transactions.forEach((t) => {
    const name = t.type === 'person' ? t.name?.trim() : '';
    if (!name) return;
    const field = { borrowed: 'borrowed', repaid: 'repaid', lent: 'lent', repayment: 'repaymentRec' }[t.direction];
    if (field) add(entry(name), field, t.amount ?? 0);
  });

  income.forEach((i) => {
    const name = i.name?.trim();
    if (!name) return;
    const kind = incomeKind(i);
    if (kind === 'borrowed')  add(entry(name), 'borrowed', i.amount ?? 0);
    if (kind === 'repayment') add(entry(name), 'repaymentRec', i.amount ?? 0);
  });

  const balances = {};
  Object.entries(map).forEach(([name, { borrowed, repaid, lent, repaymentRec }]) => {
    balances[name] = {
      borrowed, repaid, lent, repaymentRec,
      netOwed: Math.max(0, borrowed - repaid),     // money I owe this person
      netLent: Math.max(0, lent - repaymentRec),   // money this person owes me
    };
  });
  return balances;
}

/* ── Period totals + balance ──
   filtTxns / filtInc are already filtered to the selected period;
   personDebts is all-time. `now` is injectable for tests. */
export function computeStats(filtTxns, filtInc, personDebts, now = new Date()) {
  // Cash OUTFLOWS (money I gave out)
  const totalLent       = sumAmounts(filtTxns.filter(byDirection('lent')));
  const totalRepaidThem = sumAmounts(filtTxns.filter(byDirection('repaid')));
  const totalGivenGift  = sumAmounts(filtTxns.filter(byDirection('given_gift')));

  // Cash INFLOWS
  const totalRepaymentRec = sumAmounts(filtInc.filter(byKind('repayment')));
  const totalBorrowed     = sumAmounts(filtTxns.filter(byDirection('borrowed')))
                          + sumAmounts(filtInc.filter(byKind('borrowed')));
  const pureIncome        = sumAmounts(filtInc.filter(byKind('income')));

  const totalExpense = sumAmounts(filtTxns.filter(byType('expense')));
  const totalSavings = sumAmounts(filtTxns.filter(byType('savings')));
  const totalIncome  = pureIncome + totalBorrowed + totalRepaymentRec;

  const debts = Object.values(personDebts);
  const allTimeNetOwed   = sumAmounts(debts, (p) => p.netOwed);
  const allTimeNetLent   = sumAmounts(debts, (p) => p.netLent);
  const allTimeNetPerson = allTimeNetLent - allTimeNetOwed;

  const totalWaste = sumAmounts(filtTxns, (t) => t.wasteAmount || 0);
  const externalProfit = sumAmounts(
    filtTxns.filter(byType('external')),
    (t) => (t.settlement ?? t.amount) - t.amount,
  );

  // Balance = all cash inflows − all cash outflows
  const balance = Math.round((
    pureIncome + totalBorrowed + totalRepaymentRec + externalProfit
    - totalExpense - totalSavings - totalLent - totalRepaidThem - totalGivenGift
  ) * 100) / 100;

  const totalSpend   = totalExpense + totalSavings + totalLent + totalRepaidThem + totalGivenGift;
  const wastePercent = totalSpend > 0 ? ((totalWaste / totalSpend) * 100).toFixed(1) : '0.0';

  const firstDate = [...filtTxns, ...filtInc].reduce((min, t) => {
    const d = new Date(t.date);
    return d < min ? d : min;
  }, now);
  const days   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
  const weeks  = Math.max(1, days / 7);
  const months = Math.max(1, days / 30);
  const spend  = totalExpense + totalLent + totalRepaidThem + totalGivenGift;

  return {
    totalIncome, pureIncome, totalExpense, totalSavings,
    totalLent, totalRepaidThem, totalBorrowed, totalRepaymentRec, totalGivenGift,
    allTimeNetOwed, allTimeNetLent, allTimeNetPerson, personDebts,
    totalWaste, externalProfit, balance, wastePercent,
    avgDay: spend / days, avgWeek: spend / weeks, avgMonth: spend / months,
  };
}

/* ── Billing-session settlement matching ──
   Finds the income / expense entries that belong to a billing session's
   settlement. Matching is by externalSessionId or the stored settlementId;
   exact-name matching is only a fallback for legacy entries created before
   externalSessionId existed. Matched entries may be deleted by the caller,
   so this must never match loosely (substring etc.). */
export function findSettlementMatches({ sessionId, settlementId, persons, sessionName }, transactions = [], income = []) {
  const matchingIncomes = income.filter(
    (i) => i.externalSessionId === sessionId || (settlementId && i.id === settlementId) ||
      (!i.externalSessionId && i.tag === 'External Settlement' && (i.name === persons || i.name === sessionName))
  );
  const matchingTxns = transactions.filter(
    (t) => t.externalSessionId === sessionId || (settlementId && t.id === settlementId) ||
      (!t.externalSessionId && t.category === 'External' && t.name === `External – ${persons}`)
  );
  return { matchingIncomes, matchingTxns };
}
