import { useState, useCallback, useEffect } from 'react';
import { Home, List, Wallet, BarChart2, Settings, ReceiptText, Target, LayoutGrid } from 'lucide-react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { useRecurring } from '../hooks/useRecurring';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getDefaultPeriod } from '../utils/periodHelpers';
import { clearLegacyDataCache } from '../utils/storage';
import { learnCategoryRule } from '../utils/categories';
import AuthGate from '../features/auth/AuthGate';
import TodayTab         from '../features/transactions/TodayTab';
import HistoryTab       from '../features/transactions/HistoryTab';
import IncomeTab        from '../features/income/IncomeTab';
import StatsTab         from '../features/stats/StatsTab';
import PlanTab          from '../features/plan/PlanTab';
import SettingsTab      from '../features/settings/SettingsTab';
import ExternalTab      from '../features/external/ExternalTab';
import DesktopDashboard from '../components/DesktopDashboard';
import MoreSheet from '../components/MoreSheet';

/* Mobile: five slots in the bar; the rest live behind "More".
   Swiping moves through PAGE_ORDER, so every page is one gesture away. */
const PRIMARY_TABS = [
  { key: 'today',    label: 'Expenses', Icon: Home      },
  { key: 'history',  label: 'History',  Icon: List      },
  { key: 'income',   label: 'Income',   Icon: Wallet    },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2 },
];
const MORE_PAGES = [
  { key: 'plan',     label: 'Plan',     Icon: Target,      description: 'Budget · recurring entries · savings goals' },
  { key: 'external', label: 'Billings', Icon: ReceiptText, description: 'Money spent on behalf of others, settled later' },
  { key: 'settings', label: 'Settings', Icon: Settings,    description: 'Theme, backups, import / export, account' },
];
const PAGE_ORDER = [...PRIMARY_TABS.map((t) => t.key), ...MORE_PAGES.map((p) => p.key)];

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
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ }
}

// Older versions kept a plaintext copy of all data in localStorage — remove it.
clearLegacyDataCache();

// Apply cached theme IMMEDIATELY on module load — before React even mounts.
try {
  const cached = localStorage.getItem(THEME_KEY);
  if (cached) document.documentElement.setAttribute('data-theme', cached);
} catch { /* storage unavailable — default theme */ }

/* ── Inner app rendered when user is authenticated ── */
function AuthenticatedApp({ user, signOut }) {
  const [activeTab, setActiveTab]           = useState('today');
  const [slideDir, setSlideDir]             = useState(null);   // 'left' | 'right' | null — page transition
  const [moreOpen, setMoreOpen]             = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getDefaultPeriod());
  const isDesktop = useIsDesktop();
  const { isStandalone, canInstallNative, triggerInstall } = usePWAInstall();

  const {
    transactions, income, settings, recentlyDeleted, loaded,
    writeError, clearWriteError, reportError,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    saveSettings, patchSettings,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  } = useFirestoreData(user.uid, user.email);

  // Recurring rules (rent, SIP, salary …) + what is due right now
  const recurring = useRecurring({ uid: user.uid, transactions, income, loaded, addTransaction, addIncome, reportError });

  /** Remember a category override so the next identical name is auto-tagged. */
  const learnCategory = useCallback((name, category) => {
    const current = settings?.categoryRules ?? {};
    const next = learnCategoryRule(current, name, category);
    if (next !== current) patchSettings({ categoryRules: next });
  }, [settings?.categoryRules, patchSettings]);

  const errorBanner = writeError && (
    <div role="alert" style={{
      position: 'fixed', left: 16, right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      zIndex: 1000, maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10, background: '#B91C1C', color: '#fff',
      fontSize: 12, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <span style={{ flex: 1 }}>{writeError}</span>
      <button onClick={clearWriteError} aria-label="Dismiss"
        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
  );

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

  /** Switch page with a directional slide; used by taps, the More sheet and swipes. */
  const goTo = useCallback((key, dir) => {
    if (key === activeTab) return;
    setSlideDir(dir ?? (PAGE_ORDER.indexOf(key) > PAGE_ORDER.indexOf(activeTab) ? 'left' : 'right'));
    setActiveTab(key);
  }, [activeTab]);
  const swipe = useSwipeNavigation({ order: PAGE_ORDER, active: activeTab, onChange: goTo, enabled: !isDesktop && !moreOpen });

  const commonProps = {
    transactions, income, settings, recentlyDeleted,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
    isStandalone, canInstallNative, onTriggerInstall: triggerInstall,
    selectedPeriod, onPeriodChange: setSelectedPeriod,
    theme, user,
    recurring, onPatchSettings: patchSettings, onLearnCategory: learnCategory,
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
          onThemeChange={handleThemeChange}
          onSignOut={signOut}
          onSmartAdd={smartAddEntry}
        />
        {errorBanner}
      </div>
    );
  }

  /* ── MOBILE ── */
  const isMonoflow = theme === 'monoflow';
  const tabColors = isMonoflow
    ? { today: '#b8956a', history: '#c9a87c', income: '#5aba8a', external: '#7c3aed', plan: '#22D3EE', stats: '#6b8dd6', settings: '#9ca3af' }
    : { today: '#E11D48', history: '#D97706', income: '#059669', external: '#4F46E5', plan: '#0891B2', stats: '#2563EB', settings: '#6366F1' };
  const dueCount = recurring.manualDue.length;
  const inMore = MORE_PAGES.some((p) => p.key === activeTab);
  const morePage = MORE_PAGES.find((p) => p.key === activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div
        {...swipe}
        key={activeTab}
        className={slideDir === 'left' ? 'page-slide-left' : slideDir === 'right' ? 'page-slide-right' : undefined}
        style={{ flex: 1, overflow: 'auto' }}
      >
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
        {activeTab === 'plan' && (
          <PlanTab
            {...commonProps}
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
            onThemeChange={handleThemeChange}
            onSignOut={signOut}
          />
        )}
      </div>

      {errorBanner}

      {moreOpen && (
        <MoreSheet
          pages={MORE_PAGES.map((p) => ({ ...p, color: tabColors[p.key], badge: p.key === 'plan' ? dueCount : 0 }))}
          active={activeTab}
          onSelect={(key) => { goTo(key); setMoreOpen(false); }}
          onClose={() => setMoreOpen(false)}
        />
      )}

      {/* ── Mobile Navbar: 4 pages + More ── */}
      <nav style={{ flexShrink: 0, display: 'flex', background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {[...PRIMARY_TABS, { key: 'more', label: inMore ? morePage.label : 'More', Icon: inMore ? morePage.Icon : LayoutGrid }].map(({ key, label, Icon }) => {
          const isMore   = key === 'more';
          const isActive = isMore ? inMore : activeTab === key;
          const color    = isMore ? (inMore ? tabColors[activeTab] : 'var(--accent)') : tabColors[key];
          return (
            <button
              key={key}
              id={`tab-${key}`}
              aria-haspopup={isMore ? 'dialog' : undefined}
              onClick={() => (isMore ? setMoreOpen(true) : goTo(key))}
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
              {isMore && dueCount > 0 && (
                <span aria-label={`${dueCount} recurring entries due`} style={{
                  position: 'absolute', top: 6, left: 'calc(50% + 6px)',
                  minWidth: 14, height: 14, padding: '0 3px', borderRadius: 99,
                  background: 'var(--expense)', color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>{dueCount > 9 ? '9+' : dueCount}</span>
              )}
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
