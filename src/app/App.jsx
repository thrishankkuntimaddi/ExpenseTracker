import { useState, useCallback, useEffect } from 'react';
import { Home, List, Wallet, BarChart2, Settings } from 'lucide-react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { getDefaultPeriod } from '../utils/periodHelpers';
import AuthGate from '../features/auth/AuthGate';
import TodayTab         from '../features/transactions/TodayTab';
import HistoryTab       from '../features/transactions/HistoryTab';
import IncomeTab        from '../features/income/IncomeTab';
import StatsTab         from '../features/stats/StatsTab';
import SettingsTab      from '../features/settings/SettingsTab';
import DesktopDashboard from '../components/DesktopDashboard';

const TABS = [
  { key: 'today',    label: 'Today',    Icon: Home      },
  { key: 'history',  label: 'History',  Icon: List      },
  { key: 'income',   label: 'Income',   Icon: Wallet    },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2 },
  { key: 'settings', label: 'Settings', Icon: Settings  },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isDesktop;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'light');
}

/* ── Inner app rendered when user is authenticated ── */
function AuthenticatedApp({ user, signOut }) {
  const [activeTab, setActiveTab]           = useState('today');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getDefaultPeriod());
  const isDesktop = useIsDesktop();

  const {
    transactions, income, settings,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, deleteIncome,
    saveSettings, handleDataChange,
  } = useFirestoreData(user.uid);

  const theme = settings?.theme || 'light';

  useEffect(() => { applyTheme(theme); }, [theme]);

  const handleThemeChange = useCallback((newTheme) => {
    saveSettings({ ...settings, theme: newTheme });
    applyTheme(newTheme);
  }, [settings, saveSettings]);

  const handleLockChange = useCallback((s) => {
    saveSettings({ ...settings, ...s });
  }, [settings, saveSettings]);

  const commonProps = {
    transactions, income, settings,
    selectedPeriod, onPeriodChange: setSelectedPeriod,
    theme, user,
  };

  /* ── DESKTOP ── */
  if (isDesktop) {
    return (
      <div style={{ width: '100%', minHeight: '100%', overflow: 'auto', background: 'var(--bg)' }}>
        <DesktopDashboard
          {...commonProps}
          onAddTransaction={addTransaction}
          onUpdateTransaction={updateTransaction}
          onDeleteTransaction={deleteTransaction}
          onAddIncome={addIncome}
          onDeleteIncome={deleteIncome}
          onDataChange={handleDataChange}
          onLockChange={handleLockChange}
          onThemeChange={handleThemeChange}
          onSignOut={signOut}
        />
      </div>
    );
  }

  /* ── MOBILE ── */
  const isMonoflow = theme === 'monoflow';
  const tabColors = isMonoflow
    ? { today: '#b8956a', history: '#c9a87c', income: '#5aba8a', stats: '#6b8dd6', settings: '#9ca3af' }
    : { today: '#DC2626', history: '#D97706', income: '#16A34A', stats: '#2563EB', settings: '#6366F1' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'today'    && <TodayTab    {...commonProps} onAdd={addTransaction} />}
        {activeTab === 'history'  && <HistoryTab  {...commonProps} onUpdateTransaction={updateTransaction} onDeleteTransaction={deleteTransaction} />}
        {activeTab === 'income'   && <IncomeTab   {...commonProps} onAddIncome={addIncome} onDeleteIncome={deleteIncome} />}
        {activeTab === 'stats'    && <StatsTab    {...commonProps} />}
        {activeTab === 'settings' && <SettingsTab {...commonProps} onDataChange={handleDataChange} onLockChange={handleLockChange} onThemeChange={handleThemeChange} onSignOut={signOut} />}
      </div>

      {/* ── Mobile Navbar ── */}
      <nav style={{ flexShrink: 0, display: 'flex', background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          const color    = tabColors[key];
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
                color: isActive ? color : 'var(--text-muted)', position: 'relative',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2, borderRadius: 99, background: color,
                }} />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Root App — wraps everything in AuthGate ── */
export default function App() {
  return (
    <AuthGate>
      {({ user, signOut }) => <AuthenticatedApp user={user} signOut={signOut} />}
    </AuthGate>
  );
}
