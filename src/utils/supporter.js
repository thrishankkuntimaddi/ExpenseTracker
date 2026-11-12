// ─── Supporters and invites ───────────────────────────────────────
// Everything in the app stays free. Supporters get extras only (a badge,
// new features first). Two ways to be one:
//   • invite friends: each friend who joins with your link and adds their
//     first entry gives you REF_DAYS supporter days (they stack)
//   • pay (Play Billing / Razorpay) — written, switched off (PAID_SUPPORT)
// Pure functions only (tested in __tests__/supporter.test.js).

export const REF_DAYS = 30;
const DAY = 24 * 3600 * 1000;
/** Paid support is built but off until the payment server is deployed (Blaze plan). */
export const PAID_SUPPORT = import.meta.env?.VITE_PAID_SUPPORT === '1';

// No 0/O/1/I: easy to read aloud. Matches firestore.rules ^[A-Z2-9]{7}$.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z2-9]{7}$/;

/** Your invite code: the same on every device, made from your account id (which it doesn't reveal). */
export async function codeFor(uid) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`et-ref:${uid}`)));
  return Array.from(bytes.slice(0, 7), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** "?ref=abc2345" → "ABC2345", or null. */
export function readRefCode(search) {
  try {
    const v = new URLSearchParams(search).get('ref');
    const code = v?.trim().toUpperCase();
    return code && CODE_RE.test(code) ? code : null;
  } catch { return null; }
}

const ms = (v) => (v == null ? 0 : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : Date.parse(v) || 0);

/**
 * Supporter until when (ms), or 0. Each active referral adds REF_DAYS from
 * the later of when it became active and when the previous days ran out;
 * paid support until a date counts too.
 */
export function supporterUntil({ referrals = [], paidUntil = 0 } = {}) {
  let until = 0;
  referrals.map((r) => ms(r.activeAt)).filter(Boolean).sort((a, b) => a - b)
    .forEach((at) => { until = Math.max(until, at) + REF_DAYS * DAY; });
  return Math.max(until, ms(paidUntil));
}

/** { active, until, daysLeft, joined, counted } for the Profile card. */
export function supporterStatus({ referrals = [], paidUntil = 0, now = Date.now() } = {}) {
  const until = supporterUntil({ referrals, paidUntil });
  return {
    active: until > now,
    until,
    daysLeft: until > now ? Math.ceil((until - now) / DAY) : 0,
    joined: referrals.length,
    counted: referrals.filter((r) => ms(r.activeAt)).length,
    paid: ms(paidUntil) > now,
  };
}

/** A new account may be credited to an inviter only in its first days. */
export const isNewAccount = (user, now = Date.now()) => {
  const created = Date.parse(user?.metadata?.creationTime ?? '');
  return Number.isFinite(created) && now - created < 3 * DAY;
};
