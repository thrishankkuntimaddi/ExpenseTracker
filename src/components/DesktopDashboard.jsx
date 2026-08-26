import { useState, useRef, useMemo } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, PenLine, IndianRupee, PiggyBank,
  Wallet, TrendingUp, TrendingDown, Flame, ChevronDown,
  ChevronRight, Trash2, Zap, Moon, Sun, Briefcase, Upload, ArrowLeftRight, Users, Calendar, Pencil, List,
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

function SummaryTile({ label, value, color, bg, border, Icon }) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>
          {label}
        </span>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>
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
  const [dashTxnView,   setDashTxnView]   = useState('today');
  const [showImport,    setShowImport]    = useState(false);
  const [editingTxn,    setEditingTxn]    = useState(null);
  const [editingInc,    setEditingInc]    = useState(null);
  const [deletingTxnId, setDeletingTxnId] = useState(null);
  const [deletingIncId, setDeletingIncId] = useState(null);

  // Quick entry states
  const [name, setName]             = useState('');
  const [amount, setAmount]         = useState('');
  const [dateInput, setDateInput]   = useState(todayInputValue());
  const [settlement, setSettlement] = useState('');
  const [extSource, setExtSource]   = useState('');
  const [type, setType]             = useState('expense');
  const [direction, setDirection]   = useState('lent');
  const [savingsType, setSavingsType] = useState('cash');
  const [platform, setPlatform]     = useState('');

  const nameRef         = useRef(null);
  const amountRef       = useRef(null);
  const settlementRef   = useRef(null);
  const extSourceRef    = useRef(null);

  // Income entry states
  const [iName, setIName]         = useState('');
  const [iAmount, setIAmount]     = useState('');
  const [iDateInput, setIDateInput] = useState(todayInputValue());
  const iNameRef   = useRef(null);
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
    const entry = {
      id: generateId(), name: n, amount: a, type,
      date: isoDate,
      month: isoToMonth(isoDate),
    };

    if (type === 'person') {
      entry.direction = direction;
    }
    if (type === 'savings') {
      entry.savingsType = savingsType;
      const st = getSavingsType(savingsType);
      if (st.hasPlatform && platform.trim()) entry.platform = platform.trim();
    }
    if (type === 'external') {
      const s = parseFloat(settlement);
      if (isNaN(s) || s < 0) return;
      entry.settlement = s;
      if (extSource.trim()) entry.externalSource = extSource.trim();
    }

    onAddTransaction(entry);
    setName(''); setAmount(''); setSettlement(''); setExtSource(''); setPlatform('');
    setDateInput(todayInputValue());
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function saveIncome() {
    const n = iName.trim(), a = parseFloat(iAmount);
    if (!n || isNaN(a) || a <= 0) return;
    const isoDate = dateInputToISO(iDateInput);
    onAddIncome({
      id: generateId(), name: n, amount: a, type: 'income',
      date: isoDate,
      month: isoToMonth(isoDate),
    });
    setIName(''); setIAmount(''); setIDateInput(todayInputValue());
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
    onBlur:  e => (e.target.style.borderColor = 'var(--input-border)'),
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
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#fff" strokeWidth={2.5} />
          </div>
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
            { key: 'history',   label: 'History',   icon: <List size={12} /> },
            { key: 'external',  label: 'External',  icon: <ArrowLeftRight size={12} /> },
            { key: 'settings',  label: 'Settings'  },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)',
                background: activeSection === tab.key
                  ? (tab.key === 'external' ? 'linear-gradient(135deg,#7C3AED,#A855F7)' : 'var(--accent)')
                  : 'transparent',
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

      {/* ══ EXTERNAL VIEW ══ */}
      {activeSection === 'external' && (
        <div className="desktop-external-host" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <style>{`
            .desktop-external-host .tab-root {
              background: transparent !important;
            }
            .desktop-external-host .tab-header {
              background: transparent !important;
              border-bottom-color: var(--border) !important;
              padding: 20px 0 14px !important;
            }
            .desktop-external-host .tab-root > div:nth-child(2) {
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
          `}</style>
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
        <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {/* Remaining Balance */}
          <div style={{
            background: positive ? 'var(--income)' : 'var(--expense)',
            borderRadius: 14, padding: '15px 16px',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)' }}>
              Remaining
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
              {formatAmount(stats.balance)}
            </div>
          </div>

          <SummaryTile label="Income"      value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}   />
          <SummaryTile label="Expense"     value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown}  />
          <SummaryTile label="Savings"     value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />
          <SummaryTile label="Outstanding" value={stats.netLent}       color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}        />

          {/* Waste */}
          <div style={{ background: 'var(--person-bg)', border: '1.5px solid var(--person-border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--expense)' }}>
                Wastage
              </span>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--expense-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={11} style={{ color: 'var(--expense)' }} />
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--expense)' }}>{stats.wastePercent}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{formatAmount(stats.totalWaste)}</div>
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

                {/* Name */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <PenLine size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="desktop-input-name" ref={nameRef} type="text"
                    placeholder={type === 'person' ? 'Person Name (e.g. Mom)' : 'Description…'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), amountRef.current?.focus())}
                    autoComplete="off"
                    style={inputStyle}
                    {...focusHandlers(sel.color)}
                  />
                </div>

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
                  const isWasted  = txn.wasteAmount != null && txn.wasteAmount > 0;
                  const isEditing = editingWaste === txn.id;
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
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>
                            {txn.type === 'person' && txn.direction === 'repayment' ? 'Repayment' : m.label}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>

            {/* Income Panel */}
            <DCard>
              <CardHeader
                title="Income"
                right={
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--income-bg)', color: 'var(--income)', fontSize: 11, fontWeight: 700, border: '1px solid var(--income-border)' }}>
                    {formatAmount(filtInc.reduce((s, i) => s + i.amount, 0))}
                  </div>
                }
              />
              <div style={{ padding: '12px 16px' }}>
                <div style={{ position: 'relative', marginBottom: 7 }}>
                  <PenLine size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="desktop-income-name" ref={iNameRef} type="text" placeholder="Source (Salary, etc.)" value={iName}
                    onChange={e => setIName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), iAmountRef.current?.focus())}
                    autoComplete="off" style={inputStyle} {...focusHandlers('var(--income)')} />
                </div>
                <div style={{ position: 'relative', marginBottom: 7 }}>
                  <IndianRupee size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="desktop-income-amount" ref={iAmountRef} type="text" placeholder="0.00" value={iAmount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
                    inputMode="decimal" autoComplete="off" style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} {...focusHandlers('var(--income)')} />
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
                    {...focusHandlers('var(--income)')}
                  />
                </div>
                <button
                  id="desktop-btn-income" onClick={saveIncome}
                  disabled={!iName.trim() || !iAmount || parseFloat(iAmount) <= 0}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    background: iName.trim() && iAmount && parseFloat(iAmount) > 0 ? 'var(--income)' : 'var(--surface2)',
                    color: iName.trim() && iAmount && parseFloat(iAmount) > 0 ? '#fff' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  Add Income ↵
                </button>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                {filtInc.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No income this period</p>
                  </div>
                ) : filtInc.slice().reverse().map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <Wallet size={11} style={{ color: 'var(--income)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {entry.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--income)' }}>{formatAmount(entry.amount)}</span>
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
                      {onDeleteIncome && (
                        <button
                          onClick={() => setDeletingIncId(entry.id)}
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
            </DCard>

            {/* Analytics Panel */}
            <DCard>
              <CardHeader title="Analytics" sub={getPeriodLabel(selectedPeriod)} />
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Donut */}
                {pieData.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Distribution</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ResponsiveContainer width={100} height={100}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" paddingAngle={3}>
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pieData.map(d => (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{d.name}: {formatAmount(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No distribution data</p>
                  </div>
                )}
              </div>
            </DCard>
          </div>
        </div>
      </>)}
    </div>
  );
}
