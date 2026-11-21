// @vitest-environment jsdom
// Settings are written as one whole map. A change made before the saved
// settings arrive (the looks note counts an app open right away) used to be
// written on top of an empty map — wiping accounts, budgets, goals …
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const fs = vi.hoisted(() => ({ onData: null, writes: [], updates: [] }));
vi.mock('../../services/firestore', () => ({
  subscribeToUserData: (uid, onData) => { fs.onData = onData; return () => {}; },
  subscribeToRecentlyDeleted: () => () => {},
  ensureUserDoc: async () => {},
  updateSettings: async (uid, s) => { fs.writes.push(s); },
  addTransaction: async () => {}, updateTransaction: async (uid, t, removed) => { fs.updates.push({ t, removed }); }, trashTransaction: async () => {},
  addIncome: async () => {}, updateIncome: async (uid, t, removed) => { fs.updates.push({ t, removed }); }, trashIncome: async () => {},
  restoreFromRecentlyDeleted: async () => {}, permanentlyDeleteFromRecentlyDeleted: async () => {}, emptyRecentlyDeleted: async () => {},
}));
vi.mock('../../services/sync', () => ({ background: (p) => p, readableFirestoreError: () => '' }));

const { useFirestoreData, droppedKeys } = await import('../useFirestoreData');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let api;
function Probe() { api = useFirestoreData('u1', 'u@x.com'); return null; }
const saved = {
  accounts: [{ id: 'sbi', name: 'SBI', kind: 'bank', color: 1, opening: 100, openingDate: '2026-11-21' }],
  budgets: { total: 20000 }, looksIntro: { seen: 1 },
};
const deliver = (settings) => act(async () => { fs.onData({ transactions: [], income: [], settings, source: 'settings' }); });

describe('settings before they load', () => {
  beforeEach(async () => {
    fs.writes = [];
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Probe />); });
  });

  it('a change made before they arrive is kept, and applied on top of them', async () => {
    await act(async () => { await api.patchSettings((cur) => ({ looksIntro: { ...cur.looksIntro, seen: (cur.looksIntro?.seen ?? 0) + 1 } })); });
    expect(fs.writes).toEqual([]);                    // nothing written over the unknown settings
    await deliver(saved);
    expect(fs.writes).toHaveLength(1);
    expect(fs.writes[0].accounts).toEqual(saved.accounts);
    expect(fs.writes[0].budgets).toEqual(saved.budgets);
    expect(fs.writes[0].looksIntro.seen).toBe(2);
    expect(api.settings.accounts).toEqual(saved.accounts);
  });

  it('nothing queued: nothing written; later changes write the whole map', async () => {
    await deliver(saved);
    expect(fs.writes).toEqual([]);
    await act(async () => { await api.patchSettings({ lang: 'te' }); await api.patchSettings((cur) => ({ defaultAccount: cur.accounts[0].id })); });
    expect(fs.writes).toHaveLength(2);
    expect(fs.writes[1]).toMatchObject({ ...saved, lang: 'te', defaultAccount: 'sbi' });
  });

  it('a brand-new account (no settings yet) still becomes ready', async () => {
    await deliver({});
    await act(async () => { await api.patchSettings({ lang: 'hi' }); });
    expect(fs.writes).toEqual([{ lang: 'hi' }]);
  });
});

describe('editing an entry', () => {
  it('fields the edit took away are removed in the database, not left behind', async () => {
    fs.updates = [];
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Probe />); });
    const stored = { id: 'e1', type: 'expense', name: 'Tea', amount: 20, currency: 'INR', paidWith: 'cash', accountId: 'cash', category: 'food', date: '2026-11-21T06:30:00.000Z' };
    await act(async () => { fs.onData({ transactions: [stored], income: [], settings: {}, source: 'settings' }); });
    const { paidWith: _p, ...rest } = stored;
    await act(async () => { await api.updateTransaction({ ...rest, accountId: 'sbi' }); });
    expect(fs.updates[0].removed).toEqual(['paidWith']);
    expect(droppedKeys({ a: 1, b: 2 }, { a: 1, b: undefined })).toEqual(['b']);
    expect(droppedKeys(null, { a: 1 })).toEqual([]);
  });
});
