// Firestore rules check for "Delete account" (leave a shared trip, remove a
// referral). Run against the emulator:
//   firebase emulators:exec --only firestore --project demo-rules "node scripts/test-rules-account-delete.mjs"
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, deleteField, arrayUnion, serverTimestamp } from 'firebase/firestore';

const as = (uid) => {
  const app = initializeApp({ projectId: 'demo-rules', apiKey: 'x' }, uid);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: { user_id: uid, email: `${uid}@x.test`, email_verified: true } });
  return db;
};
const owner = as('u1'), member = as('u2'), stranger = as('u3');
let failures = 0;
const expect = async (label, shouldPass, fn) => {
  let ok = true;
  try { await fn(); } catch { ok = false; }
  const good = ok === shouldPass;
  if (!good) failures++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${label}  (${ok ? 'allowed' : 'denied'})`);
};

const trip = {
  name: 'Goa', ownerUid: 'u1', status: 'open',
  members: [{ id: 'm1', name: 'Asha' }, { id: 'm2', name: 'Ravi' }],
  memberUids: ['u1', 'u2'],
  uidMember: { u1: 'm1', u2: 'm2' },
  people: { u1: { name: 'Asha' }, u2: { name: 'Ravi' } },
  memberUnit: {},
};
await setDoc(doc(owner, 'shared_trips', 't1'), trip);
const leave = (db, uid, extra = {}) => updateDoc(doc(db, 'shared_trips', 't1'), {
  memberUids: trip.memberUids.filter((u) => u !== uid),
  [`uidMember.${uid}`]: deleteField(), [`people.${uid}`]: deleteField(),
  removedUids: arrayUnion(uid), retiredMembers: arrayUnion(trip.uidMember[uid] ?? 'x'),
  updatedAt: serverTimestamp(), ...extra,
});

await expect('stranger cannot "leave" a trip they are not on', false, () => leave(stranger, 'u3'));
await expect('member cannot change the trip name while leaving', false, () => leave(member, 'u2', { name: 'Hacked' }));

await expect('member leaves the trip', true, () => leave(member, 'u2'));
await expect('creator deletes their trip', true, () => deleteDoc(doc(owner, 'shared_trips', 't1')));

await setDoc(doc(owner, 'referral_codes', 'ABCDEF2'), { uid: 'u1', createdAt: serverTimestamp() });
await setDoc(doc(member, 'referrals', 'u2'), { code: 'ABCDEF2', referrer: 'u1', createdAt: serverTimestamp() });
await expect('someone else cannot delete your referral', false, () => deleteDoc(doc(stranger, 'referrals', 'u2')));
await expect('you delete your own referral', true, () => deleteDoc(doc(member, 'referrals', 'u2')));
await expect('you delete your own invite code', true, () => deleteDoc(doc(owner, 'referral_codes', 'ABCDEF2')));

console.log(failures ? `\n${failures} check(s) failed` : '\nall rules checks passed');
process.exit(failures ? 1 : 0);
