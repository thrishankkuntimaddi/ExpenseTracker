import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { useRecurring } from '../hooks/useRecurring';
import { useDevices } from '../hooks/useDevices';
import { useSyncStatus, clearSyncError } from '../services/sync';
import { setStatusBarTheme, onBackButton } from '../native';
import { overlayOpen } from '../hooks/useEscape';
import { initReminders, onReminderTap, updateReminderInput } from '../native/reminders';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getDefaultPeriod } from '../utils/periodHelpers';
import { formatAmount } from '../utils/dateHelpers';
import { clearLegacyDataCache } from '../utils/storage';
import { learnCategoryRule } from '../utils/categories';
import { useTheme, HAD_LOCAL_THEME_CHOICE } from '../utils/theme';
import AuthGate from '../features/auth/AuthGate';
import TodayTab         from '../features/transactions/TodayTab';
// Everything past the first screen loads on demand — keeps the startup
// bundle small (charts and the desktop dashboard are the heavy parts).
// If a chunk can't load (a tab left open across a deploy), reload once to
// pick up the current build instead of rendering a blank page.
const RELOAD_KEY = 'et_chunk_reload';
const lazyPage = (load) => lazy(() => load().then((m) => {
  try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage unavailable */ }
  return m;
}, (err) => {
  let reloaded = true;
  try { reloaded = sessionStorage.getItem(RELOAD_KEY) === '1'; sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* storage unavailable */ }
  if (!reloaded) { window.location.reload(); return new Promise(() => {}); }
  throw err;
}));
const HistoryTab       = lazyPage(() => import('../features/transactions/HistoryTab'));
const IncomeTab        = lazyPage(() => import('../features/income/IncomeTab'));
const StatsTab         = lazyPage(() => import('../features/stats/StatsTab'));
const PlanTab          = lazyPage(() => import('../features/plan/PlanTab'));
const ExternalTab      = lazyPage(() => import('../features/external/ExternalTab'));
const ProfilePage      = lazyPage(() => import('../features/profile/ProfilePage'));
const PersonsPanel     = lazyPage(() => import('../features/persons/PersonsPanel'));
const DesktopDashboard = lazyPage(() => import('../components/DesktopDashboard'));
const AddSheet         = lazyPage(() => import('../components/AddSheet'));
import UpdateBanner from '../components/UpdateBanner';
import { ShellContext } from './shellContext';
import { PAGE_META, PAGE_COLOR } from './pages';
import { normaliseUi } from '../utils/uiPrefs';

/* Mobile navigation, PhonePe / GPay style:
   • bottom bar: Home · two pages · "+" (add anything) · one page — the three
     pages are chosen in Profile → Customize; swiping moves between them
   • every other page is a tile on Home (and opens with a back arrow)
   • Profile & settings: the avatar at the top of every page */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isDesktop;
}

// Older versions kept a plaintext copy of all data in localStorage — remove it.
clearLegacyDataCache();

