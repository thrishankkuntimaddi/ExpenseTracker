// ─── Paid support: verify a payment, then extend supporters/{uid} ──
// The app can never write supporters/{uid} (firestore.rules); only this
// code, with the admin SDK, after checking the payment with the provider.
// Each payment is credited once (supporters/{uid}/payments/{paymentId}).
import crypto from 'node:crypto';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const PLAY_SERVICE_ACCOUNT = defineSecret('PLAY_SERVICE_ACCOUNT_JSON');
const PACKAGE = 'com.thrishank.expensetracker';
const DAY = 24 * 3600 * 1000;

/** Plans (one-time payments, no auto-renew): id → days. Prices live in Razorpay / Play Console. */
export const PLANS = { supporter_month: 31, supporter_year: 366 };

/** Add `days` to the user's supporter time, once per paymentId. */
export async function credit(uid, { paymentId, plan, source }) {
  const days = PLANS[plan];
  if (!uid || !days || !paymentId) throw new Error('bad credit');
  const db = getFirestore();
  const ref = db.doc(`supporters/${uid}`);
  const pay = ref.collection('payments').doc(String(paymentId).replace(/[/.#[\]]/g, '_'));
  return db.runTransaction(async (tx) => {
    if ((await tx.get(pay)).exists) return false;   // already credited
    const cur = (await tx.get(ref)).data();
    const from = Math.max(Date.now(), cur?.until?.toMillis?.() ?? 0);
    tx.set(ref, { until: Timestamp.fromMillis(from + days * DAY), plan, source, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(pay, { plan, source, at: FieldValue.serverTimestamp() });
    return true;
  });
}

/**
 * Razorpay → this URL (Dashboard → Webhooks, event payment.captured).
 * The app opens Razorpay Checkout with notes: { uid, plan }.
 */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET], region: 'asia-south1' }, async (req, res) => {
  const sig = req.get('x-razorpay-signature') ?? '';
  const want = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value()).update(req.rawBody).digest('hex');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) { res.status(401).send('bad signature'); return; }
  const ev = req.body;
  if (ev?.event !== 'payment.captured') { res.status(200).send('ignored'); return; }
  const p = ev.payload?.payment?.entity;
  try {
    await credit(p?.notes?.uid, { paymentId: `rzp_${p?.id}`, plan: p?.notes?.plan, source: 'razorpay' });
    res.status(200).send('ok');
  } catch (e) {
    console.error('razorpay credit failed', p?.id, e.message);
    res.status(200).send('not credited');   // 200: Razorpay shouldn't retry a payment we can't map
  }
});

/**
 * Google Play Billing (Play build): the app sends { productId, purchaseToken }
 * after a purchase; Play confirms it, then it's acknowledged and credited.
 */
export const verifyPlayPurchase = onCall({ secrets: [PLAY_SERVICE_ACCOUNT], region: 'asia-south1' }, async (req) => {
  const uid = req.auth?.uid;
  const { productId, purchaseToken } = req.data ?? {};
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  if (!PLANS[productId] || typeof purchaseToken !== 'string') throw new HttpsError('invalid-argument', 'Unknown purchase');
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(PLAY_SERVICE_ACCOUNT.value()), scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const play = google.androidpublisher({ version: 'v3', auth });
  const { data } = await play.purchases.products.get({ packageName: PACKAGE, productId, token: purchaseToken });
  if (data.purchaseState !== 0) throw new HttpsError('failed-precondition', 'Payment not completed');
  if (data.obfuscatedExternalAccountId && data.obfuscatedExternalAccountId !== uid) throw new HttpsError('permission-denied', 'Bought on another account');
  const fresh = await credit(uid, { paymentId: `play_${data.orderId}`, plan: productId, source: 'play' });
  if (data.acknowledgementState === 0) await play.purchases.products.acknowledge({ packageName: PACKAGE, productId, token: purchaseToken });
  return { ok: true, fresh };
});
