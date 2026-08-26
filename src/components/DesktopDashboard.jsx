import { useState, useRef, useMemo } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, PenLine, IndianRupee, PiggyBank,
  Wallet, TrendingUp, TrendingDown, Flame, ChevronDown,
  ChevronRight, Trash2, Zap, Moon, Sun, Briefcase, Upload, ArrowLeftRight, Users, Calendar, Pencil, List, ReceiptText,
} from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount, formatDate, todayInputValue, dateInputToISO, isoToMonth } from '../utils/dateHelpers';
import { getPeriodLabel, getCurrentMonthValue } from '../utils/periodHelpers';
import PeriodSelector from './PeriodSelector';
import SettingsTab from '../features/settings/SettingsTab';
import ExternalTab from '../features/external/ExternalTab';
import HistoryTab from '../features/transactions/HistoryTab';
import PersonsPanel from '../features/persons/PersonsPanel';
import EditTransactionModal from './EditTransactionModal';
import EditIncomeModal from './EditIncomeModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useStats } from '../hooks/useStats';
import { useWastage } from '../hooks/useWastage';
import { useTransactions } from '../hooks/useTransactions';
import { TYPE_META, TRANSACTION_TYPES, PERSON_DIRECTIONS, SAVINGS_TYPES, getSavingsType } from '../utils/typeConfig';
import LoadMonthlyData from './LoadMonthlyData';


const TODAY_LABEL = formatDate(new Date().toISOString());

/* ─── Chart Tooltip ─── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      borderRadius: 10, padding: '8px 12px',
      boxShadow: 'var(--shadow)', fontSize: 12,
      fontFamily: 'Inter, sans-serif',
    }}>
      {label && <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill, fontWeight: 700, margin: 0 }}>
          {p.name}: {formatAmount(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Shared Card ─── */
function DCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }) {
  return (
    <div style={{
      padding: '13px 18px 11px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function SummaryTile({ label, value, color, bg, border, Icon, gradient }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '15px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: gradient || color,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color,
        }}>
          {Icon && <Icon size={13} />}
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {formatAmount(value)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function DesktopDashboard({
  transactions, income, settings,
  selectedPeriod, onPeriodChange,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  onAddIncome, onUpdateIncome, onDeleteIncome,
  onDataChange, onThemeChange,
  onSignOut, theme, user,
}) {
  const isMonoflow = theme === 'monoflow';
  // Use shared hooks
  const { stats, filtTxns, filtInc, pieData, barData, areaData, C } = useStats(transactions, income, selectedPeriod, theme);
  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = useWastage(onUpdateTransaction);

  /* ── UI state ── */
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashTxnView, setDashTxnView] = useState('today');
  const [showImport, setShowImport] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editingInc, setEditingInc] = useState(null);
  const [deletingTxnId, setDeletingTxnId] = useState(null);
  const [deletingIncId, setDeletingIncId] = useState(null);

  // Quick entry states
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [settlement, setSettlement] = useState('');
  const [extSource, setExtSource] = useState('');
  const [type, setType] = useState('expense');
  const [direction, setDirection] = useState('lent');
  const [savingsType, setSavingsType] = useState('cash');
  const [platform, setPlatform] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [isCustomName, setIsCustomName] = useState(false);

  const nameRef = useRef(null);
  const amountRef = useRef(null);
  const settlementRef = useRef(null);
  const extSourceRef = useRef(null);

  const debtPersons = useMemo(() => {
    const all = Object.keys(stats?.personDebts || {});
    if (direction === 'repaid') return all.filter(p => (stats.personDebts[p]?.netOwed ?? 0) > 0);
    return [];
  }, [stats?.personDebts, direction]);

  const hasDebtPersons = debtPersons.length > 0;
  const isRepayDirection = type === 'person' && direction === 'repaid';

  const lentPersons = useMemo(() => {
    const all = Object.keys(stats?.personDebts || {});
    return all.filter(p => (stats.personDebts[p]?.netLent ?? 0) > 0);
  }, [stats?.personDebts]);
  const hasLentPersons = lentPersons.length > 0;

  // Income entry states
  const [incMode, setIncMode] = useState('income'); // 'income' | 'borrowed' | 'repaymentRec'
  const [iName, setIName] = useState('');
  const [iAmount, setIAmount] = useState('');
  const [iDateInput, setIDateInput] = useState(todayInputValue());
  const [isICustomName, setIsICustomName] = useState(false);
  const [isIFullPayment, setIsIFullPayment] = useState(false);
  const iNameRef = useRef(null);
  const iAmountRef = useRef(null);

  /* ── Today's entries ── */
  const todayTxns = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [transactions]);
  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);

  /* ── Handlers ── */
  function saveEntry() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || isNaN(a) || a <= 0) return;

    const isoDate = dateInputToISO(dateInput);
    if (type === 'expense') {
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'expense',
        date: isoDate, month: isoToMonth(isoDate),
      });
    } else if (type === 'person') {
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'person',
        direction, date: isoDate, month: isoToMonth(isoDate),
      });
    } else if (type === 'savings') {
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'savings',
        savingsType, platform, date: isoDate, month: isoToMonth(isoDate),
      });
    }

    setName(''); setAmount(''); setPlatform(''); setIsFullPayment(false); setIsCustomName(false);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function saveIncome() {
    const n = iName.trim(), a = parseFloat(iAmount);
    if (!n || isNaN(a) || a <= 0 || !onAddIncome) return;

    const isoDate = dateInputToISO(iDateInput);
    onAddIncome({
      id: generateId(),
      name: n,
      amount: a,
      type: 'income',
      isBorrowed: incMode === 'borrowed',
      isRepaymentRec: incMode === 'repaymentRec',
      date: isoDate,
      month: isoToMonth(isoDate),
    });
    setIName(''); setIAmount(''); setIDateInput(todayInputValue()); setIsICustomName(false); setIsIFullPayment(false);
    setTimeout(() => iNameRef.current?.focus(), 50);
  }

  const sel = TRANSACTION_TYPES.find(t => t.key === type);
  const positive = stats.balance >= 0;

  const inputStyle = {
    width: '100%', padding: '9px 12px 9px 34px',
    borderRadius: 9, fontSize: 13,
    border: '1.5px solid var(--input-border)',
    background: 'var(--input-bg)', color: 'var(--text)',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };
  const focusHandlers = (color) => ({
    onFocus: e => (e.target.style.borderColor = color),
    onBlur: e => (e.target.style.borderColor = 'var(--input-border)'),
  });

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onSave={onUpdateTransaction}
          onDelete={onDeleteTransaction}
          onClose={() => setEditingTxn(null)}
        />
      )}

      {/* Edit Income Modal */}
      {editingInc && onUpdateIncome && (
        <EditIncomeModal
          entry={editingInc}
          onSave={onUpdateIncome}
          onDelete={onDeleteIncome}
          onClose={() => setEditingInc(null)}
        />
      )}

      {/* Confirm Delete Transaction Modal */}
      {deletingTxnId && (
        <ConfirmDeleteModal
          title="Delete transaction?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteTransaction(deletingTxnId); setDeletingTxnId(null); }}
          onCancel={() => setDeletingTxnId(null)}
        />
      )}

      {/* Confirm Delete Income Modal */}
      {deletingIncId && (
        <ConfirmDeleteModal
          title="Delete income entry?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteIncome(deletingIncId); setDeletingIncId(null); }}
          onCancel={() => setDeletingIncId(null)}
        />
      )}

      {/* Load Monthly Data modal */}
      {showImport && (
        <LoadMonthlyData
          onAddTransaction={onAddTransaction}
          onAddIncome={onAddIncome}
          onClose={() => setShowImport(false)}
          transactions={transactions}
          income={income}
        />
      )}

      {/* ══ HEADER ══ */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '11px 28px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
        flexWrap: 'wrap', gap: 12,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={import.meta.env.BASE_URL + 'Expense.png'}
            alt="Expense Tracker Logo"
            style={{
              width: 36, height: 36, borderRadius: 10,
              objectFit: 'cover',
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              Expense Tracker
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
              Financial Command Center
            </div>
          </div>
        </div>

        {/* Center: nav tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'history', label: 'History', icon: <List size={12} /> },
            { key: 'external', label: 'Billings', icon: <ReceiptText size={12} /> },
            { key: 'settings', label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)',
                background: activeSection === tab.key ? 'var(--accent)' : 'transparent',
                color: activeSection === tab.key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: period + balance + theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PeriodSelector
            period={selectedPeriod}
            onChange={onPeriodChange}
            transactions={transactions}
            income={income}
          />
          <div style={{
            padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12,
            background: positive ? 'var(--income-bg)' : 'var(--expense-bg)',
            color: positive ? 'var(--income)' : 'var(--expense)',
            border: `1.5px solid ${positive ? 'var(--income-border)' : 'var(--expense-border)'}`,
          }}>
            Balance: {formatAmount(stats.balance)}
          </div>
          {/* Theme toggle */}
          <button
            onClick={() => onThemeChange(isMonoflow ? 'light' : 'monoflow')}
            title={isMonoflow ? 'Switch to Light' : 'Switch to MonoFlow'}
            style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {isMonoflow ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* ══ SETTINGS VIEW ══ */}
      {activeSection === 'settings' && (
        <div className="desktop-settings-host" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
          <style>{`
            .desktop-settings-host .tab-root {
              height: auto !important;
              overflow: visible !important;
              min-height: unset !important;
            }
            .desktop-settings-host .tab-header {
              position: static !important;
            }
            .desktop-settings-host .tab-body {
              overflow: visible !important;
              flex: unset !important;
            }
          `}</style>
          <SettingsTab
            settings={settings}
            theme={theme}
            user={user}
            transactions={transactions}
            income={income}
            addTransaction={onAddTransaction}
            addIncome={onAddIncome}
            onDataChange={onDataChange}
            onThemeChange={onThemeChange}
            onSignOut={onSignOut}
          />
        </div>
      )}

      {/* ══ HISTORY VIEW ══ */}
      {activeSection === 'history' && (
        <div className="desktop-history-host" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <HistoryTab
            transactions={transactions}
            income={income}
            selectedPeriod={selectedPeriod}
            onPeriodChange={onPeriodChange}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            onAddTransaction={onAddTransaction}
            onAddIncome={onAddIncome}
          />
        </div>
      )}

      {/* ══ BILLINGS VIEW ══ */}
      {activeSection === 'external' && (
        <div className="desktop-external-host" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <ExternalTab
            user={user}
            onAddIncome={onAddIncome}
            onUpdateIncome={onUpdateIncome}
            onDeleteIncome={onDeleteIncome}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            selectedPeriod={selectedPeriod}
            theme={theme}
          />
        </div>
      )}

      {/* ══ PEOPLE VIEW ══ */}
      {activeSection === 'people' && (
        <div className="desktop-people-host" style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <PersonsPanel
            transactions={transactions}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      {/* ══ DASHBOARD VIEW ══ */}
      {activeSection === 'dashboard' && (<>

        {/* ── SUMMARY STRIP ── */}
        <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {/* Remaining Balance */}
          <div
            style={{
              background: positive
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, #F43F5E, #E11D48)',
              borderRadius: 16,
              padding: '15px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              boxShadow: positive ? '0 6px 18px rgba(16, 185, 129, 0.22)' : '0 6px 18px rgba(244, 63, 94, 0.22)',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)' }}>
                Remaining
              </span>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={12} color="#fff" />
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {formatAmount(stats.balance)}
            </div>
          </div>

          <SummaryTile label="Income" value={stats.totalIncome} color="var(--income)" bg="var(--income-bg)" gradient="linear-gradient(135deg, #10B981, #0D9488)" Icon={TrendingUp} />
          <SummaryTile label="Expense" value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" gradient="linear-gradient(135deg, #F43F5E, #E11D48)" Icon={TrendingDown} />
          <SummaryTile label="Savings" value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" gradient="linear-gradient(135deg, #3B82F6, #6366F1)" Icon={PiggyBank} />
          <SummaryTile
            label="You Owe (Debt)"
            value={stats.allTimeNetOwed}
            color="var(--borrowed)"
            bg="var(--borrowed-bg)"
            gradient="linear-gradient(135deg, #EF4444, #DC2626)"
            Icon={Users}
          />
          <SummaryTile
            label="Owes You (Lent)"
            value={stats.allTimeNetLent}
            color="var(--lent)"
            bg="var(--lent-bg)"
            gradient="linear-gradient(135deg, #F59E0B, #D97706)"
            Icon={Users}
          />

          {/* Waste Card */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '15px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(135deg, #FF5722, #EA580C)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Wastage
              </span>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--waste-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={13} style={{ color: 'var(--waste)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--waste)', letterSpacing: '-0.02em' }}>{stats.wastePercent}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>({formatAmount(stats.totalWaste)})</div>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ padding: '14px 28px 0', display: 'grid', gridTemplateColumns: '400px 1fr', gap: 14, alignItems: 'start' }}>

          {/* LEFT: Entry form + Today's entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Entry Form */}
            <DCard style={{ flexShrink: 0 }}>
              <CardHeader
                title="Quick Entry"
                sub={`Today: ${formatAmount(todayTotal)} · ${todayTxns.length} entries`}
              />
              <div style={{ padding: '14px 18px 18px' }}>
                {/* Type picker */}
                <div style={{
                  display: 'flex', background: 'var(--surface2)',
                  borderRadius: 11, padding: 3, marginBottom: 12,
                  border: '1px solid var(--border)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {TRANSACTION_TYPES.map(t => (
                    <button
                      key={t.key}
                      id={`desktop-type-${t.key}`}
                      onClick={() => setType(t.key)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: type === t.key ? t.color : 'transparent',
                        color: type === t.key ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                        position: 'relative', zIndex: type === t.key ? 1 : 0,
                        boxShadow: type === t.key ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
                      }}
                    >
                      <t.Icon size={11} />{t.label}
                    </button>
                  ))}
                </div>

                {/* Person Direction Toggle */}
                {type === 'person' && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {PERSON_DIRECTIONS.map(d => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDirection(d.key)}
                        style={{
                          flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
                          background: direction === d.key ? d.color + '22' : 'transparent',
                          color: direction === d.key ? d.color : 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        <d.Icon size={12} />
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Savings Sub-Category */}
                {type === 'savings' && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {SAVINGS_TYPES.map(st => (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => setSavingsType(st.key)}
                          style={{
                            padding: '4px 8px', borderRadius: 14, fontSize: 10, fontWeight: 700,
                            border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                            background: savingsType === st.key ? st.color + '22' : 'transparent',
                            color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    {getSavingsType(savingsType).hasPlatform && (
                      <input
                        type="text"
                        placeholder="Platform (e.g. Angel One, Zerodha)"
                        value={platform}
                        onChange={e => setPlatform(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: 12, marginBottom: 4 }}
                      />
                    )}
                  </div>
                )}

                {/* Person Name Selection / Dropdown (only uncleared debt contacts) */}
                {isRepayDirection && !isCustomName ? (
                  <div style={{ marginBottom: 8 }}>
                    <select
                      id="desktop-select-repayment-person"
                      value={name}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomName(true);
                          setName('');
                          setAmount('');
                          setIsFullPayment(false);
                          return;
                        }
                        setName(val);
                        setIsFullPayment(false);
                        const debt = direction === 'repaid'
                          ? (stats.personDebts?.[val]?.netOwed ?? 0)
                          : (stats.personDebts?.[val]?.netLent ?? 0);
                        if (debt > 0) {
                          setAmount(debt.toString());
                          setIsFullPayment(true);
                        } else {
                          setAmount('');
                        }
                      }}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 12,
                        border: `1.5px solid ${direction === 'repaid' ? 'var(--person)' : 'var(--income)'}`,
                        background: 'var(--input-bg)', color: 'var(--text)',
                        outline: 'none', fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >
                      <option value="">
                        {hasDebtPersons
                          ? (direction === 'repaid' ? '-- Select Person to Repay (Debt Left) --' : '-- Select Person Who Repaid You --')
                          : '-- No Active Debts (Type Custom Name) --'
                        }
                      </option>
                      {debtPersons.map(p => (
                        <option key={p} value={p}>
                          {p} ({direction === 'repaid'
                            ? `Debt Left: ${formatAmount(stats.personDebts[p].netOwed)}`
                            : `Owes You: ${formatAmount(stats.personDebts[p].netLent)}`
                          })
                        </option>
                      ))}
                      <option value="__custom__">✏️ Type Custom Name…</option>
                    </select>

                    {name && name !== '__custom__' && (
                      <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: direction === 'repaid' ? 'var(--person-bg)' : 'var(--income-bg)', border: `1px solid ${direction === 'repaid' ? 'var(--person-border)' : 'var(--income-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: direction === 'repaid' ? 'var(--person)' : 'var(--income)' }}>
                          {direction === 'repaid'
                            ? `Pending Debt: ${formatAmount(stats.personDebts?.[name]?.netOwed ?? 0)}`
                            : `Owes You: ${formatAmount(stats.personDebts?.[name]?.netLent ?? 0)}`
                          }
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: direction === 'repaid' ? 'var(--person)' : 'var(--income)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isFullPayment}
                            onChange={e => {
                              const checked = e.target.checked;
                              setIsFullPayment(checked);
                              if (checked) {
                                const fullAmt = direction === 'repaid'
                                  ? (stats.personDebts?.[name]?.netOwed ?? 0)
                                  : (stats.personDebts?.[name]?.netLent ?? 0);
                                setAmount(fullAmt.toString());
                              }
                            }}
                          />
                          Full {direction === 'repaid' ? 'Payment' : 'Repayment'}
                        </label>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Standard Name Input field (for non-repayment or custom name mode) */}
                {(!isRepayDirection || isCustomName) && (
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <PenLine size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      id="desktop-input-name" ref={nameRef} type="text"
                      placeholder={type === 'person' ? 'Person Name' : 'Description…'}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), amountRef.current?.focus())}
                      autoComplete="off"
                      style={{ ...inputStyle, paddingRight: isRepayDirection ? 70 : 12 }}
                      {...focusHandlers(sel.color)}
                    />
                    {isRepayDirection && (
                      <button
                        type="button"
                        onClick={() => { setIsCustomName(false); setName(''); setAmount(''); }}
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600,
                          color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        List 📋
                      </button>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <IndianRupee size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="desktop-input-amount" ref={amountRef} type="text"
                    placeholder="0.00" value={amount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveEntry())}
                    inputMode="decimal" autoComplete="off"
                    style={{ ...inputStyle, fontSize: 15, fontWeight: 700 }}
                    {...focusHandlers(sel.color)}
                  />
                </div>

                {/* Date */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Calendar size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="date"
                    value={dateInput}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setDateInput(e.target.value)}
                    style={inputStyle}
                    {...focusHandlers(sel.color)}
                  />
                </div>

                <button
                  id="desktop-btn-save"
                  onClick={saveEntry}
                  disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    background: (name.trim() && amount && parseFloat(amount) > 0) ? sel.color : 'var(--surface2)',
                    color: (name.trim() && amount && parseFloat(amount) > 0) ? '#fff' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  Add {type === 'person' ? (direction === 'repayment' ? 'Repayment' : 'Lent Money') : sel.label} ↵
                </button>
              </div>
            </DCard>

            {/* Today / Period Entries Card */}
            {(() => {
              const displayTxns = dashTxnView === 'today' ? todayTxns : filtTxns;
              return (
                <DCard>
                  <CardHeader
                    title={dashTxnView === 'today' ? "Today's Entries" : "Period Entries"}
                    sub={`${displayTxns.length} transactions`}
                    right={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => setDashTxnView(v => v === 'today' ? 'period' : 'today')}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {dashTxnView === 'today' ? 'Period →' : 'Today →'}
                        </button>
                        <button
                          onClick={() => setActiveSection('history')}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                            color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Full History
                        </button>
                      </div>
                    }
                  />
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {displayTxns.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 6 }}>
                        <ShoppingCart size={20} style={{ color: 'var(--text-muted)' }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                          {dashTxnView === 'today' ? 'No entries yet today' : 'No entries in this period'}
                        </p>
                      </div>
                    ) : displayTxns.slice().reverse().map((txn) => {
                      const m = TYPE_META[txn.type] || TYPE_META.expense;
                      const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                      const isEditing = editingWaste === txn.id;
                      const isGivenGift = txn.type === 'person' && txn.direction === 'given_gift';
                      const isRepaidThem = txn.type === 'person' && txn.direction === 'repaid';
                      const badgeLabel = txn.type === 'person' && txn.direction === 'repayment' ? 'Repayment' :
                                         isGivenGift ? 'Given' :
                                         isRepaidThem ? 'Repaid' :
                                         txn.type === 'person' && txn.direction === 'lent' ? 'Lent' :
                                         m.label;
                      const badgeBg    = isGivenGift ? '#EEF2FF' : m.bg;
                      const badgeColor = isGivenGift ? '#6366F1' : m.color;

                      return (
                        <div key={txn.id}>
                          <div
                            onClick={() => handleTxnTap(txn)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 18px',
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer',
                              background: isWasted ? m.bg : 'transparent',
                              borderLeft: isWasted ? `3px solid ${m.color}` : '3px solid transparent',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: badgeBg, color: badgeColor, flexShrink: 0 }}>
                                {badgeLabel}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {txn.name}
                                </span>
                                {isWasted && <Flame size={10} style={{ color: m.color, flexShrink: 0 }} />}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: txn.direction === 'repayment' ? 'var(--income)' : m.color, marginLeft: 8 }}>
                                {txn.direction === 'repayment' ? '+' : ''}{formatAmount(txn.amount)}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); setEditingTxn(txn); }}
                                style={{
                                  width: 22, height: 22, borderRadius: 5,
                                  background: 'transparent', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--text-muted)', cursor: 'pointer',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Pencil size={11} />
                              </button>
                              {onDeleteTransaction && (
                                <button
                                  onClick={e => { e.stopPropagation(); setDeletingTxnId(txn.id); }}
                                  style={{
                                    width: 22, height: 22, borderRadius: 5,
                                    background: 'transparent', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing && (
                            <div style={{ display: 'flex', gap: 6, padding: '7px 14px', background: 'var(--expense-bg)', borderBottom: '1px solid var(--expense-border)' }}>
                              <input
                                ref={wasteInputRef} type="number" placeholder="Waste amount" value={wasteInput}
                                onChange={e => setWasteInput(e.target.value)} inputMode="decimal"
                                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--expense)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                                onKeyDown={e => { if (e.key === 'Enter') saveWaste(txn); if (e.key === 'Escape') cancelWaste(); }}
                              />
                              <button onClick={() => saveWaste(txn)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--expense)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                              <button onClick={cancelWaste} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </DCard>
              );
            })()}
          </div>

          {/* RIGHT: Income + Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>

            {/* Income & Borrowed Money Panel */}
            <DCard style={{ height: '100%' }}>
              <CardHeader
                title="Income & Inflows"
                right={
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--income-bg)', color: 'var(--income)', fontSize: 11, fontWeight: 700, border: '1px solid var(--income-border)' }}>
                    {formatAmount(filtInc.reduce((s, i) => s + i.amount, 0))}
                  </div>
                }
              />
              <div style={{ padding: '12px 16px' }}>
                {/* 3-way mode toggle: Income vs Borrowed vs Repayment Rec */}
                <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 9, padding: 2, marginBottom: 10, border: '1px solid var(--border)', gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => { setIncMode('income'); setIName(''); setIAmount(''); setIsICustomName(false); }}
                    style={{
                      flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: incMode === 'income' ? 'var(--income)' : 'transparent',
                      color: incMode === 'income' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s', textAlign: 'center',
                    }}
                  >
                    💰 Income
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIncMode('borrowed'); setIName(''); setIAmount(''); setIsICustomName(false); }}
                    style={{
                      flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: incMode === 'borrowed' ? 'var(--person)' : 'transparent',
                      color: incMode === 'borrowed' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s', textAlign: 'center',
                    }}
                  >
                    🤝 Borrowed
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIncMode('repaymentRec'); setIName(''); setIAmount(''); setIsICustomName(false); }}
                    style={{
                      flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: incMode === 'repaymentRec' ? '#0891B2' : 'transparent',
                      color: incMode === 'repaymentRec' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s', textAlign: 'center',
                    }}
                  >
                    ⮐ Repay Rec.
                  </button>
                </div>

                {/* Person Dropdown for Repayment Rec. */}
                {incMode === 'repaymentRec' && !isICustomName ? (
                  <div style={{ marginBottom: 7 }}>
                    <select
                      value={iName}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsICustomName(true);
                          setIName('');
                          setIAmount('');
                          setIsIFullPayment(false);
                          return;
                        }
                        setIName(val);
                        setIsIFullPayment(false);
                        const debt = stats.personDebts?.[val]?.netLent ?? 0;
                        if (debt > 0) {
                          setIAmount(debt.toString());
                          setIsIFullPayment(true);
                        } else {
                          setIAmount('');
                        }
                      }}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 12,
                        border: '1.5px solid #0891B2', background: 'var(--input-bg)', color: 'var(--text)',
                        outline: 'none', fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >
                      <option value="">
                        {hasLentPersons ? '-- Select Person Who Repaid You --' : '-- No Active Debtors (Type Custom Name) --'}
                      </option>
                      {lentPersons.map(p => (
                        <option key={p} value={p}>
                          {p} (Owes You: {formatAmount(stats.personDebts[p].netLent)})
                        </option>
                      ))}
                      <option value="__custom__">✏️ Type Custom Name…</option>
                    </select>

                    {iName && iName !== '__custom__' && (
                      <div style={{
                        marginTop: 4, padding: '5px 8px', borderRadius: 6,
                        background: '#ECFEFF', border: '1px solid #A5F3FC',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#0891B2' }}>
                          Owes You: {formatAmount(stats.personDebts?.[iName]?.netLent ?? 0)}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#0891B2', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isIFullPayment}
                            onChange={e => {
                              const checked = e.target.checked;
                              setIsIFullPayment(checked);
                              if (checked) {
                                const fullAmt = stats.personDebts?.[iName]?.netLent ?? 0;
                                setIAmount(fullAmt.toString());
                              }
                            }}
                          />
                          Full Repayment
                        </label>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Name Input */}
                {(incMode !== 'repaymentRec' || isICustomName) && (
                  <div style={{ position: 'relative', marginBottom: 7 }}>
                    <PenLine size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      id="desktop-income-name" ref={iNameRef} type="text"
                      placeholder={incMode === 'income' ? 'Source (Salary, Freelance...)' : 'Person Name'}
                      value={iName}
                      onChange={e => setIName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), iAmountRef.current?.focus())}
                      autoComplete="off" style={{ ...inputStyle, paddingRight: incMode === 'repaymentRec' ? 70 : 12 }}
                      {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
                    />
                    {incMode === 'repaymentRec' && (
                      <button
                        type="button"
                        onClick={() => { setIsICustomName(false); setIName(''); setIAmount(''); }}
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600,
                          color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        List 📋
                      </button>
                    )}
                  </div>
                )}
                <div style={{ position: 'relative', marginBottom: 7 }}>
                  <IndianRupee size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="desktop-income-amount" ref={iAmountRef} type="text" placeholder="0.00" value={iAmount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
                    inputMode="decimal" autoComplete="off" style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }}
                    {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
                  />
                </div>
                {/* Income Date */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Calendar size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="date"
                    value={iDateInput}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setIDateInput(e.target.value)}
                    style={inputStyle}
                    {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
                  />
                </div>
                <button
                  id="desktop-btn-income" onClick={saveIncome}
                  disabled={!iName.trim() || !iAmount || parseFloat(iAmount) <= 0}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    background: iName.trim() && iAmount && parseFloat(iAmount) > 0
                      ? (incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')
                      : 'var(--surface2)',
                    color: iName.trim() && iAmount && parseFloat(iAmount) > 0 ? '#fff' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {incMode === 'income' ? 'Add Income ↵' : incMode === 'borrowed' ? 'Add Borrowed Money ↵' : 'Add Repayment Rec. ↵'}
                </button>
              </div>

              {/* Combined List (Income + Borrowed + Repayment Rec) */}
              {(() => {
                const borrowedTxns = filtTxns.filter(t => t.type === 'person' && t.direction === 'borrowed');
                const combinedList = [
                  ...filtInc.map(i => ({ ...i, isBorrowed: !!i.isBorrowed, isRepaymentRec: !!i.isRepaymentRec })),
                  ...borrowedTxns.map(t => ({ ...t, isBorrowed: true })),
                ].sort((a, b) => new Date(b.date) - new Date(a.date));

                return (
                  <div style={{ maxHeight: 210, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                    {combinedList.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70 }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No entries this period</p>
                      </div>
                    ) : combinedList.map(entry => (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 16px', borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700,
                            background: entry.isRepaymentRec ? '#ECFEFF' : entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                            color: entry.isRepaymentRec ? '#0891B2' : entry.isBorrowed ? 'var(--person)' : 'var(--income)',
                            flexShrink: 0,
                          }}>
                            {entry.isRepaymentRec ? '⮐ Repay Rec.' : entry.isBorrowed ? 'Borrowed' : 'Income'}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {entry.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: entry.isRepaymentRec ? '#0891B2' : entry.isBorrowed ? 'var(--person)' : 'var(--income)' }}>
                            +{formatAmount(entry.amount)}
                          </span>

                          {/* Pencil Edit button for all Income entries */}
                          {onUpdateIncome && (
                            <button
                              onClick={() => setEditingInc(entry)}
                              style={{ width: 20, height: 20, borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--income)'; e.currentTarget.style.background = 'var(--income-bg)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                          {(onDeleteIncome || onDeleteTransaction) && (
                            <button
                              onClick={() => {
                                if (income.some(i => i.id === entry.id)) {
                                  setDeletingIncId(entry.id);
                                } else if (transactions.some(t => t.id === entry.id)) {
                                  if (onDeleteTransaction) onDeleteTransaction(entry.id);
                                } else {
                                  setDeletingIncId(entry.id);
                                }
                              }}
                              style={{ width: 20, height: 20, borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </DCard>

            {/* Analytics Panel */}
            <DCard style={{ height: '100%' }}>
              <CardHeader title="Analytics" sub={getPeriodLabel(selectedPeriod)} />
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Donut & Legend */}
                {pieData.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Category Breakdown
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <ResponsiveContainer width={110} height={110}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={4}>
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                        {pieData.map(d => (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{d.name}</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 700 }}>{formatAmount(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No category data available</p>
                  </div>
                )}

                {/* Financial Health Indicators */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Period Ratios &amp; Health
                  </p>

                  {(() => {
                    const inc = stats.totalIncome || 0;
                    const exp = stats.totalExpense || 0;
                    const sav = stats.totalSavings || 0;
                    const wst = stats.totalWaste || 0;

                    const expRatio = inc > 0 ? Math.min(100, Math.round((exp / inc) * 100)) : 0;
                    const savRatio = inc > 0 ? Math.min(100, Math.round((sav / inc) * 100)) : 0;
                    const wstRatio = exp > 0 ? Math.min(100, Math.round((wst / exp) * 100)) : 0;
                    const netSurplus = inc - exp - sav;

                    return (
                      <>
                        {/* Savings Rate */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Savings Rate</span>
                            <span style={{ color: savRatio >= 20 ? 'var(--income)' : savRatio >= 10 ? 'var(--lent)' : 'var(--expense)' }}>
                              {savRatio}% {savRatio >= 20 ? '(Healthy)' : savRatio >= 10 ? '(Moderate)' : '(Low)'}
                            </span>
                          </div>
                          <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${savRatio}%`, borderRadius: 99, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>

                        {/* Expense Ratio */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Expense Ratio</span>
                            <span style={{ color: expRatio > 80 ? 'var(--expense)' : expRatio > 60 ? 'var(--lent)' : 'var(--income)' }}>
                              {expRatio}% of Income
                            </span>
                          </div>
                          <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${expRatio}%`, borderRadius: 99, background: expRatio > 80 ? 'var(--expense)' : expRatio > 60 ? 'var(--lent)' : 'var(--income)', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>

                        {/* Wastage Impact */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Flame size={11} style={{ color: wst > 0 ? 'var(--expense)' : 'var(--text-muted)' }} /> Wastage Leakage
                            </span>
                            <span style={{ color: wst > 0 ? 'var(--expense)' : 'var(--text-muted)', fontWeight: 700 }}>
                              {wstRatio}% of Expenses ({formatAmount(wst)})
                            </span>
                          </div>
                          <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${wstRatio}%`, borderRadius: 99, background: 'var(--expense)', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Cash Flow Trend Graph */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      Cash Flow Trend (6 Months)
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.income }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: C.income }} /> Income
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.expense }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: C.expense }} /> Expense
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.income} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={C.income} stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.expense} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={C.expense} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="Income" stroke={C.income} strokeWidth={2} fillOpacity={1} fill="url(#incGrad)" />
                      <Area type="monotone" dataKey="Expense" stroke={C.expense} strokeWidth={2} fillOpacity={1} fill="url(#expGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </DCard>
          </div>
        </div>
      </>)}
    </div>
  );
}
