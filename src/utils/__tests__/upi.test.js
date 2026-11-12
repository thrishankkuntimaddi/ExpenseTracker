import { describe, it, expect } from 'vitest';
import { isUpiId, upiLink, savedUpi, rememberUpi, payRequestMessage } from '../upi';

describe('upi', () => {
  it('recognises UPI IDs', () => {
    expect(isUpiId('ravi.k@okhdfcbank')).toBe(true);
    expect(isUpiId('9876543210@ybl')).toBe(true);
    expect(isUpiId('ravi@')).toBe(false);
    expect(isUpiId('ravi k@ybl')).toBe(false);
    expect(isUpiId('ravi@gmail.com')).toBe(true);   // some banks use dotted handles
  });
  it('builds a pay link', () => {
    const l = upiLink({ id: 'ravi@ybl', name: 'Ravi Kumar', amount: 450.5, note: 'Goa trip' });
    expect(l).toBe('upi://pay?pa=ravi%40ybl&pn=Ravi%20Kumar&am=450.50&cu=INR&tn=Goa%20trip');
    const p = new URLSearchParams(l.split('?')[1]);
    expect(p.get('pa')).toBe('ravi@ybl');
    expect(p.get('am')).toBe('450.50');
  });
  it('remembers IDs per person and your own', () => {
    let s = {};
    s = { ...s, ...rememberUpi(s, 'Ravi', 'ravi@ybl') };
    s = { ...s, ...rememberUpi(s, '', 'me@okaxis', true) };
    expect(savedUpi(s, ' ravi ')).toBe('ravi@ybl');
    expect(savedUpi(s, '', true)).toBe('me@okaxis');
    expect(s.upi.people).toEqual({ ravi: 'ravi@ybl' });
  });
  it('request message carries the ID and the link', () => {
    const m = payRequestMessage({ fromName: 'Kiran', toName: 'me', id: 'me@okaxis', amount: 300, note: 'Goa', money: (n) => `₹${n}` });
    expect(m).toContain('Hi Kiran — ₹300 to me for Goa.');
    expect(m).toContain('Pay by UPI: me@okaxis');
    expect(m).toContain('upi://pay?pa=me%40okaxis');
  });
});
