// ─── Payment capture: reading UPI and bank notifications ──────────
// On Android the app can (with the user's permission) see notifications
// from payment apps and bank SMS. Everything here runs on the phone: the
// text is turned into { amount, direction, payee } and offered as a
// suggestion — nothing is added, and nothing leaves the device, until the
// user taps Add.
//
// Pure functions only (tested in __tests__/paymentCapture.test.js).
import { dateInputToISO, localDateKey, isoToMonth } from './dateHelpers';

/* Apps whose notifications are read. SMS apps carry the banks' messages. */
export const SOURCE_APPS = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'com.dreamplug.androidapp': 'CRED',
  'in.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.mobikwik_new': 'MobiKwik',
  'com.whatsapp': 'WhatsApp Pay',
  'com.google.android.apps.messaging': 'SMS',
  'com.samsung.android.messaging': 'SMS',
  'com.android.mms': 'SMS',
  'com.oneplus.mms': 'SMS',
  'com.android.messaging': 'SMS',
  sms: 'SMS',   // straight from Android (Play build, "Bank SMS" on); title = sender, e.g. "AD-HDFCBK"
};

const BANKS = [
  ['HDFC', 'HDFC Bank'], ['ICICI', 'ICICI Bank'], ['SBI', 'SBI'], ['AXIS', 'Axis Bank'], ['KOTAK', 'Kotak'],
  ['YES', 'Yes Bank'], ['IDFC', 'IDFC First'], ['INDUS', 'IndusInd'], ['PNB', 'PNB'], ['BOB', 'Bank of Baroda'],
  ['CANARA', 'Canara Bank'], ['UNION', 'Union Bank'], ['FEDERAL', 'Federal Bank'], ['AU', 'AU Bank'], ['RBL', 'RBL Bank'],
];

// Not a completed payment
const IGNORE = /\b(otp|one[- ]time password|verification code|requested|request(?:ed)? money|collect request|is due|due (?:on|by|date)|will be (?:debited|deducted|charged)|to be debited|auto[- ]?pay (?:set|scheduled)|mandate|failed|declined|unsuccessful|reversed|refund initiated|minimum (?:amount )?due|statement|offer|cashback of|e-?mandate|reminder|has been blocked)\b/i;