/* ── Inner app rendered when user is authenticated ── */
function AuthenticatedApp({ user, signOut, deleteAccount, resetPassword, resendVerification }) {
  const [chosenTab, setActiveTab]           = useState(null);     // null until the user moves: show the start page
  const [backStack, setBackStack]           = useState([]);       // pages opened from tiles / the avatar return here
  const [slideDir, setSlideDir]             = useState(null);   // 'left' | 'right' | null — page transition
  const [addKind, setAddKind]               = useState(null);   // the "+" sheet: null | 'expense' | 'income' | 'person' | 'savings'
  const [pageOpts, setPageOpts]             = useState({});     // deep link into a page: { anchor, focus, mode, openGroup }
  const [toastMsg, setToastMsg]             = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getDefaultPeriod());
  const isDesktop = useIsDesktop();
  const { isStandalone, canInstallNative, triggerInstall } = usePWAInstall();

  const {
    transactions, income, settings, recentlyDeleted, loaded,
    writeError, clearWriteError, reportError,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    patchSettings,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  } = useFirestoreData(user.uid, user.email);

  // Phone layout chosen in Profile → Customize (repaired if malformed)
  const ui = useMemo(() => normaliseUi(settings?.ui), [settings?.ui]);
  const barTabs = ui.tabs;
  const pageOrder = useMemo(() => ['today', ...barTabs], [barTabs]);

  // Until the user moves, the app shows the start page chosen in Customize
  const activeTab = chosenTab ?? ui.start;

  // "Your devices" (presence heartbeat while the app is open)
  const devices = useDevices(user.uid);

  // Recurring rules (rent, SIP, salary …) + what is due right now
  const recurring = useRecurring({ uid: user.uid, transactions, income, loaded, addTransaction, addIncome, reportError });

  /** Remember a category override so the next identical name is auto-tagged. */
  const learnCategory = useCallback((name, category) => {
    const current = settings?.categoryRules ?? {};
    const next = learnCategoryRule(current, name, category);
    if (next !== current) patchSettings({ categoryRules: next });
  }, [settings?.categoryRules, patchSettings]);

  // Write failures, or a live listener stopped by the server (e.g. permission-denied)
  const sync = useSyncStatus();
  const bannerMessage = writeError || (sync.error?.kind === 'listen' ? sync.error.message : null);
  const dismissBanner = () => { clearWriteError(); clearSyncError(); };

  const errorBanner = bannerMessage && (
    <div role="alert" style={{
      position: 'fixed', left: 16, right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      zIndex: 1000, maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10, background: '#B91C1C', color: '#fff',
      fontSize: 12, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <span style={{ flex: 1 }}>{bannerMessage}</span>
      <button onClick={dismissBanner} aria-label="Dismiss"
        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
  );

  // Theme is per device. A device that never stored one adopts the theme
  // this account used to sync (settings.theme, written by older versions).
  const { pref: themePref, theme, setPref: setThemePref } = useTheme();
  const adoptedTheme = useRef(HAD_LOCAL_THEME_CHOICE);
  useEffect(() => {
    if (adoptedTheme.current || !settings?.theme) return;
    adoptedTheme.current = true;
    setThemePref(settings.theme === 'monoflow' ? 'dark' : 'light');
  }, [settings?.theme, setThemePref]);

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

  /**
   * Switch page with a directional slide. `arg` is a slide direction
   * ('left' | 'right', from swipes) or deep-link options
   * { anchor, focus, mode, openGroup } from Home tiles.
   */
  const goTo = useCallback((key, arg) => {
    if (key === 'settings') key = 'profile';   // older links / reminder routes
    const opts = typeof arg === 'object' && arg ? { ...arg } : {};
    if (opts.openGroup && !opts.anchor) opts.anchor = `group-${opts.openGroup}`;
    const dir = typeof arg === 'string' ? arg : null;
    if (opts.openGroup) { try { localStorage.setItem(`et_settings_open_${opts.openGroup}`, '1'); } catch { /* storage unavailable */ } }
    setPageOpts({ ...opts, at: Date.now() });
    if (key === activeTab && !opts.mode) return;
    const inBar = pageOrder.includes(key);
    setBackStack((st) => (inBar ? [] : [...st, activeTab]));
    setSlideDir(dir ?? (inBar && pageOrder.includes(activeTab) && pageOrder.indexOf(key) < pageOrder.indexOf(activeTab) ? 'right' : 'left'));
    setActiveTab(key);
  }, [activeTab, pageOrder]);
  const goBack = useCallback(() => {
    const prev = backStack[backStack.length - 1] ?? ui.start;
    setBackStack((st) => st.slice(0, -1));
    setSlideDir('right');
    setPageOpts({});
    setActiveTab(prev);
  }, [backStack, ui.start]);

  // Deep links: once the page has rendered, scroll to / focus its target.
  // Pages load lazily, so look for the element for up to ~2 s.
  useEffect(() => {
    const target = pageOpts.anchor || pageOpts.focus;
    if (!target) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(target);
      if (el || ++tries > 20) {
        clearInterval(timer);
        if (pageOpts.anchor) el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (pageOpts.focus) el?.focus();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pageOpts, activeTab]);

  // Short confirmation pill above the bar ("Added Chai · ₹20")
  useEffect(() => {
    if (!toastMsg) return undefined;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);
  // Android: status bar follows the theme; hardware back closes the top
  // dialog, then returns to Expenses, then backgrounds the app.
  useEffect(() => { setStatusBarTheme(theme); }, [theme]);
  useEffect(() => onBackButton(() => {
    if (overlayOpen()) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return true; }
    if (backStack.length || !pageOrder.includes(activeTab)) { goBack(); return true; }
    if (activeTab !== ui.start) { goTo(ui.start, 'right'); return true; }
    return false;
  }), [activeTab, goTo, goBack, backStack, pageOrder, ui.start]);

  // Reminders: re-plan whenever their settings or the data they read change
  // (debounced — a burst of edits re-plans once).
  useEffect(() => { initReminders(); }, []);
  useEffect(() => {
    onReminderTap((route) => { if (['today', 'plan', 'stats', 'history'].includes(route)) goTo(route); });
  }, [goTo]);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(() => updateReminderInput({
      cfg: settings?.reminders,
      data: { transactions, income, recurring: recurring.rules, budgets: settings?.budgets, categoryRules: settings?.categoryRules },
    }), 800);
    return () => clearTimeout(t);
  }, [loaded, settings?.reminders, settings?.budgets, settings?.categoryRules, transactions, income, recurring.rules]);

  const swipe = useSwipeNavigation({ order: pageOrder, active: activeTab, onChange: goTo, enabled: !isDesktop && !addKind && pageOrder.includes(activeTab) });

  const commonProps = {
    transactions, income, settings, recentlyDeleted,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
    isStandalone, canInstallNative, onTriggerInstall: triggerInstall,
    selectedPeriod, onPeriodChange: setSelectedPeriod,
    theme, themePref, onThemePrefChange: setThemePref, user, devices,
    recurring, onPatchSettings: patchSettings, onLearnCategory: learnCategory, reportError,
  };

  /* ── DESKTOP ── */
  if (isDesktop) {
    return (
      <div style={{ width: '100%', minHeight: '100%', overflow: 'auto', background: 'var(--bg)' }}>
        <Suspense fallback={null}>
        <DesktopDashboard
          {...commonProps}
          onAddTransaction={addTransaction}
          onUpdateTransaction={updateTransaction}
          onDeleteTransaction={deleteTransaction}
          onAddIncome={addIncome}
          onUpdateIncome={updateIncome}
          onDeleteIncome={deleteIncome}
          onSignOut={signOut}
          onDeleteAccount={deleteAccount}
          onResetPassword={resetPassword}
          onResendVerification={resendVerification}
          onSmartAdd={smartAddEntry}
        />
        </Suspense>
        {errorBanner}
      </div>
    );
  }

  /* ── MOBILE ── */
  const tabColors = PAGE_COLOR[theme === 'monoflow' ? 'dark' : 'light'];
  const dueCount = recurring.manualDue.length;
  const shell = {
    user, goTo, back: goBack,
    showBack: !pageOrder.includes(activeTab) && activeTab !== 'profile',
    openProfile: () => goTo('profile'),
    openAdd: (kind = 'expense') => setAddKind(kind),
    toast: setToastMsg,
    attention: sync.error != null,
  };
  // Bar: Home · slot 1 · "+" · slot 2 · slot 3
  const barItems = [
    { key: 'today', ...PAGE_META.today },
    { key: barTabs[0], ...PAGE_META[barTabs[0]] },
    { key: 'add' },
    { key: barTabs[1], ...PAGE_META[barTabs[1]] },
    { key: barTabs[2], ...PAGE_META[barTabs[2]] },
  ];

  return (
    <ShellContext.Provider value={shell}>
    <div className="mobile-shell" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div
        {...swipe}
        key={activeTab}
        className={`mobile-page${slideDir === 'left' ? ' page-slide-left' : slideDir === 'right' ? ' page-slide-right' : ''}`}
        style={{ flex: 1, overflow: 'auto' }}
      >
        <Suspense fallback={null}>
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
            key={pageOpts.mode ?? 'billings'}
            initialMode={pageOpts.mode}
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
            reportError={reportError}
          />
        )}
        {activeTab === 'people' && (
          <div className="mobile-people-host" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <PersonsPanel
              transactions={transactions}
              onAddTransaction={addTransaction}
              onUpdateTransaction={updateTransaction}
              onDeleteTransaction={deleteTransaction}
            />
          </div>
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
        {activeTab === 'profile' && (
          <ProfilePage
            {...commonProps}
            onBack={goBack}
            onSignOut={signOut}
            onDeleteAccount={deleteAccount}
            onResetPassword={resetPassword}
            onResendVerification={resendVerification}
          />
        )}
        </Suspense>
      </div>

      {errorBanner}

      {addKind && (
        <Suspense fallback={null}>
          <AddSheet
            {...commonProps}
            initialKind={addKind}
            onAdd={smartAddEntry}
            onAddIncome={addIncome}
            onClose={() => setAddKind(null)}
            onSaved={(e) => setToastMsg(`Added ${e.name} · ${formatAmount(e.amount)}`)}
          />
        </Suspense>
      )}

      {toastMsg && (
        <div role="status" className="app-toast" key={toastMsg} style={{
          position: 'fixed', left: 16, right: 16, bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', zIndex: 950,
          maxWidth: 420, margin: '0 auto', padding: '11px 16px', borderRadius: 16, textAlign: 'center',
          fontSize: 13, fontWeight: 600, color: 'var(--toast-text, #fff)', background: 'var(--toast-bg, rgba(28,28,32,.92))',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,.45)', animation: 'toastIn .22s cubic-bezier(0.16,1,0.3,1)',
        }}>{toastMsg}</div>
      )}

      {/* ── Bottom bar: Home · 2 pages · + · 1 page ── */}
      <nav style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {barItems.map(({ key, label, Icon }) => {
          if (key === 'add') {
            return (
              <button key="add" id="tab-add" className="nav-add" aria-label="Add an entry" onClick={() => setAddKind('expense')}
                style={{ flex: '0 0 auto', width: 50, height: 50, margin: '0 6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'var(--accent)' }}>
                <Plus size={24} strokeWidth={2.4} />
              </button>
            );
          }
          const isActive = activeTab === key;
          const color    = tabColors[key];
          return (
            <button
              key={key}
              id={`tab-${key}`}
              onClick={() => goTo(key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 2px', gap: 3, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: isActive ? color : 'var(--text-muted)', position: 'relative',
              }}
            >
              <Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />
              {key === 'plan' && dueCount > 0 && (
                <span aria-label={`${dueCount} recurring entries due`} style={{
                  position: 'absolute', top: 4, left: 'calc(50% + 6px)',
                  minWidth: 14, height: 14, padding: '0 3px', borderRadius: 99,
                  background: 'var(--expense)', color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>{dueCount > 9 ? '9+' : dueCount}</span>
              )}
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.01em' }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
    </ShellContext.Provider>
  );
}

/* ── Root App — wraps everything in AuthGate ── */
export default function App() {
  return (
    <>
    <UpdateBanner />
    <AuthGate>
      {(auth) => <AuthenticatedApp {...auth} />}
    </AuthGate>
    </>
  );
}
