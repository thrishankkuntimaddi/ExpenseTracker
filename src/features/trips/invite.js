// ─── Trip invites ─────────────────────────────────────────────────
// An invite is a link to the web app with the trip's id:
//   https://thrishankkuntimaddi.github.io/ExpenseTracker/?trip=<id>
// Opened anywhere (QR scan, WhatsApp, email), it signs the person in — or
// lets them create an account — and then asks which person on the trip
// they are. The apps take the same link (or just the code) in "Join a trip".
import { isNative } from '../../native';

const PUBLIC_APP = 'https://thrishankkuntimaddi.github.io/ExpenseTracker/';
const PENDING_KEY = 'et_join_trip';
const ID_RE = /^[A-Za-z0-9]{16,40}$/;

function appUrl() {
  if (isNative || typeof window === 'undefined') return PUBLIC_APP;
  const { origin, protocol } = window.location;
  if (!/^https?:$/.test(protocol)) return PUBLIC_APP;
  return origin + (import.meta.env.BASE_URL || '/');
}

export const inviteLink = (tripId) => `${appUrl()}?trip=${tripId}`;

/** A pasted link or a bare code → the trip id, or null. */
export function parseInvite(text) {
  const t = String(text ?? '').trim();
  if (ID_RE.test(t)) return t;
  const m = t.match(/[?&]trip=([A-Za-z0-9]{16,40})/);
  return m ? m[1] : null;
}

export function inviteMessage(trip, link) {
  const who = trip.ownerName ? `${trip.ownerName} invited you` : 'You’re invited';
  return [
    `🧳 ${who} to the trip “${trip.name}” on Expense Tracker.`,
    '',
    'Everyone adds what they spend — fuel, food, tolls — and sees who owes whom, live. No more maths at the end.',
    '',
    `Join here: ${link}`,
    '',
    'Sign in, or create a free account in a few seconds — then pick your name on the trip.',
  ].join('\n');
}

export const inviteMailto = (trip, link) =>
  `mailto:?subject=${encodeURIComponent(`Join our trip “${trip.name}” on Expense Tracker`)}&body=${encodeURIComponent(inviteMessage(trip, link))}`;

/* The invite survives the sign-in / sign-up screen (and an email
   verification round-trip) in this browser. */
export function captureInviteFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const id = parseInvite(url.searchParams.get('trip') ?? '');
    if (!id) return pendingInvite();
    localStorage.setItem(PENDING_KEY, id);
    url.searchParams.delete('trip');
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    return id;
  } catch { return null; }
}
export function pendingInvite() {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}
export function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
}
