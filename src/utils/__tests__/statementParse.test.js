import { describe, it, expect } from 'vitest';
import { parseDateIN, parseAmountIN, readHeader, rowsToLines, readNarration, linesToItems, itemsToRecords, summarise, pdfItemsToRows, textLinesToLines } from '../statementParse';
import { parseCSV } from '../importHelpers';

describe('dates and amounts', () => {
  it('dates', () => {
    expect(parseDateIN('12/11/2026')).toBe('2026-11-12');
    expect(parseDateIN('12-11-26')).toBe('2026-11-12');
    expect(parseDateIN('12 Nov 2026')).toBe('2026-11-12');
    expect(parseDateIN('12-NOV-26')).toBe('2026-11-12');
    expect(parseDateIN('2026-11-12')).toBe('2026-11-12');
    expect(parseDateIN(46338)).toBe('2026-11-12');          // Excel serial
    expect(parseDateIN('Opening Balance')).toBe(null);
  });
  it('amounts', () => {
    expect(parseAmountIN('1,23,456.78')).toEqual({ value: 123456.78, sign: 0 });
    expect(parseAmountIN('500.00 Dr')).toEqual({ value: 500, sign: -1 });
    expect(parseAmountIN('500.00 Cr')).toEqual({ value: 500, sign: 1 });
    expect(parseAmountIN('(250.00)').sign).toBe(-1);
    expect(Number.isNaN(parseAmountIN('').value)).toBe(true);
    expect(Number.isNaN(parseAmountIN('-').value)).toBe(true);
  });
});

describe('statement layouts', () => {
  it('HDFC-style CSV: withdrawal and deposit columns, account details above', () => {
    const csv = [
      'HDFC BANK Ltd.,,,,,,',
      'Account No :,50100XXXXXX123,,,,,',
      ',,,,,,',
      'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '01/11/26,SALARY ACME TECHNOLOGIES PVT LTD NOV,0000123,01/11/26,,"65,000.00","70,000.00"',
      '04/11/26,UPI-SWIGGY-SWIGGY@YBL-YESB0000001-412345678901-PAYMENT,0000412,04/11/26,450.00,,"69,550.00"',
      '05/11/26,NWD-4123XXXXXXXX1234-ATM-HYDERABAD,0000555,05/11/26,"2,000.00",,"67,550.00"',
      '07/11/26,ACH D- BAJAJ FINANCE LTD-P400SAFL123,0000777,07/11/26,"3,800.00",,"63,750.00"',
      ',,,,,,',
      'STATEMENT SUMMARY :-,,,,,,',
    ].join('\n');
    const { lines } = rowsToLines(parseCSV(csv));
    expect(lines.map((l) => [l.date, l.amount, l.dir])).toEqual([
      ['2026-11-01', 65000, 'in'], ['2026-11-04', 450, 'out'], ['2026-11-05', 2000, 'out'], ['2026-11-07', 3800, 'out'],
    ]);
  });
  it('SBI-style: one amount column with Dr/Cr, and a narration that wraps', () => {
    const rows = [
      ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Amount', 'Dr / Cr', 'Balance'],
      ['3 Nov 2026', '3 Nov 2026', 'TO TRANSFER-UPI/DR/412345678901/RAVI KUMAR/SBIN/ravi@oksbi/', '', '1,200.00', 'DR', '48,800.00'],
      ['', '', 'Lunch money', '', '', '', ''],
      ['8 Nov 2026', '8 Nov 2026', 'BY TRANSFER-NEFT*HDFC0000001*N312*MEENA R', '', '500.00', 'CR', '49,300.00'],
    ];
    const { lines } = rowsToLines(rows);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ date: '2026-11-03', amount: 1200, dir: 'out' });
    expect(lines[0].desc).toMatch(/Lunch money$/);
    expect(lines[1]).toMatchObject({ amount: 500, dir: 'in' });
  });
  it('one signed amount column, or none — the balance decides', () => {
    const rows = [
      ['Date', 'Particulars', 'Amount', 'Balance'],
      ['01-11-2026', 'Opening Balance', '', '10,000.00'],
      ['02-11-2026', 'POS 4123XXXXXX1234 DMART AVENUE', '1,500.00', '8,500.00'],
      ['03-11-2026', 'IMPS-412345-RAMESH', '2,000.00', '10,500.00'],
    ];
    const { lines } = rowsToLines(rows);
    expect(lines.map((l) => l.dir)).toEqual(['out', 'in']);
  });
  it('not a statement', () => {
    expect(readHeader(['Name', 'Phone'])).toBe(null);
    expect(rowsToLines([['a', 'b'], ['c', 'd']]).header).toBe(false);
  });
});

