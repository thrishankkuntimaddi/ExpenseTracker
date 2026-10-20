import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { useRecurring } from '../hooks/useRecurring';
import { useDevices } from '../hooks/useDevices';
import { useDriveBackup } from '../hooks/useDriveBackup';
import { useSyncStatus, clearSyncError } from '../services/sync';
import { setStatusBarTheme, onBackButton } from '../native';
import { overlayOpen } from '../hooks/useEscape';
import { initReminders, onReminderTap, updateReminderInput, setPushUser, deviceDelivery } from '../native/reminders';
import { registerPush } from '../native/push';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getDefaultPeriod, getCurrentMonthValue } from '../utils/periodHelpers';
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
  if (!reloaded) { markQuickBoot(); window.location.reload(); return new Promise(() => {}); }
  throw err;
}));
const HistoryTab       = lazyPage(() => import('../features/transactions/HistoryTab'));
const IncomeTab        = lazyPage(() => import('../features/income/IncomeTab'));
const StatsTab         = lazyPage(() => import('../features/stats/StatsTab'));
const BillsPage        = lazyPage(() => import('../features/bills/BillsPage'));
const BudgetPage       = lazyPage(() => import('../features/budget/BudgetPage'));
const SavingsPage      = lazyPage(() => import('../features/savings/SavingsPage'));
const ExternalTab      = lazyPage(() => import('../features/external/ExternalTab'));
const ProfilePage      = lazyPage(() => import('../features/profile/ProfilePage'));
const DebtsPage        = lazyPage(() => import('../features/debts/DebtsPage'));
const AddSheet         = lazyPage(() => import('../components/AddSheet'));
import UpdateBanner from '../components/UpdateBanner';
import { ShellContext } from './shellContext';
import { markAppReady } from './ready';
import { PAGE_META, PAGE_COLOR, DESKTOP_NAV } from './pages';
import Avatar from '../components/Avatar';
import { displayNameOf } from './shellContext';
import { normaliseUi } from '../utils/uiPrefs';
import { flyCoin } from '../motion/motion';
import Sign from '../motion/Sign';
import { useAppLock, AppLockContext } from '../security/useAppLock';
import LockScreen from '../security/LockScreen';
import SecurityBanners from '../security/SecurityBanners';
import { useSecurityEvents } from '../security/events';
import { pendingInvite } from '../features/trips/invite';
import { markQuickBoot } from './quickBoot';
import TourHost from '../tour/TourHost';
import { startTour, tourSeen, markTourSeen } from '../tour/tour';

/* One app on every screen — the same pages, the same headers:
   • phone: bottom bar Home · page · "+" · page · page (chosen in Profile →
     Customize); every other page is a card in Home → Explore and opens with
     a back arrow; swiping moves between bar pages
   • desktop, tablet, web (≥768px wide and ≥600px tall — a phone turned
     sideways stays a phone): a sidebar with every page; Home has the Add form
   • the avatar opens Profile & settings
   • one month for the whole app: change it on any page (or in the Stats
     calendar) and every page follows; "Now" returns to this month */

