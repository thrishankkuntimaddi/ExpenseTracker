import { describe, it, expect } from 'vitest';
import { describeSync, timeAgo, readableFirestoreError, background, getSyncState, noteSnapshot, reportListenError, clearSyncError } from '../../services/sync';

const base = { online: true, pending: 0, connected: true, lastSyncedAt: null, error: null };
const NOW = 1_800_000_000_000;

describe('describeSync', () => {
  it('synced, with when', () => {
    expect(describeSync({ ...base, lastSyncedAt: NOW - 120_000 }, NOW)).toEqual({ tone: 'ok', label: 'Synced', detail: 'All changes saved to your account · 2 min ago' });
  });
  it('pending uploads while online', () => {
    expect(describeSync({ ...base, pending: 3 }, NOW)).toMatchObject({ tone: 'busy', label: 'Syncing…', detail: '3 changes waiting to upload.' });
  });
  it('offline says data is safe on the device, and how much is waiting', () => {
    const d = describeSync({ ...base, online: false, pending: 1 }, NOW);
    expect(d.tone).toBe('offline');
    expect(d.detail).toMatch(/^1 change waiting to upload\. Saved on this device/);
    expect(describeSync({ ...base, online: false }, NOW).detail).toMatch(/saved on this device/);
  });
  it('a problem wins over everything', () => {
    expect(describeSync({ ...base, online: false, error: { message: 'Permission denied — …' } }, NOW)).toMatchObject({ tone: 'problem', detail: 'Permission denied — …' });
  });
  it('connecting until the server has answered', () => {
    expect(describeSync({ ...base, connected: false }, NOW).label).toBe('Connecting…');
  });
});

describe('timeAgo', () => {
  it('reads naturally', () => {
    expect(timeAgo(NOW - 10_000, NOW)).toBe('just now');
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(timeAgo(NOW - 3 * 3600_000, NOW)).toBe('3 h ago');
    expect(timeAgo(NOW - 26 * 3600_000, NOW)).toBe('yesterday');
    expect(timeAgo(NOW - 5 * 86400_000, NOW)).toBe('5 days ago');
  });
});

describe('readableFirestoreError', () => {
  it('turns permission-denied into an action, not a code', () => {
    const m = readableFirestoreError({ code: 'permission-denied' }, 'load your trips');
    expect(m).toMatch(/^Permission denied — the app isn't allowed to load your trips\./);
    expect(m).not.toMatch(/permission-denied/);
  });
  it('falls back to the raw message', () => {
    expect(readableFirestoreError({ message: 'boom' })).toBe("Couldn't save your change: boom.");
  });
});

describe('background writes and listeners', () => {
  it('counts a write as pending until the server confirms', async () => {
    let resolve; const p = new Promise((r) => { resolve = r; });
    background(p);
    expect(getSyncState().pending).toBe(1);
    resolve(); await p; await Promise.resolve();
    expect(getSyncState().pending).toBe(0);
    expect(getSyncState().lastSyncedAt).not.toBeNull();
  });
  it('reports a failed write and calls the rollback', async () => {
    let rolledBack = null;
    const p = Promise.reject(Object.assign(new Error('no'), { code: 'permission-denied' }));
    background(p, (err) => { rolledBack = err.code; });
    await p.catch(() => {}); await Promise.resolve();
    expect(rolledBack).toBe('permission-denied');
    expect(getSyncState().error).toMatchObject({ kind: 'write', code: 'permission-denied' });
    clearSyncError();
  });
  it('a listener error is cleared by the next server snapshot', () => {
    const quiet = console.error; console.error = () => {};
    reportListenError({ code: 'permission-denied' }, 'trips');
    console.error = quiet;
    expect(getSyncState().error?.kind).toBe('listen');
    noteSnapshot({ fromCache: true });
    expect(getSyncState().error?.kind).toBe('listen');
    noteSnapshot({ fromCache: false });
    expect(getSyncState().error).toBeNull();
    expect(getSyncState().connected).toBe(true);
  });
});
