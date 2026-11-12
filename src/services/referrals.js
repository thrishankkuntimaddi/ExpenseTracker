// ─── Invites and supporter days (Firestore) ──────────────────────
//   referral_codes/{code}  { uid, createdAt }            your invite code
//   referrals/{newUid}     { code, referrer, createdAt, activeAt? }
//   supporters/{uid}       { until, plan }               paid — server only
// The rules (firestore.rules) make these safe without a server: a code
// can't be taken over, an account is credited once, never to itself, and
// only to the code's real owner. Every call here fails quietly — invites
// must never get in the way of using the app.
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { codeFor, isNewAccount } from '../utils/supporter';
import { pendingRef, clearPendingRef } from '../app/refLink';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

/** Your invite code, registered once (the same code on every device). */
const registering = new Map();
export function ensureMyCode(uid) {
  if (!db || !uid) return Promise.resolve(null);
  if (!registering.has(uid)) registering.set(uid, registerCode(uid).finally(() => registering.delete(uid)));
  return registering.get(uid);
}
async function registerCode(uid) {
  const code = await codeFor(uid);
  if (store.get(`et_refcode_${uid}`) === code) return code;
  const ref = doc(db, 'referral_codes', code);
  const owner = async () => { const s = await getDoc(ref); return s.exists() ? s.data().uid : null; };
  let who = await owner();
  if (!who) {
    // Another device may register it at the same moment: then the write is
    // refused (codes can't be changed) — look again
    try { await setDoc(ref, { uid, createdAt: serverTimestamp() }); who = uid; } catch { who = await owner(); }
  }
  if (who !== uid) return null;   // (astronomically rare) someone else's code
  store.set(`et_refcode_${uid}`, code);
  return code;
}

/** A new account that opened an invite link: credit the inviter, once. */
export async function claimReferral(user) {
  const code = pendingRef();
  if (!code || !db || !user?.uid) return false;
  clearPendingRef();
  if (!isNewAccount(user)) return false;
  const owner = await getDoc(doc(db, 'referral_codes', code));
  const referrer = owner.exists() ? owner.data().uid : null;
  if (!referrer || referrer === user.uid) return false;
  const mine = doc(db, 'referrals', user.uid);
  if ((await getDoc(mine)).exists()) return false;
  await setDoc(mine, { code, referrer, createdAt: serverTimestamp() });
  return true;
}

/** Their first entry: from now the inviter's supporter days count. */
export async function markReferralActive(uid) {
  if (!db || !uid || store.get(`et_ref_active_${uid}`)) return;
  const ref = doc(db, 'referrals', uid);
  const snap = await getDoc(ref);
  if (snap.exists() && !snap.data().activeAt) await updateDoc(ref, { activeAt: serverTimestamp() });
  store.set(`et_ref_active_${uid}`, '1');   // invited or not, nothing more to do on this device
}

/** People who joined with your link, and paid support (if any). */
export async function loadSupporter(uid) {
  if (!db || !uid) return { referrals: [], paidUntil: 0 };
  const [refs, paid] = await Promise.all([
    getDocs(query(collection(db, 'referrals'), where('referrer', '==', uid))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    getDoc(doc(db, 'supporters', uid)).then((s) => (s.exists() ? s.data().until ?? 0 : 0)).catch(() => 0),
  ]);
  return { referrals: refs, paidUntil: paid };
}
