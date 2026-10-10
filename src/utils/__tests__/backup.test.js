import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, toPlain, describeBackup, BACKUP_FORMAT, BACKUP_COLLECTIONS } from '../backup';

const ts = (iso) => ({ toDate: () => new Date(iso) }); // Firestore Timestamp stand-in
const txn  = { id: 't1', name: 'Chai', amount: 20, date: '2026-10-10T00:00:00.000Z', type: 'expense', updatedAt: ts('2026-10-10T05:00:00Z') };
const inc  = { id: 'i1', name: 'Salary', amount: 50000, date: '2026-10-01T00:00:00.000Z' };
const bill = { id: 'b1', date: '2026-10-05', rows: [{ name: 'Lunch', amount: 300 }], status: 'open', linkedIncomeId: 'i1' };
const trip = { id: 'p1', name: 'Goa', members: [{ id: 'm1', name: 'Me' }], expenses: [], settlements: [] };
const rule = { id: 'r1', name: 'Rent', amount: 15000, kind: 'expense', frequency: 'monthly' };
const trash = { id: 't9', itemType: 'transaction', originalData: { id: 't9', name: 'Old', amount: 5 }, deletedAt: '2026-10-09T00:00:00Z' };

const full = () => buildBackup({
  email: 'me@example.test',
  settings: { theme: 'light', budgets: { total: 20000 } },
  collections: { transactions: [txn], income: [inc], external_transactions: [bill], trips: [trip], recurring: [rule], recently_deleted: [trash] },
}, new Date('2026-10-10T07:00:00Z'));

describe('buildBackup', () => {
  it('includes every collection, including billings and trips', () => {
    const b = full();
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.version).toBe(2);
    for (const name of BACKUP_COLLECTIONS) expect(b[name]).toHaveLength(1);
    expect(b.external_transactions[0].linkedIncomeId).toBe('i1');
  });
  it('turns Firestore Timestamps into ISO strings', () => {
    expect(full().transactions[0].updatedAt).toBe('2026-10-10T05:00:00.000Z');
    expect(toPlain({ a: [ts('2026-01-01T00:00:00Z')], b: null })).toEqual({ a: ['2026-01-01T00:00:00.000Z'], b: null });
  });
});

describe('parseBackup', () => {
  it('round-trips a full backup, keeping ids and dropping server metadata', () => {
    const p = parseBackup(JSON.stringify(full()));
    expect(p.version).toBe(2);
    expect(p.transactions[0]).toEqual({ id: 't1', name: 'Chai', amount: 20, date: '2026-10-10T00:00:00.000Z', type: 'expense' });
    expect(p.external_transactions[0]).toEqual(bill);
    expect(p.trips[0]).toEqual(trip);
    expect(p.recurring[0]).toEqual(rule);
    expect(p.recently_deleted[0]).toEqual(trash);
    expect(p.settings).toEqual({ theme: 'light', budgets: { total: 20000 } });
    expect(p.skipped).toEqual({});
  });
  it('still reads old v1 exports (transactions, income, settings only)', () => {
    const p = parseBackup(JSON.stringify({ transactions: [txn], income: [inc], settings: { theme: 'monoflow' } }));
    expect(p.version).toBe(1);
    expect(p.transactions).toHaveLength(1);
    expect(p.trips).toEqual([]);
    expect(p.settings.theme).toBe('monoflow');
  });
  it('skips records the security rules would reject, and counts them', () => {
    const b = full();
    b.transactions.push({ id: 'bad', amount: 5 });             // no name/date
    b.trips.push({ id: 'p2', name: 'No members', expenses: [] });
    b.recurring.push({ ...rule, id: 'r2', kind: 'gift' });
    b.external_transactions.push({ id: 'a/b' });                 // slash breaks the path
    const p = parseBackup(JSON.stringify(b));
    expect(p.skipped).toEqual({ transactions: 1, trips: 1, recurring: 1, external_transactions: 1 });
    expect(p.transactions).toHaveLength(1);
  });
  it('coerces string amounts to numbers', () => {
    const p = parseBackup(JSON.stringify({ transactions: [{ ...txn, amount: '20.5' }], income: [] }));
    expect(p.transactions[0].amount).toBe(20.5);
  });
  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not an ExpenseTracker backup/);
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toThrow(/newer version/);
  });
});

describe('describeBackup', () => {
  it('lists what the file holds', () => {
    expect(describeBackup(full())).toBe('1 transactions, 1 income entries, 1 billings, 1 trips, 1 recurring rules, 1 items in trash');
    expect(describeBackup({})).toBe('no records');
  });
});
