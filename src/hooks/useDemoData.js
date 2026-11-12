// ─── useDemoData ─────────────────────────────────────────────────
// The same shape as useFirestoreData, kept in memory for the demo: sample
// entries to start with, every change applied locally, nothing sent anywhere.
// `enabled` is fixed for the app's lifetime (the demo flag doesn't change
// without a reload), so both hooks can be called unconditionally.
import { useCallback, useState } from 'react';
import { demoSeed } from '../demo/demo';
import { stamp } from './useFirestoreData';
import { DEFAULT_CURRENCY, isCurrency, setDisplayCurrency } from '../utils/money';
import { unviewEntry } from '../utils/fx';

export function useDemoData(enabled) {
  const [seed] = useState(() => (enabled ? demoSeed() : { transactions: [], income: [], settings: {}, rules: [] }));
  const [transactions, setTransactions] = useState(seed.transactions);
  const [income, setIncome] = useState(seed.income);
  const [settings, setSettings] = useState(seed.settings);
  const display = isCurrency(settings?.currency) ? settings.currency : DEFAULT_CURRENCY;
  if (enabled) setDisplayCurrency(display);

  const addTransaction = useCallback(async (e) => { setTransactions((p) => [...p, stamp(e, display)]); return true; }, [display]);
  const updateTransaction = useCallback(async (e) => { const u = unviewEntry(e, display); setTransactions((p) => p.map((t) => (t.id === u.id ? u : t))); return true; }, [display]);
  const deleteTransaction = useCallback(async (id) => { setTransactions((p) => p.filter((t) => t.id !== id)); return true; }, []);
  const addIncome = useCallback(async (e) => { setIncome((p) => [...p, stamp(e, display)]); return true; }, [display]);
  const updateIncome = useCallback(async (e) => { const u = unviewEntry(e, display); setIncome((p) => p.map((i) => (i.id === u.id ? u : i))); return true; }, [display]);
  const deleteIncome = useCallback(async (id) => { setIncome((p) => p.filter((i) => i.id !== id)); return true; }, []);
  const saveSettings = useCallback(async (s) => { setSettings(s); return true; }, []);
  const patchSettings = useCallback(async (patch) => { setSettings((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev ?? {}) : patch) })); return true; }, []);
  const noop = useCallback(async () => true, []);
  const reportError = useCallback((action, err) => console.warn(`[demo] ${action}`, err), []);

  return {
    transactions, income, settings, recentlyDeleted: [], loaded: enabled, currency: display,
    writeError: null, clearWriteError: noop, reportError,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    saveSettings, patchSettings,
    restoreDeletedItem: noop, permanentlyDeleteRecentlyDeletedItem: noop, emptyTrash: noop,
    demoRules: seed.rules,
  };
}
