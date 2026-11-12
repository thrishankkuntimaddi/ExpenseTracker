// An invite link (…?ref=CODE): remember the code until the visitor makes an
// account, then services/referrals.js credits the friend who sent it.
// Kept for 14 days; the link's ?ref= is removed from the address bar.
import { readRefCode } from '../utils/supporter';

const KEY = 'et_ref_pending';
const KEEP = 14 * 24 * 3600 * 1000;

export function rememberRefFromUrl() {
  try {
    const code = readRefCode(window.location.search);
    if (!code) return;
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  } catch { /* storage unavailable */ }
}

export function pendingRef() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Date.now() - v.at < KEEP ? v.code : null;
  } catch { return null; }
}

export const clearPendingRef = () => { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
