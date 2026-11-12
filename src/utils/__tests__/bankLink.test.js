import { describe, it, expect } from 'vitest';
import { fiToLines, fiDate, inboxId } from '../../../server/functions/fi.js';
import { linesToItems } from '../statementParse';

// Shape of a Setu AA data session (FI data already decrypted by Setu)
const session = {
  fips: [{
    fipID: 'HDFC-FIP',
    accounts: [{
      maskedAccNumber: 'XXXXXX1234',
      data: { account: { transactions: { transaction: [
        { txnId: 'T1', type: 'DEBIT', mode: 'UPI', amount: '450.00', currentBalance: '19550.00', transactionTimestamp: '2026-11-03T21:40:00+05:30', valueDate: '2026-11-03', narration: 'UPI/P2M/612345678901/SWIGGY/Payment' },
        { txnId: 'T2', type: 'CREDIT', mode: 'NEFT', amount: '65000', currentBalance: '84550', transactionTimestamp: '2026-11-01T09:00:00+05:30', narration: 'NEFT-ACME PVT LTD-SALARY NOV' },
        { txnId: 'T3', type: 'DEBIT', amount: '0', narration: 'zero' },
        { txnId: 'T4', type: 'OPENING', amount: '100', narration: 'not a transaction' },
      ] } } },
    }],
  }],
};

describe('bank linking: Account Aggregator data', () => {
  it('turns FI transactions into statement lines, oldest first', () => {
    const lines = fiToLines(session);
    expect(lines).toEqual([
      { date: '2026-11-01', desc: 'NEFT-ACME PVT LTD-SALARY NOV', amount: 65000, dir: 'in', balance: 84550, account: '••1234', txnId: 'T2' },
      { date: '2026-11-03', desc: 'UPI/P2M/612345678901/SWIGGY/Payment', amount: 450, dir: 'out', balance: 19550, account: '••1234', txnId: 'T1' },
    ]);
  });
  it('dates by the bank\'s day, not UTC', () => {
    expect(fiDate('2026-11-03T00:30:00+05:30')).toBe('2026-11-03');
  });
  it('the same transaction always gets the same id (fetching again never doubles)', () => {
    const [a] = fiToLines(session);
    const [b] = fiToLines(JSON.parse(JSON.stringify(session)));
    expect(inboxId(a)).toBe(inboxId(b));
    expect(inboxId(a)).not.toBe(inboxId(fiToLines(session)[1]));
  });
  it('reviews like a statement: names cleaned, typed entries unticked', () => {
    const typed = [{ amount: 450, date: '2026-11-03T13:00:00.000Z', type: 'expense' }];
    const items = linesToItems(fiToLines(session), { transactions: typed, source: 'bank' });
    const swiggy = items.find((i) => i.amount === 450);
    expect(swiggy).toMatchObject({ name: 'Swiggy', kind: 'expense', duplicate: true });
    expect(items.find((i) => i.amount === 65000)).toMatchObject({ kind: 'income', duplicate: false });
  });
});
