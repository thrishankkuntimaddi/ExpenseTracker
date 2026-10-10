// ─── Sync status ─────────────────────────────────────────────────
// One small store for "is my data safe in the cloud?":
//   online      — the browser's network state
//   pending     — writes saved on this device but not yet confirmed by the server
//   connected   — the live listeners have heard from the server (not just the cache)
//   lastSyncedAt— when the server last confirmed something
//   error       — a listener or write problem, as a readable message
//
// Firestore write promises resolve only when the SERVER acknowledges, which
// never happens offline. The change is already in the local cache (and
// queued for upload) the moment the call is made, so the UI must not wait:
// background() lets the caller move on, counts the write as pending, and
// still reports failures.
import { useSyncExternalStore } from 'react';

const hasWindow = typeof window !== 'undefined';
let state = {
  online: hasWindow ? navigator.onLine !== false : true,
  pending: 0,
  connected: false,
  lastSyncedAt: null,
  error: null,          // { kind: 'listen' | 'write', code, message }
};
const listeners = new Set();

function set(patch) {
  const next = { ...state, ...patch };
  if (Object.keys(next).every((k) => next[k] === state[k])) return;
  state = next;
  listeners.forEach((fn) => fn());
}

if (hasWindow) {
  window.addEventListener('online',  () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false, connected: false }));
}

export function getSyncState() { return state; }
export function subscribeSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useSyncStatus() { return useSyncExternalStore(subscribeSync, getSyncState, getSyncState); }

/** Run a Firestore write without blocking the UI on the server's acknowledgement. */
export function background(promise, onError) {
  set({ pending: state.pending + 1 });
  promise.then(
    () => set({ pending: Math.max(0, state.pending - 1), lastSyncedAt: Date.now(), ...(state.error?.kind === 'write' ? { error: null } : {}) }),
    (err) => {
      set({ pending: Math.max(0, state.pending - 1), error: { kind: 'write', code: err?.code, message: readableFirestoreError(err) } });
      onError?.(err);
    },
  );
}

/** Called by every live listener with its snapshot metadata. */
export function noteSnapshot(metadata) {
  if (metadata?.fromCache) return;
  set({
    connected: true,
    ...(state.pending === 0 ? { lastSyncedAt: Date.now() } : {}),
    ...(state.error?.kind === 'listen' ? { error: null } : {}),
  });
}

/** Called by every live listener when Firestore stops it with an error. */
export function reportListenError(err, what) {
  console.error(`[Firestore] ${what} listener error`, err);
  set({ connected: false, error: { kind: 'listen', code: err?.code, message: readableFirestoreError(err, `load your ${what}`) } });
}

export function clearSyncError() { set({ error: null }); }

/** Firestore error → something a person can act on. */
export function readableFirestoreError(err, action = 'save your change') {
  switch (err?.code) {
    case 'permission-denied':
      return `Permission denied — the app isn't allowed to ${action}. Sign out and back in; if it keeps happening, the database rules need updating.`;
    case 'unauthenticated':
      return `You've been signed out, so the app can't ${action}. Sign in again.`;
    case 'resource-exhausted':
      return `The database is over its free daily limit, so the app can't ${action} right now. It will work again after the limit resets.`;
    case 'unavailable':
    case 'deadline-exceeded':
      return `Can't reach the server to ${action}. It will retry automatically when the connection is back.`;
    case 'failed-precondition':
      return `The app couldn't ${action} because the offline database is open in another window in an incompatible mode. Close other ExpenseTracker windows and reload.`;
    case 'invalid-argument':
      return `The app tried to ${action} with data the database rejected. Please report this.`;
    default:
      return `Couldn't ${action}: ${err?.message || 'unknown error'}.`;
  }
}

/**
 * Status line for the UI: { tone: 'ok' | 'busy' | 'offline' | 'problem', label, detail }.
 * `now` is injectable for tests.
 */
export function describeSync(s, now = Date.now()) {
  if (s.error) return { tone: 'problem', label: 'Sync problem', detail: s.error.message };
  const waiting = s.pending > 0 ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting to upload` : null;
  if (!s.online) {
    return { tone: 'offline', label: 'Offline', detail: waiting ? `${waiting}. Saved on this device — they upload when you're back online.` : 'Everything is saved on this device and will sync when you’re back online.' };
  }
  if (waiting) return { tone: 'busy', label: 'Syncing…', detail: `${waiting}.` };
  if (!s.connected) return { tone: 'busy', label: 'Connecting…', detail: 'Showing your data from this device while it connects.' };
  return { tone: 'ok', label: 'Synced', detail: s.lastSyncedAt ? `All changes saved to your account · ${timeAgo(s.lastSyncedAt, now)}` : 'All changes saved to your account.' };
}

export function timeAgo(ts, now = Date.now()) {
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
