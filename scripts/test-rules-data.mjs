// Firestore rules check for entries with accounts, settings, and the usage
// activity Admin sees reads. Run against the emulator:
//   firebase emulators:exec --only firestore --project demo-rules "node scripts/test-rules-data.mjs"
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, updateDoc, increment } from 'firebase/firestore';

const as = (uid, email = `${uid}@x.test`) => {
  const app = initializeApp({ projectId: 'demo-rules', apiKey: 'x' }, uid);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: { user_id: uid, email, email_verified: true } });
  return db;
};
const me = as('u1'), other = as('u2');
let failures = 0;
const expect = async (label, shouldPass, fn) => {
  let ok = true;
  try { await fn(); } catch { ok = false; }
  const good = ok === shouldPass;
  if (!good) failures++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${label}  (${ok ? 'allowed' : 'denied'})`);
};
const entry = { name: 'Tea', amount: 20, date: '2026-11-21T06:30:00.000Z', type: 'expense' };

// Entries with an account
await expect('an expense on an account', true, () => setDoc(doc(me, 'users/u1/transactions/a'), { ...entry, accountId: 'sbi' }));
await expect('moving money: from → to', true, () => setDoc(doc(me, 'users/u1/transactions/m'), { ...entry, type: 'cash', name: 'SBI → HDFC', accountId: 'sbi', toAccountId: 'hdfc' }));
await expect('income received in cash', true, () => setDoc(doc(me, 'users/u1/income/g'), { ...entry, name: 'Muzammil', isRepaymentRec: true, accountId: 'cash', paidWith: 'cash' }));
await expect('an entry without an account (older apps)', true, () => setDoc(doc(me, 'users/u1/transactions/b'), entry));
await expect('accountId must be a short string', false, () => setDoc(doc(me, 'users/u1/transactions/c'), { ...entry, accountId: 42 }));
await expect('toAccountId must be a short string', false, () => setDoc(doc(me, 'users/u1/transactions/d'), { ...entry, toAccountId: 'x'.repeat(65) }));
await expect('someone else cannot add to my entries', false, () => setDoc(doc(other, 'users/u1/transactions/e'), entry));
await expect('someone else cannot read my entries', false, () => getDoc(doc(other, 'users/u1/transactions/a')));

// Settings (accounts live in them)
await expect('I can save my settings', true, () => setDoc(doc(me, 'users/u1'), { settings: { accounts: [{ id: 'sbi', kind: 'bank', opening: 100 }] } }, { merge: true }));
await expect('someone else cannot save my settings', false, () => updateDoc(doc(other, 'users/u1'), { settings: {} }));

// Usage activity (Admin sees)
const act = doc(me, 'user_activity/u1');
await expect('activity with the feature counts', true, () => setDoc(act, { lastOpenedAt: Date.now(), accounts: 3, goals: 1, budget: true, carry: false, look: 'unsloped', settingsKeys: 12 }, { merge: true }));
await expect('a problem counted', true, () => setDoc(act, { errCount: increment(1), lastErr: 'save: settings · permission-denied', lastErrAt: Date.now() }, { merge: true }));
await expect('older fields still fine', true, () => setDoc(act, { opens: increment(1), platform: 'android', version: '4.5.3', theme: 'light', lockOn: false }, { merge: true }));
await expect('accounts must be a small count', false, () => setDoc(act, { accounts: 500 }, { merge: true }));
await expect('budget must be true/false', false, () => setDoc(act, { budget: 'yes' }, { merge: true }));
await expect('lastErr is short', false, () => setDoc(act, { lastErr: 'x'.repeat(121) }, { merge: true }));
await expect('no unknown fields (no amounts sneak in)', false, () => setDoc(act, { balance: 42300 }, { merge: true }));
await expect('someone else cannot write my activity', false, () => setDoc(doc(other, 'user_activity/u1'), { lastOpenedAt: Date.now() }, { merge: true }));
await expect('a normal user cannot list everyone', false, () => getDocs(collection(other, 'user_activity')));

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