describe('narrations', () => {
  it('names', () => {
    expect(readNarration('UPI-SWIGGY-SWIGGY@YBL-YESB0000001-412345678901-PAYMENT').name).toBe('Swiggy');
    expect(readNarration('TO TRANSFER-UPI/DR/412345678901/RAVI KUMAR/SBIN/ravi@oksbi/').name).toBe('Ravi Kumar');
    expect(readNarration('UPI/412345678901/Paid to Zomato/zomato@hdfcbank').name).toBe('Zomato');
    expect(readNarration('POS 4123XXXXXXXX1234 AMAZON PAY IN').name).toBe('Amazon');
    expect(readNarration('ACH D- BAJAJ FINANCE LTD-P400SAFL123')).toMatchObject({ name: 'Bajaj Finance Ltd', autoDebit: true });
  });
  it('cash, salary, interest', () => {
    expect(readNarration('NWD-4123XXXXXXXX1234-ATM-HYDERABAD')).toMatchObject({ name: 'ATM withdrawal', cash: true });
    expect(readNarration('NEFT CR-ACME TECH PVT LTD-SALARY NOV 2026').salary).toBe(true);
    expect(readNarration('INT.PD 01-11-2026').name).toBe('Bank interest');
  });
});

describe('items', () => {
  const lines = [
    { date: '2026-11-04', desc: 'UPI-SWIGGY-SWIGGY@YBL-YESB0000001-412345678901-PAYMENT', amount: 450, dir: 'out' },
    { date: '2026-11-05', desc: 'NWD-4123XXXXXXXX1234-ATM-HYDERABAD', amount: 2000, dir: 'out' },
    { date: '2026-11-01', desc: 'SALARY ACME', amount: 65000, dir: 'in' },
  ];
  it('kinds, categories and duplicates', () => {
    const existing = { transactions: [{ type: 'expense', amount: 450, date: new Date(2026, 10, 4, 20).toISOString() }], income: [] };
    const items = linesToItems(lines, existing);
    expect(items.map((i) => i.kind)).toEqual(['expense', 'cash', 'income']);
    expect(items[0]).toMatchObject({ name: 'Swiggy', category: 'food', duplicate: true, include: false });
    expect(items[1].include).toBe(true);
    const s = summarise(items);
    expect(s).toMatchObject({ count: 2, cash: 2000, in: 65000, duplicates: 1 });
  });
  it('auto-debits become EMIs under Bills', () => {
    const [i] = linesToItems([{ date: '2026-11-07', desc: 'ACH D- BAJAJ FINANCE LTD-P400SAFL123', amount: 3800, dir: 'out' }]);
    expect(i).toMatchObject({ name: 'Bajaj Finance Ltd EMI', category: 'bills' });
  });
  it('the same statement twice gives the same ids', () => {
    const a = linesToItems(lines).map((i) => i.id), b = linesToItems(lines).map((i) => i.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });
  it('records', () => {
    const r = itemsToRecords(linesToItems(lines));
    expect(r.transactions.map((t) => t.type)).toEqual(['expense', 'cash']);
    expect(r.income[0]).toMatchObject({ amount: 65000, month: '2026-11', source: 'statement' });
  });
});

describe('PDF statements', () => {
  it('columns from positions, header repeated on page 2 skipped', () => {
    const it2 = (str, x, y) => ({ str, x, y, w: str.length * 5 });
    const page = (y0, withHeader) => [
      ...(withHeader ? [it2('Date', 40, y0), it2('Narration', 120, y0), it2('Withdrawal', 360, y0), it2('Deposit', 440, y0), it2('Balance', 520, y0)] : []),
      it2('04/11/2026', 40, y0 - 20), it2('UPI-SWIGGY-SWIGGY@YBL', 120, y0 - 20), it2('450.00', 365, y0 - 20), it2('69,550.00', 520, y0 - 20),
      it2('-YESB0000001-PAYMENT', 120, y0 - 30),
      it2('08/11/2026', 40, y0 - 50), it2('NEFT MEENA R', 120, y0 - 50), it2('500.00', 445, y0 - 50), it2('70,050.00', 520, y0 - 50),
    ];
    const rows = pdfItemsToRows([page(700, true), page(700, true)]);
    const { lines } = rowsToLines(rows);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ date: '2026-11-04', amount: 450, dir: 'out' });
    expect(lines[0].desc).toMatch(/PAYMENT/);
    expect(lines[1]).toMatchObject({ amount: 500, dir: 'in' });
  });
  it('plain text lines, balance decides', () => {
    const l = textLinesToLines([
      'Opening balance 10,000.00',
      '02/11/2026 POS DMART 1,500.00 8,500.00',
      '03/11/2026 IMPS RAMESH 2,000.00 10,500.00',
    ]);
    expect(l.map((x) => x.dir)).toEqual(['out', 'in']);
    expect(l[0]).toMatchObject({ date: '2026-11-02', amount: 1500, desc: 'POS DMART' });
    expect(l[1]).toMatchObject({ amount: 2000, dir: 'in' });
  });
});
