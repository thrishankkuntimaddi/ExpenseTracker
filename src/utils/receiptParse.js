// ─── Reading a payment from text ─────────────────────────────────
// Text comes from a shared message ("Paid ₹450 to Swiggy via Google Pay"),
// or from the phone reading a picture on the device (a UPI screenshot from
// GPay / PhonePe / Paytm, or a shop receipt). Returns the best guess of
// { name, amount, date?, kind: 'upi' | 'receipt' | 'text', confidence } —
// the Add form opens with it filled in, for the person to check. Pure.

const MONEY = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const BARE_NUMBER = /^[₹\s]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/;
const toNum = (s) => Number(String(s).replace(/,/g, ''));
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "12 Nov 2026", "12/11/2026", "2026-11-12" → 'YYYY-MM-DD' or null. */
export function findDate(text) {
  const t = String(text ?? '');
  let m = t.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s*(\d{4})\b/i);
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1)}-${pad(m[1])}`;
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s*(\d{4})\b/i);
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1)}-${pad(m[2])}`;
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; const mo = Number(m[2]); if (mo >= 1 && mo <= 12) return `${y}-${pad(mo)}-${pad(m[1])}`; }
  return null;
}

const UPI_HINT = /\b(upi|google pay|gpay|phonepe|paytm|bhim|paid to|sent to|payment successful|transaction (id|successful)|upi (ref|transaction))\b/i;
const NOISE = /(@|upi|transaction|txn|ref\.?|id\b|google pay|phonepe|paytm|bhim|successful|completed|paid to|sent to|to:|from:|debited|credited|bank|a\/c|account|\d{6,})/i;

function upiName(lines) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const same = l.match(/^(?:paid to|sent to|to|payment to)\s*:?\s*(.+)$/i);
    if (same && same[1] && !/@/.test(same[1]) && !MONEY.test(same[1])) return clean(same[1]);
    if (/^(paid to|sent to|to|payment to)\s*:?$/i.test(l) && lines[i + 1] && !/@/.test(lines[i + 1])) return clean(lines[i + 1]);
  }
  return null;
}

/** A message someone shared as text. */
function fromText(text) {
  const t = clean(text);
  const amt = t.match(MONEY);
  if (!amt) return null;
  const name = (t.match(/\b(?:to|at)\s+([A-Za-z][\w&.' -]{1,40}?)(?=\s+(?:via|on|using|for|ref|upi|from)\b|[.,]|$)/i) ?? [])[1] ?? null;
  return { name: name ? clean(name) : null, amount: toNum(amt[1]), date: findDate(t), kind: 'text', confidence: name ? 0.8 : 0.5 };
}

/** OCR text of a UPI screenshot. */
function fromUpi(lines, text) {
  // The big amount: a line that is only the amount, else the first ₹ amount
  let amount = null;
  for (const l of lines) { const m = l.match(BARE_NUMBER); if (m && /₹|^\d/.test(l) && toNum(m[1]) > 0) { amount = toNum(m[1]); break; } }
  if (amount == null) { const m = text.match(MONEY); if (m) amount = toNum(m[1]); }
  const name = upiName(lines) ?? lines.find((l) => /[a-z]{3}/i.test(l) && !NOISE.test(l) && !MONEY.test(l) && l.length <= 40) ?? null;
  return amount ? { name: name ? clean(name) : null, amount, date: findDate(text), kind: 'upi', confidence: name ? 0.85 : 0.6 } : null;
}

/** OCR text of a shop receipt. */
function fromReceipt(lines, text) {
  const amountIn = (l) => { const m = l.match(MONEY) ?? l.match(/([0-9][0-9,]*\.[0-9]{2})\s*$/); return m ? toNum(m[1]) : null; };
  const ranks = [/grand\s*total/i, /net\s*(amount|payable|total)|amount\s*payable|total\s*payable/i, /total\s*amount|bill\s*amount/i, /^\s*total\b/i];
  let amount = null;
  for (const re of ranks) {
    const i = lines.findIndex((l) => re.test(l) && !/sub\s*-?\s*total/i.test(l));
    if (i >= 0) { amount = amountIn(lines[i]) ?? (lines[i + 1] ? amountIn(lines[i + 1]) : null); if (amount) break; }
  }
  if (amount == null) {
    const all = lines.map(amountIn).filter((n) => n && n < 1e7);
    if (all.length) amount = Math.max(...all);
  }
  const name = lines.find((l) => /[a-z]{3}/i.test(l) && !/tax invoice|invoice|receipt|bill no|gst|gstin|cash memo|date|phone|tel|mob|www\.|thank/i.test(l) && !MONEY.test(l) && l.length <= 40) ?? null;
  return amount ? { name: name ? clean(name) : null, amount, date: findDate(text), kind: 'receipt', confidence: name ? 0.7 : 0.5 } : null;
}

export function parsePayment(raw, { image = false } = {}) {
  const text = String(raw ?? '');
  if (!text.trim()) return null;
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  if (!image) return fromText(text) ?? (UPI_HINT.test(text) ? fromUpi(lines, text) : null);
  return UPI_HINT.test(text) ? (fromUpi(lines, text) ?? fromReceipt(lines, text)) : (fromReceipt(lines, text) ?? fromUpi(lines, text));
}
