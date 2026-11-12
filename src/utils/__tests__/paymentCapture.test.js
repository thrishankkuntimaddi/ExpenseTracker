import { describe, it, expect } from 'vitest';
import { parsePayment, mergeDetections, detectionToEntry, withoutKnown } from '../paymentCapture';

const GPAY = 'com.google.android.apps.nbu.paisa.user';
const SMS = 'com.google.android.apps.messaging';
const t = 1792000000000;
const p = (pkg, title, text) => parsePayment({ pkg, title, text, time: t });

describe('parsePayment — UPI apps', () => {
  it('Google Pay: paid and received', () => {
    expect(p(GPAY, 'Payment successful', 'You paid ₹50.00 to Raju Tea Stall')).toMatchObject({ amount: 50, direction: 'debit', payee: 'Raju Tea Stall', source: 'Google Pay' });
    expect(p(GPAY, 'Ramesh sent you ₹500', 'Tap to view')).toMatchObject({ amount: 500, direction: 'credit', payee: 'Ramesh' });
  });
  it('PhonePe and Paytm', () => {
    expect(p('com.phonepe.app', 'Paid ₹199 to Swiggy', 'Payment successful')).toMatchObject({ amount: 199, direction: 'debit', payee: 'Swiggy' });
    expect(p('com.phonepe.app', 'Received ₹1,250 from Dinesh K', '')).toMatchObject({ amount: 1250, direction: 'credit', payee: 'Dinesh K' });
    expect(p('net.one97.paytm', 'Paid Rs.250 to Shell Petrol Pump', 'Paytm UPI')).toMatchObject({ amount: 250, direction: 'debit', payee: 'Shell Petrol Pump' });
  });
});

describe('parsePayment — bank SMS', () => {
  it('HDFC UPI sent', () => {
    expect(p(SMS, 'AD-HDFCBK', 'Sent Rs.120.00\nFrom HDFC Bank A/C *1234\nTo RAJU TEA\nOn 15/10/26\nRef 612345678901\nNot You? Call 18002586161'))
      .toMatchObject({ amount: 120, direction: 'debit', payee: 'Raju Tea', source: 'HDFC Bank SMS', account: '••1234' });
  });
  it('ICICI debit naming the receiver', () => {
    expect(p(SMS, 'VM-ICICIB', 'ICICI Bank Acct XX123 debited for Rs 250.00 on 15-Oct-26; SWIGGY credited. UPI:612345678901. Call 18002662 for dispute.'))
      .toMatchObject({ amount: 250, direction: 'debit', payee: 'Swiggy', source: 'ICICI Bank SMS' });
  });
  it('SBI without a currency sign', () => {
    expect(p(SMS, 'JD-SBIUPI', 'Dear UPI user A/C X1234 debited by 250.0 on date 15Oct26 trf to ZOMATO Refno 612345678901. If not u? call 1800111109. -SBI'))
      .toMatchObject({ amount: 250, direction: 'debit', payee: 'Zomato', source: 'SBI SMS' });
  });
  it('Axis UPI path and Kotak VPA', () => {
    expect(p(SMS, 'AX-AXISBK', 'INR 499.00 debited\nA/c no. XX1234\n15-10-26, 14:20:11\nUPI/P2M/612345678901/NETFLIX\nNot you? SMS BLOCK'))
      .toMatchObject({ amount: 499, payee: 'Netflix', direction: 'debit' });
    expect(p(SMS, 'BZ-KOTAKB', 'Sent Rs.80.00 from Kotak Bank AC X1234 to chaipoint@ybl on 15-10-26.UPI Ref 612345678901.'))
      .toMatchObject({ amount: 80, payee: 'Chaipoint', direction: 'debit' });
  });
  it('card spend and salary credit', () => {
    expect(p(SMS, 'AD-HDFCBK', 'Rs.1,250.00 spent on HDFC Bank Card x1234 at AMAZON on 2026-10-15:14:20:11. Not you? Call 18002586161'))
      .toMatchObject({ amount: 1250, direction: 'debit', payee: 'Amazon' });
    expect(p(SMS, 'VM-ICICIB', 'Rs.60,000.00 credited to A/c XX123 on 01-Oct-26 by NEFT from ACME CORP PVT LTD. Avl Bal Rs.1,20,000'))
      .toMatchObject({ amount: 60000, direction: 'credit', payee: 'Acme Corp Pvt Ltd' });
  });
  it('ignores OTPs, requests, dues, failures and chit-chat', () => {
    expect(p(SMS, 'AD-HDFCBK', '123456 is your OTP for a payment of Rs.500 at AMAZON')).toBeNull();
    expect(p(GPAY, 'Raju requested ₹200', 'Pay now')).toBeNull();
    expect(p(SMS, 'AD-HDFCBK', 'Your credit card bill of Rs.5,000 is due on 20-Oct')).toBeNull();
    expect(p('com.phonepe.app', 'Payment of ₹100 to Swiggy failed', '')).toBeNull();
    expect(p(SMS, 'Mom', 'Sent you 500 rs for groceries')).toBeNull();
    expect(p('com.instagram.android', 'Paid ₹50 to X', '')).toBeNull();
  });
});

