// ─── Live config: what the owner says to every app, right now ────
// app_config/live, written from Admin sees → Control, read by every signed-in
// app (one listener; a change reaches open apps within seconds):
//   banners      [{ id, text, tone: 'info'|'warn'|'new', link?, linkLabel?,
//                   until? (ms), platforms? ['android','web','desktop'],
//                   dismissible (default true), at }] — a note on Home
//   maintenance  { on, message, until? } — a "back soon" screen (the owner
//                still gets in)
//   minVersion   '4.6.0' + minMessage — older apps are asked to update first
// admin_secrets/github { token } — the owner's GitHub token for running the
// server job from the app. Only the owner's account can read or write it.
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { compareVersions } from '../utils/adminUsers';

const LIVE = () => doc(db, 'app_config', 'live');
const SECRET = () => doc(db, 'admin_secrets', 'github');
export const REPO = 'thrishankkuntimaddi/ExpenseTracker';
export const NOTIFIER = 'notifier.yml';

const EMPTY = { banners: [], maintenance: { on: false, message: '' }, minVersion: '', minMessage: '' };

/** Listen to the live config; cb(config). Returns unsubscribe. Errors leave the app as it is. */
export function subscribeLive(cb) {
  if (!db) return () => {};
  try {
    return onSnapshot(LIVE(), (snap) => cb({ ...EMPTY, ...(snap.exists() ? snap.data() : {}) }), () => cb(EMPTY));
  } catch { return () => {}; }
}

export async function getLive() {
  const snap = await getDoc(LIVE());
  return { ...EMPTY, ...(snap.exists() ? snap.data() : {}) };
}

/** Owner only (rules): replace the live config. */
export async function saveLive(next) {
  const clean = {
    banners: (next.banners ?? []).slice(0, 5).map((b) => ({
      id: String(b.id), text: String(b.text ?? '').slice(0, 400), tone: ['info', 'warn', 'new'].includes(b.tone) ? b.tone : 'info',
      link: b.link ? String(b.link).slice(0, 300) : null, linkLabel: b.linkLabel ? String(b.linkLabel).slice(0, 40) : null,
      until: Number(b.until) || null, platforms: Array.isArray(b.platforms) && b.platforms.length ? b.platforms.slice(0, 3) : null,
      dismissible: b.dismissible !== false, at: Number(b.at) || Date.now(),
    })),
    maintenance: { on: !!next.maintenance?.on, message: String(next.maintenance?.message ?? '').slice(0, 400), until: Number(next.maintenance?.until) || null },
    minVersion: /^\d+\.\d+\.\d+$/.test(next.minVersion ?? '') ? next.minVersion : '',
    minMessage: String(next.minMessage ?? '').slice(0, 300),
    updatedAt: serverTimestamp(),
  };
  await setDoc(LIVE(), clean);
  return clean;
}

/* ── What an app should show, from the config (pure) ── */
export function liveBanners(cfg, { platform = 'web', now = Date.now(), dismissed = [] } = {}) {
  return (cfg?.banners ?? []).filter((b) => b?.text
    && (!b.until || b.until > now)
    && (!b.platforms || b.platforms.includes(platform))
    && !(b.dismissible !== false && dismissed.includes(b.id)));
}
/** 'maintenance' | 'update' | null for this app. Admins are never locked out. */
export function liveGate(cfg, { version = '0.0.0', admin = false, now = Date.now() } = {}) {
  if (admin || !cfg) return null;
  const m = cfg.maintenance;
  if (m?.on && (!m.until || m.until > now)) return 'maintenance';
  if (cfg.minVersion && version && /^\d/.test(version) && compareVersions(version, cfg.minVersion) < 0) return 'update';
  return null;
}

/* ── Server job from the app (GitHub Actions) ── */
export async function getGithubToken() {
  const snap = await getDoc(SECRET());
  return snap.exists() ? (snap.data().token ?? '') : '';
}
export async function saveGithubToken(token) {
  await setDoc(SECRET(), { token: String(token ?? '').trim().slice(0, 300), updatedAt: serverTimestamp() });
}

async function gh(token, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!res.ok) {
    const why = res.status === 401 ? 'GitHub says the token is wrong or expired.'
      : res.status === 403 || res.status === 404 ? 'GitHub refused — the token needs “Actions: read and write” on this repository.'
      : `GitHub answered ${res.status}.`;
    throw new Error(why);
  }
  return res.status === 204 ? null : res.json();
}
/** Start the server job now. */
export const runServerJob = (token) => gh(token, `/actions/workflows/${NOTIFIER}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
/** The last runs: [{ id, status, conclusion, event, created_at, run_started_at, updated_at, html_url }] */
export async function serverJobRuns(token, n = 8) {
  const r = await gh(token, `/actions/workflows/${NOTIFIER}/runs?per_page=${n}`);
  return (r?.workflow_runs ?? []).map(({ id, status, conclusion, event, created_at, run_started_at, updated_at, html_url }) => ({ id, status, conclusion, event, created_at, run_started_at, updated_at, html_url }));
}
export const cancelServerJob = (token, id) => gh(token, `/actions/runs/${id}/cancel`, { method: 'POST' });
