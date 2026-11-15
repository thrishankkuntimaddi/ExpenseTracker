// ─── Account deletion: everything outside users/{uid} ─────────────
// "Delete account" removes the person's data everywhere it lives, not just
// their own ledger (deleteAllUserData):
//   • shared trips they created — the trip, its rows, settlements and the
//     public invite preview (shared_trips/{id}/**, trip_invites/{id})
//   • shared trips they joined — their account, name and photo are taken off
//     (the rows they added stay for the others, under the trip person's name,
//     so everyone's balances still add up)
//   • their invite code (referral_codes/{code}) and who-invited-them
//     (referrals/{uid})
//   • mails waiting to be sent (users/{uid}/outbox) and the account document
//   • on Android: captured payment notifications / bank SMS on this phone
// Payment records of paid supporters (supporters/{uid}) are written by the
// server and kept as long as the law requires; see the privacy policy.
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, where, updateDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { SHARED_TRIPS, deleteSharedTrip } from './sharedTrips';
import { codeFor } from '../utils/supporter';
import { setCaptureEnabled } from '../native/paymentCapture';

/** A member (not the creator) takes themselves off a shared trip. */
export async function leaveSharedTrip(tripId, uid, trip) {
  const memberId = trip.uidMember?.[uid];
  await updateDoc(doc(db, SHARED_TRIPS, tripId), {
    memberUids: (trip.memberUids ?? []).filter((u) => u !== uid),
    [`uidMember.${uid}`]: deleteField(),
    [`people.${uid}`]: deleteField(),
    removedUids: arrayUnion(uid),
    ...(memberId ? { retiredMembers: arrayUnion(memberId) } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove what lives outside users/{uid}. Runs before the account's own data
 * and sign-in are deleted. Returns the steps that failed — none of them
 * stops the deletion any more: whatever is left, the server finishes
 * (requestServerDeletion). Before 4.3 a missing invite code (most people
 * never opened Invite) or a sent trip-invite mail made the rules refuse a
 * step, and "Delete account" stopped with "your account was not deleted".
 */
export async function deleteAccountFootprint(uid) {
  const failed = [];
  const step = async (name, fn) => { try { await fn(); } catch (err) { console.warn('[delete account]', name, err); failed.push(name); } };

  await step('shared trips', async () => {
    const snap = await getDocs(query(collection(db, SHARED_TRIPS), where('memberUids', 'array-contains', uid)));
    for (const d of snap.docs) {
      const t = d.data();
      if (t.ownerUid === uid) await deleteSharedTrip(d.id);
      else await leaveSharedTrip(d.id, uid, t);
    }
  });
  await step('invite code', async () => {
    const ref = doc(db, 'referral_codes', await codeFor(uid));
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().uid === uid) await deleteDoc(ref);   // never made one: nothing to remove
  });
  await step('referral', () => deleteDoc(doc(db, 'referrals', uid)));
  await step('outbox', async () => {
    const snap = await getDocs(collection(db, 'users', uid, 'outbox'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  });
  await step('captured payments', () => setCaptureEnabled(false));
  return failed;
}

/**
 * The fallback: ask the server (the notifier, every ~10 minutes) to finish
 * deleting this account — the sign-in and anything the app couldn't remove.
 * The owner sees it in Admin sees too.
 */
export function requestServerDeletion(uid, reason = '') {
  return setDoc(doc(db, 'account_admin', uid), {
    state: 'self_delete_requested',
    requestedAt: Date.now(),
    reason: String(reason).slice(0, 300),
  });
}

/** The account document itself — last, after every sub-collection. */
export function deleteAccountDoc(uid) {
  return deleteDoc(doc(db, 'users', uid));
}
