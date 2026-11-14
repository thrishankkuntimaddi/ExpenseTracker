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
import { collection, deleteDoc, deleteField, doc, getDocs, query, where, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
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
 * and sign-in are deleted. Returns the steps that failed (each is retried by
 * deleting again); an empty list means everything is gone.
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
    const code = await codeFor(uid);
    await deleteDoc(doc(db, 'referral_codes', code)).catch((err) => { if (err?.code !== 'not-found') throw err; });
  });
  await step('referral', () => deleteDoc(doc(db, 'referrals', uid)));
  await step('outbox', async () => {
    const snap = await getDocs(collection(db, 'users', uid, 'outbox'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  });
  await step('captured payments', () => setCaptureEnabled(false));
  return failed;
}

/** The account document itself — last, after every sub-collection. */
export function deleteAccountDoc(uid) {
  return deleteDoc(doc(db, 'users', uid));
}
