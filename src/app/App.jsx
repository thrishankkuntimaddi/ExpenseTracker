import { useState, useCallback, useEffect } from 'react';
import { Home, List, Wallet, BarChart2, Settings, ReceiptText, Users } from 'lucide-react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { getDefaultPeriod } from '../utils/periodHelpers';
import AuthGate from '../features/auth/AuthGate';
import TodayTab         from '../features/transactions/TodayTab';
import HistoryTab       from '../features/transactions/HistoryTab';
import IncomeTab        from '../features/income/IncomeTab';
import StatsTab         from '../features/stats/StatsTab';
import SettingsTab      from '../features/settings/SettingsTab';
import ExternalTab      from '../features/external/ExternalTab';
import PersonsPanel     from '../features/persons/PersonsPanel';
import DesktopDashboard from '../components/DesktopDashboard';

const TABS = [
  { key: 'today',    label: 'Expenses', Icon: Home        },
  { key: 'history',  label: 'History',  Icon: List        },
  { key: 'income',   label: 'Income',   Icon: Wallet      },
  { key: 'external', label: 'Billings', Icon: ReceiptText },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2   },
  { key: 'settings', label: 'Settings', Icon: Settings    },
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

const THEME_KEY = 'et_theme';

function applyTheme(theme) {
  const t = theme || 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch {}
}

// Apply cached theme IMMEDIATELY on module load — before React even mounts.
try {
  const cached = localStorage.getItem(THEME_KEY);
  if (cached) document.documentElement.setAttribute('data-theme', cached);
} catch {}

/* ── Inner app rendered when user is authenticated ── */
function AuthenticatedApp({ user, signOut }) {
  const [activeTab, setActiveTab]           = useState('today');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getDefaultPeriod());
  const isDesktop = useIsDesktop();

  const {
    transactions, income, settings, recentlyDeleted,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    saveSettings, handleDataChange,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  } = useFirestoreData(user.uid);

  const theme = settings?.theme || 'light';

  useEffect(() => { applyTheme(theme); }, [theme]);

  const handleThemeChange = useCallback((newTheme) => {
    saveSettings({ ...settings, theme: newTheme });
    applyTheme(newTheme);
  }, [settings, saveSettings]);

  /**
   * smartAddEntry — routes entries to the right store.
   *
   *  person/repayment  → income  (someone returned money I lent = cash inflow ✅)
   *  everything else   → transactions
   */
  const smartAddEntry = useCallback((entry) => {
    if (entry.type === 'person' && entry.direction === 'repayment') {
      // Treat as income: money came back to me
      addIncome({
        id: entry.id,
        date: entry.date,
        month: entry.month,
        name: entry.name,
        amount: entry.amount,
        isRepaymentRec: true,  // flag: this is money returned by someone I lent to
      });
    } else {
      addTransaction(entry);
    }
  }, [addTransaction, addIncome]);

  const commonProps = {
    transactions, income, settings, recentlyDeleted,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
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
          onUpdateIncome={updateIncome}
          onDeleteIncome={deleteIncome}
          onDataChange={handleDataChange}
          onThemeChange={handleThemeChange}
          onSignOut={signOut}
          onSmartAdd={smartAddEntry}
        />
      </div>
    );
  }

  /* ── MOBILE ── */
  const isMonoflow = theme === 'monoflow';
  const tabColors = isMonoflow
    ? { today: '#b8956a', history: '#c9a87c', income: '#5aba8a', external: '#7c3aed', stats: '#6b8dd6', settings: '#9ca3af' }
    : { today: '#E11D48', history: '#D97706', income: '#059669', external: '#4F46E5', stats: '#2563EB', settings: '#6366F1' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'today' && (
          <TodayTab
            {...commonProps}
            onAdd={smartAddEntry}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            {...commonProps}
            onUpdateTransaction={updateTransaction}
            onDeleteTransaction={deleteTransaction}
            onAddTransaction={addTransaction}
            onAddIncome={addIncome}
          />
        )}
        {activeTab === 'income' && (
          <IncomeTab
            {...commonProps}
            onAddIncome={addIncome}
            onUpdateIncome={updateIncome}
            onDeleteIncome={deleteIncome}
            onAddTransaction={addTransaction}
            onDeleteTransaction={deleteTransaction}
          />
        )}
        {activeTab === 'external' && (
          <ExternalTab
            user={user}
            transactions={transactions}
            income={income}
            onAddIncome={addIncome}
            onUpdateIncome={updateIncome}
            onDeleteIncome={deleteIncome}
            onAddTransaction={addTransaction}
            onUpdateTransaction={updateTransaction}
            onDeleteTransaction={deleteTransaction}
            selectedPeriod={selectedPeriod}
            theme={theme}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            {...commonProps}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            {...commonProps}
            onDataChange={handleDataChange}
            onThemeChange={handleThemeChange}
            onSignOut={signOut}
            addTransaction={addTransaction}
            addIncome={addIncome}
          />
        )}
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
                padding: '8px 2px', gap: 3, border: 'none',
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
              <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, letterSpacing: '0.01em' }}>
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
