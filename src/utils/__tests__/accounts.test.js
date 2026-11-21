import { describe, it, expect } from 'vitest';
import {
  MAIN, CASH, listAccounts, accountOf, entryEffects, accountBalances, starterAnchors, materialise,
  anchorFor, accountTimeline, accountEntries, applyAccount, accountFields, defaultAccountId, nextColor, accountLabel,
} from '../accounts';
import { debtLedger } from '../debts';

const d = (day, month = 10) => new Date(2026, month, day, 12).toISOString();   // Nov 2026
const TODAY = '2026-11-21';

const SET = {
  accounts: [
    { id: 'sbi', name: 'SBI', bank: 'SBI', kind: 'bank', tag: 'Salary', color: 1, opening: 50000, openingDate: '2026-11-01' },
    { id: 'hdfc', name: 'HDFC', bank: 'HDFC', kind: 'bank', tag: 'Bills', color: 4, opening: 10000, openingDate: '2026-11-01' },
    { id: 'wallet', name: 'Cash', kind: 'cash', color: 3, opening: 2000, openingDate: '2026-11-01' },
    { id: 'card', name: 'HDFC Millennia', kind: 'card', color: 2, opening: -3000, openingDate: '2026-11-01' },
  ],
  accountsLegacy: 'sbi',
};

describe('accounts — before set-up', () => {
  it('offers Bank · UPI and Cash', () => {
    expect(listAccounts({}).map((a) => a.id)).toEqual([MAIN, CASH]);
    expect(defaultAccountId({})).toBe(MAIN);
  });

  it('old entries land on Cash when paid in cash, otherwise on Bank', () => {
    expect(accountOf({ paidWith: 'cash' }, {})).toBe(CASH);
    expect(accountOf({}, {})).toBe(MAIN);
    expect(accountOf({ accountId: 'gone' }, {})).toBe(MAIN);
  });

  it('starts exactly where Home was: Bank + Cash = the balance, Cash = cash in hand', () => {
    const txns = [
      { id: 'w', type: 'cash', name: 'ATM', amount: 2000, date: d(2) },
      { id: 'e1', type: 'expense', name: 'Veg', amount: 300, paidWith: 'cash', date: d(3) },
      { id: 'e2', type: 'expense', name: 'Swiggy', amount: 700, date: d(21) },
    ];
    const inc = [{ id: 'i', type: 'income', name: 'Salary', amount: 30000, date: d(1) }];
    const b = accountBalances(txns, inc, {}, TODAY);
    const by = Object.fromEntries(b.accounts.map((a) => [a.id, a.balance]));
    expect(by[CASH]).toBe(1700);
    expect(by[MAIN]).toBe(30000 - 300 - 700 - 1700);
    expect(b.total).toBe(29000);
    expect(b.setUp).toBe(false);
  });

  it('saving the starter accounts keeps today’s balances', () => {
    const txns = [{ id: 'e', type: 'expense', name: 'Tea', amount: 20, date: d(21) }];
    const inc = [{ id: 'i', type: 'income', name: 'Salary', amount: 1000, date: d(1) }];
    const before = accountBalances(txns, inc, {}, TODAY).accounts.map((a) => a.balance);
    const saved = { accounts: materialise(txns, inc, {}, TODAY) };
    expect(saved.accounts.every((a) => !a.starter && a.openingDate === TODAY)).toBe(true);
    expect(accountBalances(txns, inc, saved, TODAY).accounts.map((a) => a.balance)).toEqual(before);
    // and a new expense on the bank today still comes off it
    const after = accountBalances([...txns, { id: 'x', type: 'expense', name: 'Lunch', amount: 100, accountId: MAIN, date: d(21) }], inc, saved, TODAY);
    expect(after.accounts.find((a) => a.id === MAIN).balance).toBe(before[0] - 100);
  });

  it('starterAnchors leaves today’s entries out of the opening', () => {
    const a = starterAnchors([{ id: 'e', type: 'expense', name: 'Tea', amount: 20, date: d(21) }], [{ id: 'i', name: 'S', amount: 100, date: d(1) }], {}, TODAY);
    expect(a[MAIN]).toEqual({ opening: 100, openingDate: TODAY });
  });
});

