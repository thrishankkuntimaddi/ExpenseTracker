import { useState, useCallback, useEffect } from 'react';
import { Home, List, Wallet, BarChart2, Settings } from 'lucide-react';
import { loadState, saveState, clearState } from './utils/storage';
import TodayTab       from './tabs/TodayTab';
import HistoryTab     from './tabs/HistoryTab';
import IncomeTab      from './tabs/IncomeTab';
import StatsTab       from './tabs/StatsTab';
import SettingsTab    from './tabs/SettingsTab';
import LockScreen     from './components/LockScreen';
import DesktopDashboard from './components/DesktopDashboard';

/* ── Tabs config ────────────────────────────────────────────────── */
const TABS = [
  { key: 'today',    label: 'Today',    Icon: Home      },
  { key: 'history',  label: 'History',  Icon: List      },
  { key: 'income',   label: 'Income',   Icon: Wallet    },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2 },
  { key: 'settings', label: 'Settings', Icon: Settings  },
];

const TAB_COLORS = {
  today: '#DC2626', history: '#D97706', income: '#16A34A',
  stats: '#2563EB', settings: '#64748B',
};

/* ── App state hook ─────────────────────────────────────────────── */
function useAppState() {
  const [state, setState] = useState(() => loadState());
  const persist = useCallback((next) => { setState(next); saveState(next); }, []);
  return [state, persist];
}

/* ── Window size hook ───────────────────────────────────────────── */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

/* ── Root component ─────────────────────────────────────────────── */
export default function App() {
  const [appState, persist] = useAppState();
  const [activeTab, setActiveTab] = useState('today');
  const [locked, setLocked] = useState(() => !!loadState().settings.password);
  const isDesktop = useIsDesktop();

  const { transactions, income, settings } = appState;

  /* ── Callbacks ── */
  const addTransaction = useCallback((txn) =>
    persist({ ...appState, transactions: [...appState.transactions, txn] }),
    [appState, persist]);

  const updateTransaction = useCallback((updated) =>
    persist({ ...appState, transactions: appState.transactions.map(t => t.id === updated.id ? updated : t) }),
    [appState, persist]);

  const addIncome = useCallback((entry) =>
    persist({ ...appState, income: [...appState.income, entry] }),
    [appState, persist]);

  const handleDataChange = useCallback(({ transactions, income }) =>
    persist({ ...appState, transactions, income }),
    [appState, persist]);

  const handleLockChange = useCallback((s) => {
    const next = { ...appState, settings: { ...appState.settings, ...s } };
    persist(next);
    if (!s.password) setLocked(false);
  }, [appState, persist]);

  const handleUnlock = useCallback((pw, cb) => {
    if (pw === settings.password) { setLocked(false); cb(true); } else cb(false);
  }, [settings.password]);

  const handleWipe = useCallback(() => {
    clearState();
    persist({ transactions: [], income: [], settings: { password: null, failedAttempts: 0, locked: false } });
    setLocked(false);
  }, [persist]);

  /* ── Lock screen (both modes) ── */
  if (locked && settings.password) {
    return <LockScreen onUnlock={handleUnlock} onWipe={handleWipe} />;
  }

  /* ══════════════════════════════════════════════════════════
      DESKTOP — Command Center Dashboard
  ══════════════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#F8FAFC' }}>
        <DesktopDashboard
          transactions={transactions}
          income={income}
          settings={settings}
          onAddTransaction={addTransaction}
          onUpdateTransaction={updateTransaction}
          onAddIncome={addIncome}
          onDataChange={handleDataChange}
          onLockChange={handleLockChange}
        />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
      MOBILE — Tab-based layout (unchanged)
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'today'    && <TodayTab    transactions={transactions} onAdd={addTransaction} />}
        {activeTab === 'history'  && <HistoryTab  transactions={transactions} onUpdateTransaction={updateTransaction} />}
        {activeTab === 'income'   && <IncomeTab   income={income} onAddIncome={addIncome} />}
        {activeTab === 'stats'    && <StatsTab    transactions={transactions} income={income} />}
        {activeTab === 'settings' && <SettingsTab onDataChange={handleDataChange} onLockChange={handleLockChange} settings={settings} />}
      </div>

      {/* Bottom Navigation */}
      <nav style={{
        flexShrink: 0, display: 'flex', background: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          const color = TAB_COLORS[key];
          return (
            <button
              key={key}
              id={`tab-${key}`}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '10px 4px', gap: 3, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: isActive ? color : '#94A3B8',
                position: 'relative',
              }}
            >
              {isActive && (
                <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, borderRadius: 99, background: color }} />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
