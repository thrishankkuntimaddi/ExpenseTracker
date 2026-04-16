/**
 * clear-db.mjs — Delete ALL Firestore data for a user (transactions + income)
 *
 * Usage:
 *   node scripts/clear-db.mjs <email> <password>
 *
 * Example:
 *   node scripts/clear-db.mjs user@example.com mypassword123
 */

import https from 'https';

const PROJECT_ID = 'nistha-passi-core';
const API_KEY    = 'AIzaSyALUloNt0HWTMeP4IARvRMS9JY-R5_NnFM';

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/clear-db.mjs <email> <password>');
  process.exit(1);
}

/* ── Tiny HTTPS fetch wrapper ── */
function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function post(url, body) {
  const u = new URL(url);
  return request(url, {
    hostname: u.hostname, path: u.pathname + u.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, body);
}

function del(url, idToken) {
  const u = new URL(url);
  return request(url, {
    hostname: u.hostname, path: u.pathname + u.search,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

async function listDocs(collection, uid, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/${collection}?key=${API_KEY}`;
  const u = new URL(url);
  const res = await request(url, {
    hostname: u.hostname, path: u.pathname + u.search,
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.body?.documents ?? [];
}

async function main() {
  /* 1. Sign in with email/password */
  console.log(`🔐  Signing in as ${email}…`);
  const authRes = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { email, password, returnSecureToken: true }
  );
  if (!authRes.body.idToken) {
    console.error('❌  Sign-in failed:', authRes.body.error?.message ?? authRes.body);
    process.exit(1);
  }
  const { idToken, localId: uid } = authRes.body;
  console.log(`✅  Signed in. UID = ${uid}`);

  /* 2. Delete all transactions */
  console.log('🗑️   Fetching transactions…');
  const txns = await listDocs('transactions', uid, idToken);
  console.log(`   Found ${txns.length} transactions.`);
  for (const doc of txns) {
    const url = `https://firestore.googleapis.com/v1/${doc.name}`;
    await del(url, idToken);
  }
  if (txns.length) console.log(`   Deleted ${txns.length} transactions.`);

  /* 3. Delete all income */
  console.log('🗑️   Fetching income…');
  const inc = await listDocs('income', uid, idToken);
  console.log(`   Found ${inc.length} income entries.`);
  for (const doc of inc) {
    const url = `https://firestore.googleapis.com/v1/${doc.name}`;
    await del(url, idToken);
  }
  if (inc.length) console.log(`   Deleted ${inc.length} income entries.`);

  console.log('\n✅  Database cleared. Transactions:', txns.length, '| Income:', inc.length);
  console.log('   The app will update in real-time via Firestore listener.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