describe('accounts — what an entry does', () => {
  it('Hanudeep: lent by PhonePe, got back in cash', () => {
    const txns = [{ id: 'l', type: 'person', direction: 'lent', name: 'Muzammil', amount: 1000, accountId: 'sbi', date: d(5) }];
    const inc = [{ id: 'g', type: 'income', isRepaymentRec: true, name: 'Muzammil', amount: 1000, ...accountFields('wallet', SET), date: d(10) }];
    const by = Object.fromEntries(accountBalances(txns, inc, SET, TODAY).accounts.map((a) => [a.id, a.balance]));
    expect(by.sbi).toBe(49000);
    expect(by.wallet).toBe(3000);
    expect(debtLedger(txns, inc)[0].settled).toBe(true);   // still settles the debt
    expect(inc[0].paidWith).toBe('cash');
  });

  it('every move: in adds, out takes', () => {
    const e = (x) => entryEffects({ amount: 100, accountId: 'sbi', date: d(5), ...x }, 'transaction', SET);
    expect(e({ type: 'expense' })).toEqual([{ id: 'sbi', p: -10000 }]);
    expect(e({ type: 'expense', paidFrom: 'savings' })).toEqual([]);
    expect(e({ type: 'savings' })).toEqual([{ id: 'sbi', p: -10000 }]);
    expect(e({ type: 'person', direction: 'lent' })).toEqual([{ id: 'sbi', p: -10000 }]);
    expect(e({ type: 'person', direction: 'repaid' })).toEqual([{ id: 'sbi', p: -10000 }]);
    expect(e({ type: 'person', direction: 'borrowed' })).toEqual([{ id: 'sbi', p: 10000 }]);
    expect(e({ type: 'external' })).toEqual([]);
    expect(entryEffects({ amount: 100, accountId: 'hdfc', date: d(5) }, 'income', SET)).toEqual([{ id: 'hdfc', p: 10000 }]);
    expect(entryEffects({ amount: 100, isCarryForward: true, date: d(5) }, 'income', SET)).toEqual([]);
  });

  it('moving money: bank → bank, ATM, card bill', () => {
    const mv = (x) => entryEffects({ type: 'cash', name: 'Move', amount: 500, date: d(5), ...x }, 'transaction', SET);
    expect(mv({ accountId: 'sbi', toAccountId: 'hdfc' })).toEqual([{ id: 'sbi', p: -50000 }, { id: 'hdfc', p: 50000 }]);
    expect(mv({ accountId: 'hdfc' })).toEqual([{ id: 'hdfc', p: -50000 }, { id: 'wallet', p: 50000 }]);
    expect(mv({})).toEqual([{ id: 'sbi', p: -50000 }, { id: 'wallet', p: 50000 }]);   // an old ATM withdrawal
    expect(mv({ accountId: 'sbi', toAccountId: 'sbi' })).toEqual([]);
  });

  it('a credit card: spending adds to what’s due, paying the bill clears it', () => {
    const txns = [
      { id: 'c', type: 'expense', name: 'Amazon', amount: 2000, accountId: 'card', date: d(6) },
      { id: 'p', type: 'cash', name: 'Card bill', amount: 5000, accountId: 'sbi', toAccountId: 'card', date: d(15) },
    ];
    const b = accountBalances(txns, [], SET, TODAY);
    expect(b.accounts.find((a) => a.id === 'card').balance).toBe(0);
    expect(b.cardsDue).toBe(0);
    expect(b.banks).toBe(55000);
    expect(b.total).toBe(57000);
  });

  it('entries before the start date are history: they don’t move today’s balance', () => {
    const b = accountBalances([{ id: 'o', type: 'expense', name: 'Old', amount: 900, accountId: 'sbi', date: d(20, 9) }], [], SET, TODAY);
    expect(b.accounts.find((a) => a.id === 'sbi').balance).toBe(50000);
  });

  it('untagged entries go to the pinned account even after the default changes', () => {
    expect(accountOf({}, { ...SET, defaultAccount: 'hdfc' })).toBe('sbi');
    expect(defaultAccountId({ ...SET, defaultAccount: 'hdfc' })).toBe('hdfc');
  });
});

