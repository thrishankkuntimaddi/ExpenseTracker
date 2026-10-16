import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newBackupKey, isEncryptedBackup, decryptBackup } from '../backupCrypto';

/* A pretend Google Drive: files with a parent, the token's scopes, and a log
   of what the app did */
const KEY = newBackupKey();
let drive, scopes, saved;
vi.mock('../../native', () => ({ platform: 'android' }));
vi.mock('../../native/googleSignIn', () => ({ desktopOAuth: vi.fn(), desktopRefresh: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ authorize: async () => ({ accessToken: `tok-${scopes.join(',')}` }) }) }));
vi.mock('../../services/firebase', () => ({ db: {}, auth: null }));
vi.mock('../../services/firestore', () => ({ exportAllUserData: async () => ({ format: 'expensetracker-backup', transactions: [{ id: 't1', name: 'Rent', amount: 15000 }] }) }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  onSnapshot: () => () => {},
  setDoc: async (ref, data) => { saved[ref] = { ...(saved[ref] ?? {}), ...data }; },
  runTransaction: async (_db, fn) => fn({ get: async () => ({ exists: () => true, data: () => ({ k: KEY }) }), set: () => {} }),
}));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, reauthenticateWithPopup: vi.fn() }));

const SC = { appdata: 'https://www.googleapis.com/auth/drive.appdata', file: 'https://www.googleapis.com/auth/drive.file' };
let nextId = 1;
function fakeFetch(url, init = {}) {
  const u = new URL(url);
  const json = (o) => Promise.resolve({ ok: true, status: 200, json: async () => o, text: async () => (typeof o === 'string' ? o : JSON.stringify(o)) });
  if (u.hostname === 'oauth2.googleapis.com') return json({ scope: scopes.map((s) => SC[s]).join(' ') });
  const method = init.method ?? 'GET';
  if (u.pathname.startsWith('/upload/')) {
    const body = String(init.body);
    const meta = JSON.parse(body.split('\r\n\r\n')[1].split('\r\n')[0]);
    const content = body.split('\r\n\r\n')[2].split('\r\n--')[0];
    const parent = meta.parents[0];
    if (parent === 'appDataFolder' && !scopes.includes('appdata')) return Promise.resolve({ ok: false, status: 403, json: async () => ({ error: { message: 'insufficient scope' } }) });
    const f = { id: `f${nextId++}`, name: meta.name, parent, content, createdTime: new Date(Date.now() + nextId * 1000).toISOString(), size: String(content.length) };
    drive.push(f);
    return json(f);
  }
  const id = u.pathname.split('/files/')[1];
  if (id && method === 'DELETE') { drive = drive.filter((f) => f.id !== id); return json({}); }
  if (id && method === 'PATCH') { const f = drive.find((x) => x.id === id); Object.assign(f, JSON.parse(init.body)); return json(f); }
  if (id && u.searchParams.get('alt') === 'media') return json(drive.find((f) => f.id === id).content);
  if (u.pathname.endsWith('/files') && method === 'POST') { const f = { id: `folder${nextId++}`, ...JSON.parse(init.body), parent: 'root' }; drive.push(f); return json(f); }
  // list
  const q = u.searchParams.get('q') ?? '';
  let files;
  if (u.searchParams.get('spaces') === 'appDataFolder') files = drive.filter((f) => f.parent === 'appDataFolder');
  else if (q.includes("mimeType='application/vnd.google-apps.folder'")) files = drive.filter((f) => f.mimeType === 'application/vnd.google-apps.folder' && !f.trashed);
  else { const parent = q.match(/'([^']+)' in parents/)?.[1]; files = drive.filter((f) => f.parent === parent); }
  return json({ files: [...files].sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime))) });
}

beforeEach(() => {
  drive = []; saved = {}; nextId = 1;
  globalThis.fetch = vi.fn(fakeFetch);
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
});

describe('Drive backup: hidden, encrypted, one copy', () => {
  it('saves to hidden storage, encrypted, keeps only the newest, clears the old visible folder', async () => {
    const { backupNow, listBackups, downloadBackup } = await import('../../services/drive');
    // What older versions left: a visible folder with readable copies
    drive.push({ id: 'oldFolder', name: 'Expense Tracker backups', mimeType: 'application/vnd.google-apps.folder', parent: 'root' });
    drive.push({ id: 'old1', name: 'expense-tracker-backup-1.json', parent: 'oldFolder', content: '{"transactions":[]}', createdTime: '2026-01-01T00:00:00Z' });
    drive.push({ id: 'old2', name: 'expense-tracker-backup-2.json', parent: 'oldFolder', content: '{"transactions":[]}', createdTime: '2026-01-02T00:00:00Z' });
    scopes = ['appdata', 'file'];
    await backupNow({ uid: 'u1', email: 'a@b.c', interactive: true });
    await backupNow({ uid: 'u1', email: 'a@b.c', interactive: true });
    await backupNow({ uid: 'u1', email: 'a@b.c', interactive: true });
    const hidden = drive.filter((f) => f.parent === 'appDataFolder');
    expect(hidden).toHaveLength(1);                                  // one copy
    expect(isEncryptedBackup(hidden[0].content)).toBe(true);         // unreadable on its own
    expect(hidden[0].content).not.toContain('Rent');
    expect(drive.find((f) => f.id === 'old1')).toBeUndefined();      // old readable copies gone
    expect(drive.find((f) => f.id === 'oldFolder').trashed).toBe(true);   // folder in Drive's trash, not deleted
    expect(saved['users/u1/drive_backup/state']).toMatchObject({ hidden: true, encrypted: true, legacyCleared: true });
    // Restore: list → download → decrypted with the account key
    const list = await listBackups('tok-appdata,file');
    expect(list.hidden).toBe(true);
    const text = await downloadBackup('tok-appdata,file', list.files[0].id, 'u1');
    expect(JSON.parse(text).transactions[0].name).toBe('Rent');
  });

  it('an older Android app (no hidden storage) keeps one encrypted copy in the folder', async () => {
    const { backupNow } = await import('../../services/drive');
    drive.push({ id: 'oldFolder', name: 'Expense Tracker backups', mimeType: 'application/vnd.google-apps.folder', parent: 'root' });
    drive.push({ id: 'old1', name: 'old.json', parent: 'oldFolder', content: '{}', createdTime: '2026-01-01T00:00:00Z' });
    scopes = ['file'];
    await backupNow({ uid: 'u1', email: 'a@b.c', interactive: true });
    await backupNow({ uid: 'u1', email: 'a@b.c', interactive: true });
    const inFolder = drive.filter((f) => f.parent === 'oldFolder');
    expect(inFolder).toHaveLength(1);
    expect(isEncryptedBackup(inFolder[0].content)).toBe(true);
    expect(await decryptBackup(KEY, inFolder[0].content)).toContain('Rent');
    expect(saved['users/u1/drive_backup/state']).toMatchObject({ hidden: false, encrypted: true });
  });
});
