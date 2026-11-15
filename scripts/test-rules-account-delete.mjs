// Firestore rules check for "Delete account" (leave a shared trip, remove a
// referral). Run against the emulator:
//   firebase emulators:exec --only firestore --project demo-rules "node scripts/test-rules-account-delete.mjs"
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, addDoc, collection, getDocs, updateDoc, deleteDoc, deleteField, arrayUnion, serverTimestamp } from 'firebase/firestore';

const as = (uid, email = `${uid}@x.test`) => {
  const app = initializeApp({ projectId: 'demo-rules', apiKey: 'x' }, uid);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: { user_id: uid, email, email_verified: true } });
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

// 4.3: deletion must not stop on things that were never there
await expect('deleting an invite code you never made is fine', true, () => deleteDoc(doc(member, 'referral_codes', 'ZZZZZZ2')));
await setDoc(doc(owner, 'referral_codes', 'ABCDEF3'), { uid: 'u1', createdAt: serverTimestamp() });
await expect('someone else cannot delete your invite code', false, () => deleteDoc(doc(member, 'referral_codes', 'ABCDEF3')));
await setDoc(doc(member, 'users', 'u2', 'outbox', 'm1'), { type: 'trip_invite', sent: false, to: 'a@b.co', tripId: 't1' });
await expect('you delete your own outbox mail', true, () => deleteDoc(doc(member, 'users', 'u2', 'outbox', 'm1')));
await expect('you ask the server to finish deleting your account', true, () => setDoc(doc(member, 'account_admin', 'u2'), { state: 'self_delete_requested', requestedAt: Date.now(), reason: 'x' }));
await expect('you cannot ask to delete someone else', false, () => setDoc(doc(stranger, 'account_admin', 'u2'), { state: 'self_delete_requested', requestedAt: Date.now() }));
await expect('you cannot restore yourself', false, () => setDoc(doc(member, 'account_admin', 'u2'), { state: 'restore_requested', requestedAt: Date.now() }));

// Feedback → owner's inbox; trustees read only
const boss = as('boss', 'thrishankkuntimaddi@gmail.com'), trustee = as('t1', 'friend@x.test');
const fb = { uid: 'u2', email: 'u2@x.test', name: 'R', kind: 'bug', text: 'Broken', page: 'help', platform: 'web', version: '4.3.0', device: 'Android · Chrome', createdAt: serverTimestamp(), status: 'new', notified: false };
await expect('anyone signed in sends feedback', true, () => addDoc(collection(member, 'feedback'), fb));
await expect('feedback cannot pretend to be someone else', false, () => addDoc(collection(member, 'feedback'), { ...fb, uid: 'u1' }));
await expect('a user cannot read the inbox', false, () => getDocs(collection(member, 'feedback')));
await expect('the owner reads the inbox', true, () => getDocs(collection(boss, 'feedback')));
await expect('a stranger cannot read activity', false, () => getDocs(collection(trustee, 'user_activity')));
await expect('the owner adds a trustee', true, () => setDoc(doc(boss, 'admin_config', 'team'), { viewers: ['friend@x.test'] }));
await expect('a trustee reads activity', true, () => getDocs(collection(trustee, 'user_activity')));
await expect('a trustee reads the inbox', true, () => getDocs(collection(trustee, 'feedback')));
await expect('a trustee cannot change the team', false, () => setDoc(doc(trustee, 'admin_config', 'team'), { viewers: ['friend@x.test', 'x@y.z'] }));
await expect('a trustee cannot close accounts', false, () => setDoc(doc(trustee, 'account_admin', 'u2'), { state: 'delete_requested', requestedAt: Date.now() }));
await expect('a trustee reads their own team doc', true, () => getDoc(doc(trustee, 'admin_config', 'team')));
await expect('the owner force-closes an active account', true, () => setDoc(doc(boss, 'account_admin', 'u1'), { state: 'delete_requested', requestedAt: Date.now(), force: true }));
await expect('activity accepts the new detail fields', true, () => setDoc(doc(member, 'user_activity', 'u2'), { email: 'u2@x.test', lastOpenedAt: Date.now(), provider: 'google', verified: true, devices: 2, rules: 3, lang: 'en', theme: 'light', lockOn: false, activeDays: 4 }));

console.log(failures ? `\n${failures} check(s) failed` : '\nall rules checks passed');
process.exit(failures ? 1 : 0);
