// ─── Admin sees: trustees and system health ──────────────────────
// admin_config/team { viewers: [emails] } — people the owner lets SEE Admin
// sees (read only). system_health/{notifier, usage} — written by the server
// job each run. admin_ping/{uid} — the owner's live round-trip check.
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { APP_URL } from '../config/sites';

const TEAM = () => doc(db, 'admin_config', 'team');
const CACHE = (uid) => `et_trustee_${uid}`;
const DAY = 86400e3;

export async function getTeam() {
  const snap = await getDoc(TEAM());
  return snap.exists() ? (snap.data().viewers ?? []) : [];
}
export async function saveTeam(viewers) {
  const clean = [...new Set(viewers.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 10);
  await setDoc(TEAM(), { viewers: clean, updatedAt: serverTimestamp() });
  return clean;
}

/** Is this (verified, non-owner) account a trustee? Asked once a day; never for unverified accounts. */
export async function checkTrustee(user) {
  if (!db || !user?.uid || !user.emailVerified || !user.email) return false;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE(user.uid)) || 'null');
    if (c && Date.now() - c.at < DAY) return c.yes;
  } catch { /* storage unavailable */ }
  let yes = false;
  try { yes = (await getTeam()).includes(user.email.toLowerCase()); } catch { yes = false; }
  try { localStorage.setItem(CACHE(user.uid), JSON.stringify({ at: Date.now(), yes })); } catch { /* storage unavailable */ }
  return yes;
}

export async function getHealth() {
  const [n, u] = await Promise.all([
    getDoc(doc(db, 'system_health', 'notifier')).catch(() => null),
    getDoc(doc(db, 'system_health', 'usage')).catch(() => null),
  ]);
  return { notifier: n?.exists() ? n.data() : null, usage: u?.exists() ? u.data() : null };
}

/** Live checks from this device: database round trip, the website, sign-in. */
export async function liveChecks(user, isOwner) {
  const out = [];
  const time = async (name, fn) => {
    const t0 = performance.now();
    try { const note = await fn(); out.push({ name, ok: true, ms: Math.round(performance.now() - t0), note }); }
    catch (e) { out.push({ name, ok: false, ms: Math.round(performance.now() - t0), note: e?.code ?? e?.message ?? String(e) }); }
  };
  await time('Database (read & write)', async () => {
    if (!isOwner) { await getDocFromServer(doc(db, 'system_health', 'notifier')); return 'read only'; }
    const ref = doc(db, 'admin_ping', user.uid);
    await setDoc(ref, { at: Date.now() });
    await getDocFromServer(ref);
    return 'write + read';
  });
  await time('Website', async () => {
    // no-cors: the apps run on another origin; an opaque answer still proves it's up
    await fetch(`${APP_URL}manifest.json?ping=${Date.now()}`, { cache: 'no-store', mode: 'no-cors' });
    return 'reachable';
  });
  await time('Sign-in', async () => { await user.getIdToken(true); return 'token fresh'; });
  return out;
}