function useIsDesktop() {
  const wide = () => window.innerWidth >= 1024 || (window.innerWidth >= 768 && window.innerHeight >= 600);
  const [isDesktop, setIsDesktop] = useState(wide);
  useEffect(() => {
    const h = () => setIsDesktop(wide());
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
  const [addKind, setAddKind]               = useState(null);   // the "+" sheet: null | { kind: 'expense' | 'income' | 'debt' | 'savings', …options }
  const [pageOpts, setPageOpts]             = useState({});     // deep link into a page: { anchor, focus, mode, openGroup }
  const [toastMsg, setToastMsg]             = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getDefaultPeriod());
  const isDesktop = useIsDesktop();
  // The month every page shows
  const viewMonth = selectedPeriod.type === 'current_month' || selectedPeriod.type === 'select_month' ? selectedPeriod.value : getCurrentMonthValue();
  const setViewMonth = useCallback((key) => {
    setSelectedPeriod({ type: key === getCurrentMonthValue() ? 'current_month' : 'select_month', value: key });
  }, []);
  const { isStandalone, canInstallNative, triggerInstall } = usePWAInstall();

  const {
    transactions, income, settings, recentlyDeleted, loaded,
    writeError, clearWriteError, reportError,
    addTransaction, updateTransaction, deleteTransaction,
    addIncome, updateIncome, deleteIncome,
    patchSettings,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  } = useFirestoreData(user.uid, user.email);

  // Your data has arrived (from the device cache or the server): end the splash
  useEffect(() => { if (loaded) markAppReady(); }, [loaded]);

  // Phone layout chosen in Profile → Customize (repaired if malformed)
  const ui = useMemo(() => normaliseUi(settings?.ui), [settings?.ui]);
  const barTabs = ui.tabs;
  const pageOrder = useMemo(() => ['today', ...barTabs], [barTabs]);

  // Until the user moves, the app shows the start page chosen in Customize
  const activeTab = chosenTab ?? ui.start;

  // "Your devices" (presence heartbeat while the app is open) and security alerts
  const devices = useDevices(user.uid);
  const securityEvents = useSecurityEvents(user.uid);
  // Google Drive backups on the schedule picked in Profile
  const drive = useDriveBackup({ uid: user.uid, email: user.email, settings, loaded });

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
    const inBar = isDesktop || pageOrder.includes(key);
    setBackStack((st) => (inBar ? [] : [...st, activeTab]));
    setSlideDir(dir ?? (inBar && pageOrder.includes(activeTab) && pageOrder.indexOf(key) < pageOrder.indexOf(activeTab) ? 'right' : 'left'));
    setActiveTab(key);
  }, [activeTab, pageOrder, isDesktop]);
  const goBack = useCallback(() => {
    const prev = backStack[backStack.length - 1] ?? ui.start;
    setBackStack((st) => st.slice(0, -1));
    setSlideDir('right');
    setPageOpts({});
    setActiveTab(prev);
  }, [backStack, ui.start]);

  // Opened from a trip invite link: go to Trips, which asks "which one are you?"
  useEffect(() => { if (pendingInvite()) goTo('trips'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The app tour, once per device: a new account gets the whole tour; an
  // account that already has entries just hears that the guides exist.
  useEffect(() => {
    if (!loaded || tourSeen() || pendingInvite()) return undefined;
    const t = setTimeout(() => {
      if (transactions.length + income.length === 0) startTour('app');
      else { markTourSeen(); setToastMsg({ text: 'New: tap ? at the top of any page for a quick guide' }); }
    }, 1200);
    return () => clearTimeout(t);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Cloud push: the reminder plan is uploaded for the website's reminders;
  // this device gets security alerts (and, on the website, reminders) by push
  useEffect(() => { setPushUser(user.uid); return () => setPushUser(null); }, [user.uid]);
  useEffect(() => {
    const reg = () => registerPush(user.uid, devices.thisId, { reminders: deviceDelivery.get() });
    reg();
    // Coming back to the app: register again (a token the notifier dropped,
    // or one the browser rotated, is replaced instead of staying silent)
    const onVisible = () => { if (document.visibilityState === 'visible') reg(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user.uid, devices.thisId]);
  useEffect(() => {
    onReminderTap((route) => { if (['today', 'plan', 'bills', 'budget', 'stats', 'history', 'savings'].includes(route)) goTo(route === 'plan' ? 'bills' : route); });
  }, [goTo]);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(() => updateReminderInput({
      cfg: settings?.reminders,
      data: { transactions, income, recurring: recurring.rules, budgets: settings?.budgets, categoryRules: settings?.categoryRules, goals: settings?.goals, report: settings?.report },
    }), 800);
    return () => clearTimeout(t);
  }, [loaded, settings?.reminders, settings?.budgets, settings?.categoryRules, settings?.goals, settings?.report, transactions, income, recurring.rules]);

  const swipe = useSwipeNavigation({ order: pageOrder, active: activeTab, onChange: goTo, enabled: !isDesktop && !addKind && pageOrder.includes(activeTab) });

  const commonProps = {
    transactions, income, settings, recentlyDeleted,
    restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
    isStandalone, canInstallNative, onTriggerInstall: triggerInstall,
    selectedPeriod, onPeriodChange: setSelectedPeriod,
    theme, themePref, onThemePrefChange: setThemePref, user, devices, securityEvents, drive,
    recurring, onPatchSettings: patchSettings, onLearnCategory: learnCategory, reportError,
  };

  const tabColors = PAGE_COLOR[theme === 'monoflow' ? 'dark' : 'light'];
  const dueCount = recurring.manualDue.length;
  // A new entry: a coin flies into the month card (gold spent, green in,
  // blue saved, violet debts) and the confirmation draws its sign
  const celebrate = (entry) => {
    const debt = (entry.type === 'person' && entry.direction !== 'given_gift') || (entry.type === 'income' && (entry.isBorrowed || entry.isRepaymentRec));
    const tone = debt ? 'violet' : entry.type === 'income' ? 'green' : entry.type === 'savings' ? 'blue' : 'gold';
    const from = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.querySelector('[id^="btn-save-"]');
    flyCoin({ from, to: ['#home-summary', '#tab-today', '#side-today'], tone });
    setToastMsg({ text: entry.toast ?? `Added ${entry.name} · ${formatAmount(entry.amount, entry.currency)}`, sign: tone === 'green' ? 'wallet' : tone === 'blue' ? 'piggy' : 'check' });
  };
  const shell = {
    user, goTo, back: goBack, barTabs, desktop: isDesktop, active: activeTab, celebrate,
    showBack: !isDesktop && !pageOrder.includes(activeTab) && activeTab !== 'profile',
    openProfile: () => goTo('profile'),
    openAdd: (kind = 'expense', opts = {}) => setAddKind({ kind, ...opts }),
    toast: setToastMsg,
    attention: sync.error != null,
    month: viewMonth, setMonth: setViewMonth,
  };
  // Bar: Home · slot 1 · "+" · slot 2 · slot 3
  const barItems = [
    { key: 'today', ...PAGE_META.today },
    { key: barTabs[0], ...PAGE_META[barTabs[0]] },
    { key: 'add' },
    { key: barTabs[1], ...PAGE_META[barTabs[1]] },
    { key: barTabs[2], ...PAGE_META[barTabs[2]] },
  ];

  const page = (
    <Suspense fallback={null}>
    {activeTab === 'today' && (
      <TodayTab {...commonProps} onAdd={smartAddEntry} onAddIncome={addIncome} />
    )}
    {activeTab === 'history' && (
      <HistoryTab
        {...commonProps}
        onUpdateTransaction={updateTransaction}
        onDeleteTransaction={deleteTransaction}
        onUpdateIncome={updateIncome}
        onDeleteIncome={deleteIncome}
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
    {(activeTab === 'external' || activeTab === 'trips') && (
      <ExternalTab
        key={activeTab}
        initialMode={activeTab === 'trips' ? 'trips' : 'billings'}
        showModeToggle={false}
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
      <DebtsPage
        {...commonProps}
        onAddTransaction={addTransaction}
        onUpdateTransaction={updateTransaction}
        onDeleteTransaction={deleteTransaction}
        onAddIncome={addIncome}
        onUpdateIncome={updateIncome}
        onDeleteIncome={deleteIncome}
      />
    )}
    {(activeTab === 'bills' || activeTab === 'plan') && <BillsPage {...commonProps} />}
    {activeTab === 'budget' && <BudgetPage {...commonProps} />}
    {activeTab === 'savings' && <SavingsPage {...commonProps} />}
    {activeTab === 'stats' && <StatsTab {...commonProps} />}
    {activeTab === 'profile' && (
      <ProfilePage
        {...commonProps}
        onBack={isDesktop ? null : goBack}
        openGroup={pageOpts.openGroup}
        onSignOut={signOut}
        onDeleteAccount={deleteAccount}
        onResetPassword={resetPassword}
        onResendVerification={resendVerification}
        onAddTransaction={addTransaction}
        onAddIncome={addIncome}
      />
    )}
    </Suspense>
  );

  const overlays = (
    <>
      {errorBanner}
      <SecurityBanners uid={user.uid} devices={devices} events={securityEvents} />

      {addKind && (
        <Suspense fallback={null}>
          <AddSheet
            {...commonProps}
            initialKind={addKind.kind}
            options={addKind}
            onAdd={smartAddEntry}
            onAddIncome={addIncome}
            onClose={() => setAddKind(null)}
            onSaved={celebrate}
          />
        </Suspense>
      )}

      <TourHost />

      {toastMsg && (
        <div role="status" className="app-toast" key={toastMsg.text ?? toastMsg} style={{
          position: 'fixed', left: 16, right: 16, bottom: isDesktop ? 28 : 'calc(92px + env(safe-area-inset-bottom, 0px))', zIndex: 950,
          maxWidth: 420, margin: '0 auto', padding: '11px 16px', borderRadius: 16, textAlign: 'center',
          fontSize: 13, fontWeight: 600, color: 'var(--toast-text, #fff)', background: 'var(--toast-bg, rgba(28,28,32,.92))',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,.45)', animation: 'toastIn .22s cubic-bezier(0.16,1,0.3,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>{toastMsg.sign && <Sign kind={toastMsg.sign} size={18} />}{toastMsg.text ?? toastMsg}</div>
      )}
    </>
  );

  /* ── DESKTOP / WEB: sidebar + the same pages ── */
  if (isDesktop) {
    return (
      <ShellContext.Provider value={shell}>
      <div className="desktop-shell" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
        <aside className="desktop-sidebar" aria-label="Pages">
          <div className="desktop-brand">
            <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={30} height={30} />
            <span>Expense Tracker</span>
          </div>
          <nav className="desktop-nav">
            {DESKTOP_NAV.map((group) => (
              <div key={group.title} className="desktop-nav-group">
                <div className="desktop-nav-title">{group.title}</div>
                {group.keys.map((k) => {
                  const { label, Icon } = PAGE_META[k];
                  const on = activeTab === k || (k === 'bills' && activeTab === 'plan');
                  return (
                    <button key={k} id={`side-${k}`} className={`desktop-nav-item${on ? ' on' : ''}`} onClick={() => goTo(k)} aria-current={on ? 'page' : undefined}
                      style={on ? { color: tabColors[k] } : undefined}>
                      <Icon size={17} strokeWidth={on ? 2.3 : 1.9} />
                      <span>{label}</span>
                      {k === 'bills' && dueCount > 0 && <span className="desktop-nav-badge">{dueCount > 9 ? '9+' : dueCount}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <button id="side-profile" className={`desktop-profile${activeTab === 'profile' ? ' on' : ''}`} onClick={() => goTo('profile')}>
            <Avatar user={user} size={32} />
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span className="desktop-profile-name">{displayNameOf(user)}</span>
              <span className="desktop-profile-sub">Profile & settings</span>
            </span>
            <Settings2 size={15} />
            {shell.attention && <span className="desktop-attention" aria-hidden />}
          </button>
        </aside>
        <main key={activeTab} className={`desktop-main page-${activeTab}`}>
          {page}
        </main>
        {overlays}
      </div>
      </ShellContext.Provider>
    );
  }

  /* ── PHONE ── */
  return (
    <ShellContext.Provider value={shell}>
    <div className="mobile-shell" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div
        {...swipe}
        key={activeTab}
        className={`mobile-page page-${activeTab}${slideDir === 'left' ? ' page-slide-left' : slideDir === 'right' ? ' page-slide-right' : ''}`}
        style={{ flex: 1, overflow: 'auto' }}
      >
        {page}
      </div>

      {overlays}

      {/* ── Bottom bar: Home · 2 pages · + · 1 page ── */}
      <nav id="phone-bar" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {barItems.map(({ key, label, Icon }) => {
          if (key === 'add') {
            return (
              <button key="add" id="tab-add" className="nav-add" aria-label="Add an entry" onClick={() => setAddKind({ kind: 'expense' })}
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
              {key === 'bills' && dueCount > 0 && (
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

/* ── App lock: while locked, the app (and its data) isn't rendered at all ── */
function LockGate(props) {
  const { signOut } = props;
  const [signOutNote, setSignOutNote] = useState(null);
  const remoteSignOut = useCallback(() => { signOut({ force: true }); }, [signOut]);
  const lock = useAppLock(props.user, { onRemoteSignOut: remoteSignOut });
  if (lock.locked) {
    return (
      <>
        <LockScreen lock={lock} user={props.user} onSignOut={async () => {
          const r = await signOut();
          if (r?.pending) setSignOutNote(`${r.pending} change${r.pending === 1 ? ' is' : 's are'} still waiting to upload — connect to the internet, then sign out.`);
        }} />
        {signOutNote && <div role="alert" style={{ position: 'fixed', left: 16, right: 16, bottom: 24, maxWidth: 420, margin: '0 auto', padding: '10px 14px', borderRadius: 12, background: '#B91C1C', color: '#fff', fontSize: 12, fontWeight: 600 }}>{signOutNote}</div>}
      </>
    );
  }
  return (
    <AppLockContext.Provider value={lock}>
      <AuthenticatedApp {...props} />
    </AppLockContext.Provider>
  );
}

/* ── Root App — wraps everything in AuthGate ── */
export default function App() {
  return (
    <>
    <UpdateBanner />
    <AuthGate>
      {(auth) => <LockGate {...auth} />}
    </AuthGate>
    </>
  );
}
