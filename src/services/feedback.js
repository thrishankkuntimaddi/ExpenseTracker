// ─── Feedback & problem reports ──────────────────────────────────
// feedback/{id}: what someone sends from Help (a problem, an idea, a
// question) and what the app reports by itself when something breaks (a
// crash, an account that couldn't be deleted). The owner sees them in
// Profile → Admin sees → Inbox, and the notifier pushes / mails each new one.
// Never amounts or entries: the person's own words, or an error message.
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { platform } from '../native';

export const FEEDBACK_KINDS = {
  bug:      { label: 'Problem',  tone: 'expense' },
  idea:     { label: 'Idea',     tone: 'accent' },
  question: { label: 'Question', tone: 'savings' },
  crash:    { label: 'Crash',    tone: 'expense' },
  deletion: { label: 'Delete account', tone: 'lent' },
  other:    { label: 'Other',    tone: 'text-secondary' },
};

const AUTO_KEY = 'et_auto_reports';
const AUTO_PER_DAY = 5;

function device() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return `${os}${browser ? ` · ${browser}` : ''}`.slice(0, 80);
}

/** Send one. Throws on failure (the form shows it); auto reports use report(). */
export async function sendFeedback({ kind = 'other', text, page = '' }) {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error('Sign in to send feedback.');
  const body = String(text ?? '').trim().slice(0, 4000);
  if (!body) throw new Error('Write a few words first.');
  await addDoc(collection(db, 'feedback'), {
    uid: user.uid,
    email: String(user.email ?? '').slice(0, 200),
    name: String(user.displayName ?? '').slice(0, 120),
    kind, text: body,
    page: String(page).slice(0, 40),
    platform,
    version: String(import.meta.env.VITE_APP_VERSION ?? '').slice(0, 20),
    device: device(),
    createdAt: serverTimestamp(),
    status: 'new',
    notified: false,
  });
}

/** The app reports a problem by itself — quietly, at most a few a day per device, never twice the same. */
export function reportProblem(kind, message, page = '') {
  try {
    if (!auth?.currentUser) return;
    const text = String(message ?? '').slice(0, 1500);
    const today = new Date().toISOString().slice(0, 10);
    const log = JSON.parse(localStorage.getItem(AUTO_KEY) || '{}');
    const sent = log.day === today ? log : { day: today, n: 0, seen: [] };
    const sig = `${kind}:${text.slice(0, 120)}`;
    if (sent.n >= AUTO_PER_DAY || sent.seen.includes(sig)) return;
    localStorage.setItem(AUTO_KEY, JSON.stringify({ ...sent, n: sent.n + 1, seen: [...sent.seen, sig].slice(-20) }));
    sendFeedback({ kind, text, page }).catch(() => {});
  } catch { /* never in the way */ }
}

/* ── Owner only (the rules refuse anyone else) ── */
const ms = (v) => (v?.toMillis ? v.toMillis() : Number(v) || 0);

export async function listFeedback(max = 200) {
  const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt), doneAt: ms(d.data().doneAt) || null }));
}
export const markFeedback = (id, status) => updateDoc(doc(db, 'feedback', id), { status, doneAt: status === 'done' ? Date.now() : null });
export const removeFeedback = (id) => deleteDoc(doc(db, 'feedback', id));