const AMOUNT = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
const AMOUNT_BARE = /(?:debited|credited|deposited|paid|sent)\s+(?:by|for|with|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i;

const STOP = '(?:\\s+(?:on|via|using|ref(?:no)?|ref\\.?\\s*no|upi|from|at|for|avl|bal|if|not|txn|towards|is|was|has)\\b|[\\n.;,!]|$)';
const TO_RE = new RegExp(`\\b(?:paid|sent|trf|transfer(?:red)?|payment(?:\\s+of\\s+\\S+)?)?\\s*to\\s+(?:vpa\\s+)?(?!a\\/?c\\b|ac\\b|acct|account|your)([^\\n.;,]+?)${STOP}`, 'i');
const AT_RE = new RegExp(`\\bat\\s+([^\\n.;,]+?)${STOP}`, 'i');
const FROM_RE = new RegExp(`\\b(?:from|by)\\s+(?!a\\/?c\\b|ac\\b|acct|account|your|hdfc|icici|sbi|axis|kotak|neft|imps|rtgs|upi\\b)([^\\n.;,]+?)${STOP}`, 'i');
const ICICI_RE = /;\s*([^;.\n]+?)\s+credited/i;
const UPI_PATH = /UPI\/P2[AM]\/\d+\/([^\n/]+)/i;
const SENT_YOU = /^(.+?)\s+(?:has\s+)?sent you\b/i;
const ACCOUNT = /(?:a\/?c|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s*(?:with)?\s*)?[x*.]*\s*(\d{3,4})\b/i;

const toNumber = (s) => Number(String(s).replace(/,/g, ''));

function tidyName(raw) {
  if (!raw) return '';
  let s = raw.trim().replace(/\s+/g, ' ');
  if (s.includes('@')) s = s.split('@')[0].replace(/[._-]+/g, ' ');   // swiggy@ybl → swiggy
  s = s.replace(/^(?:mr|ms|mrs|m\/s)\.?\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
  if (!s || /^\d+$/.test(s) || /^x+\d+$/i.test(s)) return '';
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return s.slice(0, 60);
}

function bankOf(title = '', text = '') {
  const hay = `${title} ${text}`.toUpperCase();
  const hit = BANKS.find(([k]) => new RegExp(`\\b${k}(?:BK|BANK)?\\b|${k}BK|-${k}`).test(hay));
  return hit ? hit[1] : null;
}

/**
 * One notification → a detected payment, or null.
 *   n = { pkg, title, text, time }
 *   → { amount, direction: 'debit' | 'credit', payee, source, account?, time, raw }
 */
export function parsePayment(n) {
  const app = SOURCE_APPS[n?.pkg] ?? (n?.pkg === 'com.android.shell' ? 'Test' : null);
  if (!app) return null;
  const text = `${n.title ?? ''}\n${n.text ?? ''}`.trim();
  if (!text || IGNORE.test(text)) return null;
  const lower = text.toLowerCase();

  const m = text.match(AMOUNT) ?? text.match(AMOUNT_BARE);
  const amount = m ? toNumber(m[1]) : NaN;
  if (!(amount > 0) || amount > 10000000) return null;

  // Credit phrases first: "Raju sent you ₹500" also contains "sent"
  const creditAt = lower.search(/\b(sent you|received|credited|deposited|added to your|refund(?:ed)? of)\b/);
  const debitAt = lower.search(/\b(paid|sent|debited|spent|payment of|payment to|purchase|withdrawn|transferred|trf to)\b/);
  let direction = null;
  if (/\bsent you\b/.test(lower)) direction = 'credit';
  else if (debitAt !== -1 && (creditAt === -1 || debitAt < creditAt)) direction = 'debit';
  else if (creditAt !== -1) direction = 'credit';
  if (!direction) return null;
  // SMS apps carry all kinds of messages: require a bank-ish shape
  if (app === 'SMS' && !/(a\/?c|acct|account|card|upi|bank|vpa)/i.test(text)) return null;

  let payee = '';
  if (direction === 'debit') {
    payee = tidyName(text.match(ICICI_RE)?.[1]) || tidyName(text.match(UPI_PATH)?.[1]) || tidyName(text.match(TO_RE)?.[1]) || tidyName(text.match(AT_RE)?.[1]);
  } else {
    payee = tidyName(text.match(SENT_YOU)?.[1]) || tidyName(text.match(UPI_PATH)?.[1]) || tidyName(text.match(FROM_RE)?.[1]);
  }
  const account = text.match(ACCOUNT)?.[1];
  const bank = app === 'SMS' ? bankOf(n.title, n.text) : null;
  return {
    amount: Math.round(amount * 100) / 100,
    direction,
    payee,
    source: bank ? `${bank} SMS` : app,
    ...(account ? { account: `••${account}` } : {}),
    time: Number(n.time) || Date.now(),
  };
}

/**
 * The same payment often arrives twice — the UPI app and the bank SMS.
 * Keep one per (direction, amount) within a few minutes, preferring the
 * one that names the payee, and keep the account from the bank message.
 */
export function mergeDetections(list, windowMs = 5 * 60 * 1000) {
  const out = [];
  [...list].sort((a, b) => a.time - b.time).forEach((d) => {
    const twin = out.find((o) => o.direction === d.direction && o.amount === d.amount && Math.abs(o.time - d.time) <= windowMs);
    if (!twin) { out.push({ ...d, ids: d.ids ?? (d.id ? [d.id] : []) }); return; }
    twin.ids = [...twin.ids, ...(d.ids ?? (d.id ? [d.id] : []))];
    if (!twin.payee && d.payee) twin.payee = d.payee;
    if (!twin.account && d.account) twin.account = d.account;
    if (twin.source !== d.source && !twin.source.includes(' + ')) twin.source = `${twin.source} + ${d.source}`;
  });
  return out.sort((a, b) => b.time - a.time);
}

/**
 * Drop payments the ledger already has — typed by hand, imported from a
 * statement, or added on another phone: same direction, amount within
 * ₹0.50, within a day. Each ledger entry accounts for one payment only, so
 * two real ₹20 chais the same day still both show when one was typed.
 */
export function withoutKnown(detections, { transactions = [], income = [] } = {}, dayMs = 24 * 3600 * 1000) {
  const pool = {
    debit: transactions.map((e) => ({ a: Number(e.amount), t: new Date(e.date).getTime() })),
    credit: income.map((e) => ({ a: Number(e.amount), t: new Date(e.date).getTime() })),
  };
  return [...detections].sort((a, b) => a.time - b.time).filter((d) => {
    const list = pool[d.direction] ?? [];
    const i = list.findIndex((e) => Math.abs(e.a - d.amount) < 0.5 && Math.abs(e.t - d.time) <= dayMs);
    if (i === -1) return true;
    list.splice(i, 1);
    return false;
  }).sort((a, b) => b.time - a.time);
}

/** A detected payment as a ledger entry (expense for money out, income for money in). */
export function detectionToEntry(d, { inferCategory } = {}) {
  const name = d.payee || (d.direction === 'debit' ? 'UPI payment' : 'Money received');
  // Same shape as entries typed in: noon local time on the day it happened,
  // month by this phone's calendar (not UTC — 1 a.m. IST on the 1st is still the 1st)
  const date = dateInputToISO(localDateKey(new Date(d.time).toISOString()));
  const base = { id: `cap_${d.ids?.[0] ?? d.time}`.replace(/[^\w-]/g, '_').slice(0, 120), name, amount: d.amount, date, month: isoToMonth(date), captured: d.source };
  if (d.direction === 'credit') return { kind: 'income', entry: base };
  return { kind: 'expense', entry: { ...base, type: 'expense', category: inferCategory ? inferCategory(name) : 'other' } };
}
