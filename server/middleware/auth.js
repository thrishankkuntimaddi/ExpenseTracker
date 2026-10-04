// ─── Firebase ID-token auth for the Sheets proxy ─────────────────────────────
// Every /api request must carry `Authorization: Bearer <Firebase ID token>`.
// Verification only needs the project ID (Google's public signing keys are
// fetched automatically), so no extra service-account credentials are needed.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nistha-passi-core';
initializeApp({ projectId: PROJECT_ID });

/* Optional allow-list: comma-separated Firebase UIDs permitted to use the
   proxy. The service account can read every sheet shared with it, so in any
   shared deployment you should restrict who may drive it. */
const ALLOWED_UIDS = (process.env.ALLOWED_UIDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

export async function requireFirebaseAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match  = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ success: false, error: 'Missing auth token' });
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    if (ALLOWED_UIDS.length && !ALLOWED_UIDS.includes(decoded.uid)) {
      return res.status(403).json({ success: false, error: 'Not allowed to use this sync server' });
    }
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired auth token' });
  }
}