describe('merging and turning into entries', () => {
  it('the UPI app and the bank SMS for the same payment become one', () => {
    const a = { ...p(GPAY, 'Payment successful', 'You paid ₹120.00 to Raju Tea'), id: 'n1' };
    const b = { ...parsePayment({ pkg: SMS, title: 'AD-HDFCBK', text: 'Sent Rs.120.00\nFrom HDFC Bank A/C *1234\nTo RAJU TEA\nOn 15/10/26', time: t + 40000 }), id: 'n2' };
    const c = { ...parsePayment({ pkg: GPAY, title: 'Payment successful', text: 'You paid ₹120.00 to Raju Tea', time: t + 3600000 }), id: 'n3' };
    const merged = mergeDetections([a, b, c]);
    expect(merged).toHaveLength(2);
    const first = merged.find((m) => m.ids.includes('n1'));
    expect(first.ids).toEqual(['n1', 'n2']);
    expect(first.account).toBe('••1234');
    expect(first.source).toBe('Google Pay + HDFC Bank SMS');
  });
  it('an SMS read straight from Android (Play build) and its messaging-app notification become one', () => {
    const body = 'Rs 450.00 debited from A/c XX5678 on 15-10-26 to VPA swiggy@ybl (UPI Ref 612345678901). Not you? Call 18001234 -Axis Bank';
    const direct = { ...parsePayment({ pkg: 'sms', title: 'AX-AXISBK-S', text: body, time: t }), id: 's1' };
    expect(direct).toMatchObject({ amount: 450, direction: 'debit', payee: 'Swiggy', source: 'Axis Bank SMS', account: '••5678' });
    const shown = { ...parsePayment({ pkg: SMS, title: 'AX-AXISBK-S', text: body, time: t + 2000 }), id: 'n9' };
    const merged = mergeDetections([direct, shown]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('Axis Bank SMS');
    expect(merged[0].ids).toEqual(['s1', 'n9']);
  });
  it('a direct SMS that is not a bank message is ignored', () => {
    expect(parsePayment({ pkg: 'sms', title: 'JD-OFFERS', text: 'Flat Rs 500 off on shoes! Shop now', time: t })).toBeNull();
  });
  it('becomes an expense (with a category) or income', () => {
    const d = { ...p('com.phonepe.app', 'Paid ₹199 to Swiggy', ''), ids: ['k1'] };
    const { kind, entry } = detectionToEntry(d, { inferCategory: (n) => (n === 'Swiggy' ? 'food' : 'other') });
    expect(kind).toBe('expense');
    expect(entry).toMatchObject({ id: 'cap_k1', name: 'Swiggy', amount: 199, type: 'expense', category: 'food', captured: 'PhonePe' });
    expect(detectionToEntry({ ...p(GPAY, 'Ramesh sent you ₹500', ''), ids: ['k2'] }).kind).toBe('income');
  });
  it('dates an entry by the phone\'s calendar, not UTC', () => {
    // 1 a.m. local on 1 Nov — in India that is still 31 Oct in UTC
    const time = new Date(2026, 10, 1, 1, 0).getTime();
    const { entry } = detectionToEntry({ amount: 99, direction: 'debit', payee: 'Chai', source: 'Google Pay', time, ids: ['t1'] });
    expect(entry.month).toBe('2026-11');
    const d = new Date(entry.date);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 1]);
  });
});

describe('one ledger: no doubles with typed entries', () => {
  const day = 24 * 3600 * 1000;
  const det = (amount, time, direction = 'debit', id = String(time)) => ({ amount, time, direction, ids: [id], source: 'SMS' });
  it('a payment already typed by hand (same amount, within a day) is not offered', () => {
    const typed = [{ name: 'Swiggy', amount: 450, date: new Date(t - 3600000).toISOString(), type: 'expense' }];
    expect(withoutKnown([det(450, t)], { transactions: typed })).toEqual([]);
    expect(withoutKnown([det(450, t + 2 * day)], { transactions: typed })).toHaveLength(1);   // a different day
    expect(withoutKnown([det(460, t)], { transactions: typed })).toHaveLength(1);             // a different amount
  });
  it('money in matches income, not expenses', () => {
    const exp = [{ amount: 500, date: new Date(t).toISOString() }];
    expect(withoutKnown([det(500, t, 'credit')], { transactions: exp })).toHaveLength(1);
    expect(withoutKnown([det(500, t, 'credit')], { income: exp })).toEqual([]);
  });
  it('one typed chai hides one of two same-day ₹20 payments, not both', () => {
    const typed = [{ amount: 20, date: new Date(t).toISOString() }];
    expect(withoutKnown([det(20, t, 'debit', 'a'), det(20, t + 3600000, 'debit', 'b')], { transactions: typed }).map((d) => d.ids[0])).toEqual(['b']);
  });
});
