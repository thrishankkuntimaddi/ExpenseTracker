import { useState, useRef, useMemo } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ShoppingCart, Users, PiggyBank, PenLine, IndianRupee,
  Wallet, TrendingUp, TrendingDown, Flame, ChevronDown,
  ChevronRight, ArrowDownToLine, Trash2, Zap, Moon, Sun, LogOut,
} from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount, formatDate, groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';
import { getSmartGrouping, getPeriodLabel, getCurrentMonthValue } from '../utils/periodHelpers';
import PeriodSelector from './PeriodSelector';
import SettingsTab from '../features/settings/SettingsTab';
import { useStats } from '../hooks/useStats';
import { useWastage } from '../hooks/useWastage';

/* ─── Entry types ─── */
const ENTRY_TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)',  Icon: Users       },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank   },
];
const TYPE_META = {
  expense: { label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)' },
  person:  { label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)'  },
  savings: { label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)' },
  income:  { label: 'Income',  color: 'var(--income)',  bg: 'var(--income-bg)'  },
};

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

/* ═══════════════════════════════════════════════════════════════ */
export default function DesktopDashboard({
  transactions, income, settings,
  selectedPeriod, onPeriodChange,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  onAddIncome, onDeleteIncome,
  onDataChange, onLockChange, onThemeChange,
  onSignOut, theme, user,
}) {
  const isMonoflow = theme === 'monoflow';
  // Use shared hooks — no more duplicated logic
  const { stats, filtTxns, pieData, barData, areaData, C } = useStats(transactions, income, selectedPeriod, theme);
  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = useWastage(onUpdateTransaction);

  /* ── UI state ── */
  const [activeSection, setActiveSection] = useState('dashboard');
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType]     = useState('expense');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  const [iName, setIName]     = useState('');
  const [iAmount, setIAmount] = useState('');
  const iNameRef   = useRef(null);
  const iAmountRef = useRef(null);

  const [expandedGroups, setExpandedGroups] = useState(() => new Set([TODAY_LABEL]));

  /* ── Today's entries (still needed locally) ── */
  const todayTxns = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [transactions]);
  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);

  const histGrouping = getSmartGrouping(selectedPeriod);
  const histGrouped  = useMemo(() => {
    if (histGrouping === 'month') return groupByMonth(filtTxns);
    if (histGrouping === 'week')  return groupByWeek(filtTxns);
    return groupByDay(filtTxns);
  }, [filtTxns, histGrouping]);

  /* ── Handlers ── */
  function saveEntry() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || isNaN(a) || a <= 0) return;
    onAddTransaction({ id: generateId(), name: n, amount: a, type, date: new Date().toISOString(), month: getCurrentMonthValue() });
    setName(''); setAmount('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function saveIncome() {
    const n = iName.trim(), a = parseFloat(iAmount);
    if (!n || isNaN(a) || a <= 0) return;
    onAddIncome({ id: generateId(), name: n, amount: a, type: 'income', date: new Date().toISOString(), month: getCurrentMonthValue() });
    setIName(''); setIAmount('');
    setTimeout(() => iNameRef.current?.focus(), 50);
  }

  function toggleGroup(label) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }

  const sel = ENTRY_TYPES.find(t => t.key === type);
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
            { key: 'settings',  label: 'Settings'  },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)',
                background: activeSection === tab.key ? 'var(--accent)' : 'transparent',
                color: activeSection === tab.key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
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
          {/* Override tab-root inside desktop context so it renders naturally */}
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
            onDataChange={onDataChange}
            onLockChange={onLockChange}
            onThemeChange={onThemeChange}
            onSignOut={onSignOut}
          />
        </div>
      )}


      {/* ══ DASHBOARD VIEW ══ */}
      {activeSection === 'dashboard' && (<>

        {/* ── SUMMARY STRIP ── */}
        <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {/* Balance */}
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
            {stats.openingBalance !== 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                <ArrowDownToLine size={9} />Opening: {formatAmount(stats.openingBalance)}
              </div>
            )}
          </div>

          {/* Income */}
          <SummaryTile label="Income"  value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}   />
          <SummaryTile label="Expense" value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown}  />
          <SummaryTile label="Savings" value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />

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
        <div style={{ padding: '14px 28px 0', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>

          {/* LEFT: Entry form + Today's entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Entry Form */}
            <DCard>
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
                }}>
                  {ENTRY_TYPES.map(t => (
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
                      }}
                    >
                      <t.Icon size={11} />{t.label}
                    </button>
                  ))}
                </div>
                {/* Name */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <PenLine size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="desktop-input-name" ref={nameRef} type="text"
                    placeholder="Description…" value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), amountRef.current?.focus())}
                    autoComplete="off"
                    style={inputStyle}
                    {...focusHandlers(sel.color)}
                  />
                </div>
                {/* Amount */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
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
                <button
                  id="desktop-btn-save"
                  onClick={saveEntry}
                  disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    background: name.trim() && amount && parseFloat(amount) > 0 ? sel.color : 'var(--surface2)',
                    color: name.trim() && amount && parseFloat(amount) > 0 ? '#fff' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  Add {sel.label} ↵
                </button>
              </div>
            </DCard>

            {/* Today's Entries */}
            <DCard style={{ maxHeight: 320 }}>
              <CardHeader title="Today's Entries" sub={`${todayTxns.length} transactions`} />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {todayTxns.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 6 }}>
                    <ShoppingCart size={20} style={{ color: 'var(--text-muted)' }} />
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No entries yet today</p>
                  </div>
                ) : todayTxns.slice().reverse().map((txn) => {
                  const m = TYPE_META[txn.type];
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
                          cursor: txn.type === 'expense' ? 'pointer' : 'default',
                          background: isWasted ? 'var(--expense-bg)' : 'transparent',
                          borderLeft: isWasted ? '3px solid var(--expense)' : '3px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>
                            {m.label}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {txn.name}
                          </span>
                          {isWasted && <Flame size={10} style={{ color: 'var(--expense)', flexShrink: 0 }} />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: m.color, marginLeft: 8 }}>
                            {formatAmount(txn.amount)}
                          </span>
                          {onDeleteTransaction && (
                            <button
                              onClick={e => { e.stopPropagation(); onDeleteTransaction(txn.id); }}
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
              {todayTxns.length > 0 && (
                <div style={{ padding: '6px 18px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Tap expense = waste · Double-tap = custom amount
                </div>
              )}
            </DCard>
          </div>

          {/* RIGHT: Income + Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Income Panel */}
            <DCard>
              <CardHeader
                title="Income"
                right={
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--income-bg)', color: 'var(--income)', fontSize: 11, fontWeight: 700, border: '1px solid var(--income-border)' }}>
                    {formatAmount(income.reduce((s, i) => s + i.amount, 0))}
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
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <IndianRupee size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="desktop-income-amount" ref={iAmountRef} type="text" placeholder="0.00" value={iAmount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
                    inputMode="decimal" autoComplete="off" style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} {...focusHandlers('var(--income)')} />
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
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, borderTop: '1px solid var(--border)' }}>
                {income.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No income yet</p>
                  </div>
                ) : income.slice().reverse().map(entry => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <Wallet size={11} style={{ color: 'var(--income)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--income)' }}>{formatAmount(entry.amount)}</span>
                      {onDeleteIncome && (
                        <button
                          onClick={() => onDeleteIncome(entry.id)}
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
              <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

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

                {/* 14-day bar */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Last 14 Days
                  </p>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={barData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface2)' }} />
                      <Bar dataKey="Expense" fill={C.expense} radius={[3, 3, 0, 0]} maxBarSize={16} />
                      <Bar dataKey="Savings" fill={C.savings} radius={[3, 3, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 6-month area */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    6-Month Trend
                  </p>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={areaData} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dIncGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.income}  stopOpacity={0.35} />
                          <stop offset="95%" stopColor={C.income}  stopOpacity={0}    />
                        </linearGradient>
                        <linearGradient id="dExpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.expense} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={C.expense} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="Income"  stroke={C.income}  strokeWidth={1.5} fill="url(#dIncGrad)" dot={{ r: 2, fill: C.income }}  />
                      <Area type="monotone" dataKey="Expense" stroke={C.expense} strokeWidth={1.5} fill="url(#dExpGrad)" dot={{ r: 2, fill: C.expense }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Waste meter */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Waste Meter
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--expense)', fontWeight: 600 }}>{formatAmount(stats.totalWaste)}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--expense)' }}>{stats.wastePercent}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, parseFloat(stats.wastePercent))}%`,
                      background: `linear-gradient(90deg, #F59E0B, ${C.expense})`,
                      borderRadius: 99, transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

              </div>
            </DCard>
          </div>
        </div>

        {/* ── HISTORY ── */}
        <div style={{ padding: '14px 28px 32px' }}>
          <DCard>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Transaction History</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {getPeriodLabel(selectedPeriod)} · {filtTxns.length} transactions · Click group to expand
                </div>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {histGrouped.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No transactions in this period</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {histGrouped.map(group => {
                    const total   = group.entries.reduce((s, t) => s + t.amount, 0);
                    const waste   = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
                    const isOpen  = expandedGroups.has(group.label);
                    const isToday = group.label === TODAY_LABEL;
                    return (
                      <div key={group.label} style={{ borderBottom: '1px solid var(--border)' }}>
                        <button
                          onClick={() => toggleGroup(group.label)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 18px', background: isToday ? 'var(--income-bg)' : 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8,
                            fontFamily: 'inherit', borderLeft: isToday ? '3px solid var(--income)' : '3px solid transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                            {isOpen ? <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{group.label}</span>
                            {isToday && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--income-bg)', color: 'var(--income)', textTransform: 'uppercase' }}>Today</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                            {waste > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--expense)', fontWeight: 600 }}><Flame size={9} />{formatAmount(waste)}</span>}
                            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(total)}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{group.entries.length}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {group.entries.map((txn, i) => {
                              const m = TYPE_META[txn.type] || TYPE_META.expense;
                              const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                              return (
                                <div
                                  key={txn.id}
                                  onClick={() => handleTxnTap(txn)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 18px 8px 40px',
                                    borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: isWasted ? 'var(--expense-bg)' : 'transparent',
                                    cursor: txn.type === 'expense' ? 'pointer' : 'default',
                                    borderLeft: isWasted ? '3px solid var(--expense)' : '3px solid transparent',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                    <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.name}</span>
                                    {isWasted && <span style={{ fontSize: 9, color: 'var(--expense)', flexShrink: 0 }}>🔥{txn.wasteAmount === txn.amount ? 'Full' : formatAmount(txn.wasteAmount)}</span>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: m.color, marginLeft: 8 }}>{formatAmount(txn.amount)}</span>
                                    {onDeleteTransaction && (
                                      <button
                                        onClick={e => { e.stopPropagation(); onDeleteTransaction(txn.id); }}
                                        style={{ width: 20, height: 20, borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DCard>
        </div>

      </>)}
    </div>
  );
}

function SummaryTile({ label, value, color, bg, border, Icon }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>{label}</span>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={11} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{formatAmount(value)}</div>
    </div>
  );
}
