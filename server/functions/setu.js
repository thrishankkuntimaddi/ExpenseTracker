// ─── Bank linking: Setu Account Aggregator (FIU) ─────────────────
// 1. setuCreateConsent (app)  → Setu consent; the app opens its URL, the user
//                               picks their bank(s) and approves in the AA app
// 2. setuWebhook (Setu)       → consent ACTIVE → ask for data (a "session")
//                               session COMPLETED → transactions into
//                               users/{uid}/bank_inbox/{id}
// 3. setuFetch (app)          → ask for fresh data on an active consent
// The app then reviews the inbox like an imported statement: nothing goes
// into the ledger until the user taps Add, and entries they already have
// come up unticked (one ledger, never doubles).
//
// Endpoints follow Setu's FIU v2 API (https://docs.setu.co/data/account-aggregator).
// Check them against the docs when the keys arrive — sandbox first.
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fiToLines, inboxId } from './fi.js';

const SETU_BASE = defineString('SETU_BASE', { default: 'https://fiu-sandbox.setu.co' });
const SETU_CLIENT_ID = defineSecret('SETU_CLIENT_ID');
const SETU_CLIENT_SECRET = defineSecret('SETU_CLIENT_SECRET');
const SETU_PRODUCT_ID = defineSecret('SETU_PRODUCT_INSTANCE_ID');
const SETU_WEBHOOK_TOKEN = defineSecret('SETU_WEBHOOK_TOKEN');   // the header value set in Setu Bridge → webhook auth
const SECRETS = [SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_ID];
const REGION = 'asia-south1';
const DAY = 24 * 3600 * 1000;

async function setu(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${SETU_BASE.value()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': SETU_CLIENT_ID.value(),
      'x-client-secret': SETU_CLIENT_SECRET.value(),
      'x-product-instance-id': SETU_PRODUCT_ID.value(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Setu ${method} ${path}: ${r.status} ${data?.errorMsg ?? ''}`);
  return data;
}

const linkRef = (uid, consentId) => getFirestore().doc(`users/${uid}/bank_links/${consentId}`);
const range = (days) => ({ from: new Date(Date.now() - days * DAY).toISOString(), to: new Date().toISOString() });

async function startSession(uid, consentId, days = 90) {
  const s = await setu('/v2/sessions', { method: 'POST', body: { consentId, dataRange: range(days), format: 'json' } });
  await getFirestore().doc(`aa_sessions/${s.id}`).set({ uid, consentId, at: FieldValue.serverTimestamp() });
  await linkRef(uid, consentId).set({ fetching: true, lastAskedAt: FieldValue.serverTimestamp() }, { merge: true });
  return s.id;
}

async function saveSession(sessionId) {
  const db = getFirestore();
  const meta = (await db.doc(`aa_sessions/${sessionId}`).get()).data();
  if (!meta) return 0;
  const data = await setu(`/v2/sessions/${sessionId}`);
  const lines = fiToLines(data);
  // Batches of 400; fixed ids, so fetching the same days again changes nothing
  for (let i = 0; i < lines.length; i += 400) {
    const batch = db.batch();
    lines.slice(i, i + 400).forEach((l) => batch.set(db.doc(`users/${meta.uid}/bank_inbox/${inboxId(l)}`), { ...l, at: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
  await linkRef(meta.uid, meta.consentId).set({ fetching: false, lastFetchedAt: FieldValue.serverTimestamp(), lastCount: lines.length }, { merge: true });
  return lines.length;
}

/** App: start linking. data = { mobile } (10 digits, used as the AA handle). */
export const setuCreateConsent = onCall({ secrets: SECRETS, region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  const mobile = String(req.data?.mobile ?? '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) throw new HttpsError('invalid-argument', 'A 10-digit mobile number');
  const c = await setu('/v2/consents', {
    method: 'POST',
    body: {
      vua: mobile,
      consentDuration: { unit: 'MONTH', value: '12' },
      dataRange: range(365),
      context: [],
    },
  });
  await getFirestore().doc(`aa_consents/${c.id}`).set({ uid, at: FieldValue.serverTimestamp() });
  await linkRef(uid, c.id).set({ status: c.status ?? 'PENDING', createdAt: FieldValue.serverTimestamp(), mobileEnd: mobile.slice(-4) }, { merge: true });
  return { consentId: c.id, url: c.url };
});

/** App: fetch fresh transactions on a linked (ACTIVE) consent. */
export const setuFetch = onCall({ secrets: SECRETS, region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  const consentId = String(req.data?.consentId ?? '');
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  const owner = (await getFirestore().doc(`aa_consents/${consentId}`).get()).data();
  if (owner?.uid !== uid) throw new HttpsError('permission-denied', 'Not your link');
  return { sessionId: await startSession(uid, consentId, Number(req.data?.days) || 30) };
});

/** Setu → here (Bridge → Webhooks). */
export const setuWebhook = onRequest({ secrets: [...SECRETS, SETU_WEBHOOK_TOKEN], region: REGION }, async (req, res) => {
  if ((req.get('authorization') ?? '') !== SETU_WEBHOOK_TOKEN.value()) { res.status(401).send('no'); return; }
  const n = req.body ?? {};
  try {
    if (n.type === 'CONSENT_STATUS_UPDATE') {
      const owner = (await getFirestore().doc(`aa_consents/${n.consentId}`).get()).data();
      if (owner) {
        const status = n.data?.status ?? 'UNKNOWN';
        await linkRef(owner.uid, n.consentId).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (status === 'ACTIVE') await startSession(owner.uid, n.consentId);
      }
    } else if (n.type === 'SESSION_STATUS_UPDATE' && ['COMPLETED', 'PARTIAL'].includes(n.data?.status)) {
      await saveSession(n.dataSessionId);
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error('setu webhook', n.type, e.message);
    res.status(500).send('retry');
  }
});
