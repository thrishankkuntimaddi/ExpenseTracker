import { describe, it, expect } from 'vitest';
import { parseCSV, parseAmount, csvToRecords, prepareSheetRecords, normaliseDate } from '../importHelpers';
import { localDateKey } from '../dateHelpers';

describe('parseCSV', () => {
  it('handles quoted fields with commas, escaped quotes and CRLF', () => {
    const rows = parseCSV('name,amount\r\n"Rice, 5kg","1,200"\r\n"He said ""hi""",10\r\n');
    expect(rows).toEqual([
      ['name', 'amount'],
      ['Rice, 5kg', '1,200'],
      ['He said "hi"', '10'],
    ]);
  });
  it('keeps newlines inside quotes and drops blank lines', () => {
    expect(parseCSV('a\n"x\ny"\n\n')).toEqual([['a'], ['x\ny']]);
  });
});

describe('parseAmount', () => {
  it('strips currency symbols and thousands separators', () => {
    expect(parseAmount('1,200.50')).toBe(1200.5);
    expect(parseAmount('₹ 99')).toBe(99);
    expect(parseAmount('')).toBeNaN();
  });
});

describe('normaliseDate', () => {
  it('reads ISO and Indian DD/MM/YYYY dates as the same local day', () => {
    expect(localDateKey(normaliseDate('2026-03-05'))).toBe('2026-03-05');
    expect(localDateKey(normaliseDate('05/03/2026'))).toBe('2026-03-05');
    expect(normaliseDate('garbage')).toBeNull();
  });
});

describe('csvToRecords', () => {
  const csv = 'date,name,amount,type\n2026-03-01,"Rice, 5kg","1,200",expense\n2026-03-01,Salary,50000,income\n2026-03-01,Bad,abc,expense\n';

  it('splits income from transactions and skips invalid rows', () => {
    const r = csvToRecords(csv);
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0]).toMatchObject({ name: 'Rice, 5kg', amount: 1200, type: 'expense', month: '2026-03' });
    expect(r.income).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it('produces identical ids on re-import (no duplicates)', () => {
    const a = csvToRecords(csv), b = csvToRecords(csv);
    expect(a.transactions.map(t => t.id)).toEqual(b.transactions.map(t => t.id));
  });

  it('keeps genuinely repeated rows as distinct records', () => {
    const r = csvToRecords('date,name,amount\n2026-03-01,Tea,10\n2026-03-01,Tea,10\n');
    expect(new Set(r.transactions.map(t => t.id)).size).toBe(2);
  });

  it('rejects CSVs without required columns', () => {
    expect(() => csvToRecords('foo,bar\n1,2\n')).toThrow(/amount/);
  });
});

describe('prepareSheetRecords', () => {
  const pulled = {
    spreadsheetId: 'sheet1',
    income: [{ name: 'Salary', amount: 1000, type: 'income', row: 2, col: 'A' }],
    transactions: [{ name: 'Milk', amount: 30, type: 'expense', row: 2, col: 'D' }],
  };

  it('assigns stable ids and drops row/col', () => {
    const r = prepareSheetRecords(pulled, new Set());
    expect(r.transactions[0].id).toMatch(/^sheet_/);
    expect(r.transactions[0]).not.toHaveProperty('row');
    expect(r.duplicates).toBe(0);
  });

  it('skips rows already imported by an earlier pull', () => {
    const first = prepareSheetRecords(pulled, new Set());
    const existing = new Set([...first.transactions, ...first.income].map(x => x.id));
    const second = prepareSheetRecords(pulled, existing);
    expect(second.transactions).toEqual([]);
    expect(second.income).toEqual([]);
    expect(second.duplicates).toBe(2);
  });
});
