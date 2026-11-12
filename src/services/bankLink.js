// ─── Bank linking (Account Aggregator via Setu) — app side ────────
// Off unless the build sets VITE_BANK_LINK=1 (needs the server functions in
// server/functions/setu.js deployed, which needs the Blaze plan + Setu keys).
//   users/{uid}/bank_links/{consentId}  status of each link (server writes)
//   users/{uid}/bank_inbox/{id}         fetched transactions, waiting for review
// Reviewed like an imported statement; reviewed rows are removed from the inbox.
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import app, { db } from './firebase';

export const BANK_LINK = import.meta.env?.VITE_BANK_LINK === '1';

async function call(name, data) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable(getFunctions(app, 'asia-south1'), name);
  return (await fn(data)).data;
}

/** Start linking: returns the AA approval page to open. */
export const linkBank = (mobile) => call('setuCreateConsent', { mobile });
/** Ask the bank(s) for the last `days` again. */
export const refreshBank = (consentId, days = 30) => call('setuFetch', { consentId, days });

export async function loadBankLinks(uid) {
  if (!db || !uid) return [];
  const s = await getDocs(collection(db, 'users', uid, 'bank_links'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadBankInbox(uid) {
  if (!db || !uid) return [];
  const s = await getDocs(collection(db, 'users', uid, 'bank_inbox'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Reviewed (added or skipped): clear them from the inbox. */
export async function clearBankInbox(uid, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => b.delete(doc(db, 'users', uid, 'bank_inbox', id)));
    await b.commit();
  }
}