describe('accounts — helpers', () => {
  it('anchorFor: set the balance to what the bank app shows now', () => {
    const txns = [{ id: 'e', type: 'expense', name: 'Tea', amount: 50, accountId: 'hdfc', date: d(21) }];
    const a = anchorFor('hdfc', 8000, txns, [], SET, TODAY);
    const set = { ...SET, accounts: SET.accounts.map((x) => (x.id === 'hdfc' ? { ...x, ...a } : x)) };
    expect(accountBalances(txns, [], set, TODAY).accounts.find((x) => x.id === 'hdfc').balance).toBe(8000);
  });

  it('timeline walks back from today, per account and per kind', () => {
    const txns = [{ id: 'e', type: 'expense', name: 'Rent', amount: 15000, accountId: 'sbi', date: d(19) }];
    const tl = accountTimeline(txns, [], SET, { days: 3, todayKey: TODAY });
    expect(tl.points.map((p) => p.key)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21']);
    expect(tl.points[2].sbi).toBe(35000);
    expect(tl.points[0].g_bank).toBe(45000);
    expect(tl.points[0].g_card).toBe(-3000);
    expect(tl.groups.map((g) => g.key)).toEqual(['bank', 'cash', 'card']);
    // before the rent day
    expect(accountTimeline(txns, [], SET, { days: 4, todayKey: TODAY }).points[0].sbi).toBe(50000);
  });

  it('applyAccount switches cash on and off', () => {
    expect(applyAccount({ id: 'x', paidWith: 'cash' }, 'sbi', SET)).toEqual({ id: 'x', accountId: 'sbi' });
    expect(applyAccount({ id: 'x' }, 'wallet', SET)).toEqual({ id: 'x', accountId: 'wallet', paidWith: 'cash' });
  });

  it('accountEntries lists both stores', () => {
    const txns = [{ id: 'l', type: 'person', direction: 'lent', name: 'A', amount: 10, accountId: 'wallet', date: d(5) }];
    const inc = [{ id: 'g', name: 'A', isRepaymentRec: true, amount: 10, accountId: 'wallet', date: d(6) }];
    expect(accountEntries('wallet', txns, inc, SET).map((x) => [x.entry.id, x.p])).toEqual([['g', 10], ['l', -10]]);
  });

  it('colours and labels', () => {
    expect(nextColor(SET.accounts)).toBe(5);
    expect(accountLabel({ bank: 'HDFC', last4: '4521' })).toBe('HDFC ••4521');
  });
});

describe('accounts — matching by last 4 digits', async () => {
  const { accountByLast4 } = await import('../accounts');
  const { parsePayment, detectionToEntry } = await import('../paymentCapture');
  const S = { accounts: [
    { id: 'ib', name: 'Indian Bank', kind: 'bank', last4: '3889', color: 1, opening: 0, openingDate: '2026-11-01' },
    { id: 'hd', name: 'HDFC', kind: 'bank', last4: '0098', color: 2, opening: 0, openingDate: '2026-11-01' },
    { id: 'c1', name: 'Card A', kind: 'card', last4: '1111', color: 3, opening: 0, openingDate: '2026-11-01' },
    { id: 'c2', name: 'Card B', kind: 'card', last4: '1111', color: 4, opening: 0, openingDate: '2026-11-01' },
  ] };
  it('finds the one account ending in those digits', () => {
    expect(accountByLast4(S, '••3889')).toBe('ib');
    expect(accountByLast4(S, 'XX098')).toBe('hd');
    expect(accountByLast4(S, '1111')).toBe(null);   // two match: don't guess
    expect(accountByLast4(S, '42')).toBe(null);
    expect(accountByLast4({}, '3889')).toBe(null);
  });
  it('a bank SMS lands on that account', () => {
    const d = parsePayment({ pkg: 'com.google.android.apps.messaging', title: 'IndBnk', text: 'Rs.250.00 debited from A/c XX3889 on 21-11-26 to VPA swiggy@icici UPI Ref 1234', time: Date.parse('2026-11-21T10:00:00Z') });
    expect(d?.account).toBe('••3889');
    const { entry } = detectionToEntry({ ...d, ids: ['n1'] }, { accountFor: (x) => (accountByLast4(S, x) ? { accountId: accountByLast4(S, x) } : null) });
    expect(entry.accountId).toBe('ib');
  });
});
