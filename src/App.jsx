import { useState, useCallback } from 'react';
import { Home, List, Wallet, BarChart2, Settings } from 'lucide-react';
import { loadState, saveState, clearState } from './utils/storage';
import TodayTab    from './tabs/TodayTab';
import HistoryTab  from './tabs/HistoryTab';
import IncomeTab   from './tabs/IncomeTab';
import StatsTab    from './tabs/StatsTab';
import SettingsTab from './tabs/SettingsTab';
import LockScreen  from './components/LockScreen';

const TABS = [
  { key: 'today',    label: 'Today',    Icon: Home      },
  { key: 'history',  label: 'History',  Icon: List      },
  { key: 'income',   label: 'Income',   Icon: Wallet    },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2 },
  { key: 'settings', label: 'Settings', Icon: Settings  },
];

function useAppState() {
  const [state, setState] = useState(() => loadState());
  const persist = useCallback((next) => { setState(next); saveState(next); }, []);
  return [state, persist];
}

export default function App() {
  const [appState, persist] = useAppState();
  const [activeTab, setActiveTab] = useState('today');
  const [locked, setLocked] = useState(() => !!loadState().settings.password);

  const { transactions, income, settings } = appState;

  const addTransaction = useCallback((txn) => {
    persist({ ...appState, transactions: [...appState.transactions, txn] });
  }, [appState, persist]);

  const updateTransaction = useCallback((updated) => {
    persist({ ...appState, transactions: appState.transactions.map(t => t.id === updated.id ? updated : t) });
  }, [appState, persist]);

  const addIncome = useCallback((entry) => {
    persist({ ...appState, income: [...appState.income, entry] });
  }, [appState, persist]);

  const handleDataChange = useCallback(({ transactions, income }) => {
    persist({ ...appState, transactions, income });
  }, [appState, persist]);

  const handleLockChange = useCallback((newSettings) => {
    const next = { ...appState, settings: { ...appState.settings, ...newSettings } };
    persist(next);
    if (!newSettings.password) setLocked(false);
  }, [appState, persist]);

  const handleUnlock = useCallback((password, cb) => {
    if (password === settings.password) { setLocked(false); cb(true); }
    else { cb(false); }
  }, [settings.password]);

  const handleWipe = useCallback(() => {
    clearState();
    persist({ transactions: [], income: [], settings: { password: null, failedAttempts: 0, locked: false } });
    setLocked(false);
  }, [persist]);

  if (locked && settings.password) {
    return <LockScreen onUnlock={handleUnlock} onWipe={handleWipe} />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'today'    && <TodayTab    transactions={transactions} onAdd={addTransaction} />}
        {activeTab === 'history'  && <HistoryTab  transactions={transactions} onUpdateTransaction={updateTransaction} />}
        {activeTab === 'income'   && <IncomeTab   income={income} onAddIncome={addIncome} />}
        {activeTab === 'stats'    && <StatsTab    transactions={transactions} income={income} />}
        {activeTab === 'settings' && <SettingsTab onDataChange={handleDataChange} onLockChange={handleLockChange} settings={settings} />}
      </div>

      {/* Bottom Navigation */}
      <nav
        className="shrink-0 flex items-stretch"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -1px 0 0 var(--border)',
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          const activeColor = key === 'income' ? 'var(--income)'
            : key === 'stats'    ? 'var(--savings)'
            : key === 'settings' ? 'var(--text-secondary)'
            : key === 'history'  ? 'var(--person)'
            : 'var(--expense)';

          return (
            <button
              key={key}
              id={`tab-${key}`}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative"
              style={{ color: isActive ? activeColor : 'var(--text-muted)' }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: activeColor }} />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
