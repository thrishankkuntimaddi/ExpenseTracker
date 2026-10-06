/**
 * clear-db.mjs — Delete ALL ExpenseTracker Firestore data for a user
 * (transactions, income, external_transactions, recently_deleted)
 *
 * Usage:
 *   node scripts/clear-db.mjs <email>
 *
 * The password is prompted for interactively (input hidden) so it never
 * lands in shell history or the process list. For non-interactive use,
 * set ET_PASSWORD in the environment instead.
 */

import https from 'https';
import readline from 'readline';
// Run with:  node --env-file=.env scripts/clear-db.mjs   (reads VITE_FIREBASE_* from .env)
import { firebaseConfig } from '../src/services/firebaseConfig.js';

const PROJECT_ID = firebaseConfig.projectId;
const API_KEY    = firebaseConfig.apiKey;
const COLLECTIONS = ['transactions', 'income', 'external_transactions', 'recently_deleted'];

const [,, email] = process.argv;
if (!email) {
  console.error('Usage: node scripts/clear-db.mjs <email>');
  process.exit(1);
}

/* ── Read a password from the TTY without echoing it ── */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
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
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/${collection}?key=${API_KEY}&pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const u = new URL(url);
    const res = await request(url, {
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    docs.push(...(res.body?.documents ?? []));
    pageToken = res.body?.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

async function main() {
  const password = process.env.ET_PASSWORD || await promptHidden(`Password for ${email}: `);
  if (!password) { console.error('❌  No password given.'); process.exit(1); }

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

  /* 2. Delete every document in each collection */
  const counts = {};
  for (const collection of COLLECTIONS) {
    console.log(`🗑️   Fetching ${collection}…`);
    const docs = await listDocs(collection, uid, idToken);
    for (const doc of docs) {
      const res = await del(`https://firestore.googleapis.com/v1/${doc.name}`, idToken);
      if (res.status >= 400) throw new Error(`Delete failed (${res.status}) for ${doc.name}`);
    }
    counts[collection] = docs.length;
    console.log(`   Deleted ${docs.length} ${collection}.`);
  }

  console.log('\n✅  Database cleared.', counts);
  console.log('   The app will update in real-time via Firestore listener.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
