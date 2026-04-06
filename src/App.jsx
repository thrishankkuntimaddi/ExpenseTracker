import { useState, useCallback } from 'react';
import {
  Home, List, Wallet, BarChart2, Settings,
  TrendingUp, CreditCard, PiggyBank,
} from 'lucide-react';
import { loadState, saveState, clearState } from './utils/storage';
import TodayTab    from './tabs/TodayTab';
import HistoryTab  from './tabs/HistoryTab';
import IncomeTab   from './tabs/IncomeTab';
import StatsTab    from './tabs/StatsTab';
import SettingsTab from './tabs/SettingsTab';
import LockScreen  from './components/LockScreen';
import { formatAmount } from './utils/dateHelpers';

const TABS = [
  { key: 'today',    label: 'Today',    Icon: Home      },
  { key: 'history',  label: 'History',  Icon: List      },
  { key: 'income',   label: 'Income',   Icon: Wallet    },
  { key: 'stats',    label: 'Stats',    Icon: BarChart2 },
  { key: 'settings', label: 'Settings', Icon: Settings  },
];

const TAB_COLORS = {
  today:    'var(--expense)',
  history:  'var(--person)',
  income:   'var(--income)',
  stats:    'var(--savings)',
  settings: 'var(--text-secondary)',
};

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

  // ── Quick stats for sidebar ────────────────────────────────────
  const totalIncome  = income.reduce((s, i) => s + i.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense
    - transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
    - transactions.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);

  const addTransaction  = useCallback((txn)     => persist({ ...appState, transactions: [...appState.transactions, txn] }), [appState, persist]);
  const updateTransaction = useCallback((updated) => persist({ ...appState, transactions: appState.transactions.map(t => t.id === updated.id ? updated : t) }), [appState, persist]);
  const addIncome       = useCallback((entry)   => persist({ ...appState, income: [...appState.income, entry] }), [appState, persist]);
  const handleDataChange  = useCallback(({ transactions, income }) => persist({ ...appState, transactions, income }), [appState, persist]);
  const handleLockChange  = useCallback((s) => { const next = { ...appState, settings: { ...appState.settings, ...s } }; persist(next); if (!s.password) setLocked(false); }, [appState, persist]);
  const handleUnlock      = useCallback((pw, cb) => { if (pw === settings.password) { setLocked(false); cb(true); } else cb(false); }, [settings.password]);
  const handleWipe        = useCallback(() => { clearState(); persist({ transactions: [], income: [], settings: { password: null, failedAttempts: 0, locked: false } }); setLocked(false); }, [persist]);

  if (locked && settings.password) return <LockScreen onUnlock={handleUnlock} onWipe={handleWipe} />;

  const tabContent = (
    <>
      {activeTab === 'today'    && <TodayTab    transactions={transactions} onAdd={addTransaction} />}
      {activeTab === 'history'  && <HistoryTab  transactions={transactions} onUpdateTransaction={updateTransaction} />}
      {activeTab === 'income'   && <IncomeTab   income={income} onAddIncome={addIncome} />}
      {activeTab === 'stats'    && <StatsTab    transactions={transactions} income={income} />}
      {activeTab === 'settings' && <SettingsTab onDataChange={handleDataChange} onLockChange={handleLockChange} settings={settings} />}
    </>
  );

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ═══ DESKTOP SIDEBAR (hidden on mobile) ═══ */}
      <aside className="hidden lg:flex" style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CreditCard size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Expense</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Tracker</div>
            </div>
          </div>
        </div>

        {/* Quick Balance Card */}
        <div style={{ margin: '16px 14px', borderRadius: 16, padding: '14px 16px', background: balance >= 0 ? 'var(--income-bg)' : 'var(--expense-bg)', border: `1px solid ${balance >= 0 ? 'var(--income-border)' : 'var(--expense-border)'}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: balance >= 0 ? 'var(--income)' : 'var(--expense)', marginBottom: 4 }}>Balance</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}>{formatAmount(balance)}</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <SidebarStat label="Income"  value={totalIncome}  color="var(--income)"  Icon={TrendingUp} />
            <SidebarStat label="Spent"   value={totalExpense} color="var(--expense)" Icon={CreditCard} />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '6px 10px 8px' }}>Menu</div>
          {TABS.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            const color = TAB_COLORS[key];
            return (
              <button
                key={key}
                id={`sidebar-tab-${key}`}
                onClick={() => setActiveTab(key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, marginBottom: 2,
                  textAlign: 'left', border: 'none', cursor: 'pointer',
                  background: isActive ? color + '18' : 'transparent',
                  color: isActive ? color : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 13,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? color + '22' : 'transparent',
                  transition: 'all 0.15s ease',
                }}>
                  <Icon size={16} strokeWidth={isActive ? 2.3 : 1.8} />
                </div>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            All data stored locally
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tabContent}
        </div>

        {/* ═══ MOBILE BOTTOM NAV (lg: hidden) ═══ */}
        <nav
          className="flex lg:hidden"
          style={{
            flexShrink: 0,
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
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
                  color: isActive ? color : 'var(--text-muted)',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 28, height: 2, borderRadius: 99, background: color,
                  }} />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.03em' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function SidebarStat({ label, value, color, Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{formatAmount(value)}</span>
    </div>
  );
}
