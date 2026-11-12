import { describe, it, expect } from 'vitest';
import { parsePayment, findDate } from '../receiptParse';

describe('reading a payment', () => {
  it('dates', () => {
    expect(findDate('12 Nov 2026, 9:41 pm')).toBe('2026-11-12');
    expect(findDate('Nov 3, 2026')).toBe('2026-11-03');
    expect(findDate('Date: 05/10/2026')).toBe('2026-10-05');
    expect(findDate('nothing here')).toBe(null);
  });
  it('a shared message', () => {
    expect(parsePayment('Paid ₹450 to Swiggy via Google Pay')).toMatchObject({ name: 'Swiggy', amount: 450, kind: 'text' });
    expect(parsePayment('You paid Rs. 1,250.00 to Ravi Kumar on 12 Nov 2026')).toMatchObject({ name: 'Ravi Kumar', amount: 1250, date: '2026-11-12' });
    expect(parsePayment('hello there')).toBe(null);
  });
  it('a GPay screenshot', () => {
    const ocr = ['9:41', 'Paid to', 'Swiggy Limited', 'swiggy@icici', '₹450', 'Completed', '12 Nov 2026, 1:15 pm', 'UPI transaction ID', '412345678901', 'Google Pay'].join('\n');
    expect(parsePayment(ocr, { image: true })).toMatchObject({ name: 'Swiggy Limited', amount: 450, date: '2026-11-12', kind: 'upi' });
  });
  it('a PhonePe screenshot', () => {
    const ocr = ['Transaction Successful', '12:30 pm on 03 Nov 2026', 'Paid to', 'RAVI KUMAR', '9876543210@ybl', '₹ 1,200', 'Banking Name: Ravi Kumar', 'Transaction ID', 'T2611031230'].join('\n');
    expect(parsePayment(ocr, { image: true })).toMatchObject({ name: 'RAVI KUMAR', amount: 1200, date: '2026-11-03' });
  });
  it('a shop receipt', () => {
    const ocr = ['TAX INVOICE', 'Annapoorna Sweets', 'GSTIN 29ABCDE1234F1Z5', 'Date: 05/11/2026', 'Mysore Pak 2 x 180.00 360.00', 'Kaju Katli 1 x 450.00 450.00', 'Sub Total 810.00', 'CGST 2.5% 20.25', 'SGST 2.5% 20.25', 'Grand Total ₹850.50', 'Thank you!'].join('\n');
    expect(parsePayment(ocr, { image: true })).toMatchObject({ name: 'Annapoorna Sweets', amount: 850.5, date: '2026-11-05', kind: 'receipt' });
  });
  it('a receipt with no total line uses the largest amount', () => {
    const ocr = ['Raju Tea Stall', 'Tea 20.00', 'Samosa 30.00', 'Rs. 50.00'].join('\n');
    expect(parsePayment(ocr, { image: true })).toMatchObject({ name: 'Raju Tea Stall', amount: 50 });
  });
});
