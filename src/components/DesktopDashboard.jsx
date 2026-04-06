import { useState, useRef, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, Users, PiggyBank, PenLine, IndianRupee,
  Wallet, TrendingUp, TrendingDown, Flame, ChevronDown,
  ChevronRight, ArrowDownToLine,
} from 'lucide-react';
import AppIcon from './AppIcon';
import { generateId } from '../utils/storage';
import { formatAmount, formatDate, groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';
import {
  filterItemsByPeriod, getOpeningBalance, getSmartGrouping,
  getPeriodLabel, getCurrentMonthValue,
} from '../utils/periodHelpers';
import PeriodSelector from './PeriodSelector';

/* ─── Constants ─── */
const ENTRY_TYPES = [
  { key: 'expense', label: 'Expense', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', Icon: Users       },
  { key: 'savings', label: 'Savings', color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE', Icon: PiggyBank   },
];
const TYPE_META = {
  expense: { label: 'Expense', color: '#DC2626', bg: '#FEE2E2' },
  person:  { label: 'Person',  color: '#D97706', bg: '#FEF3C7' },
  savings: { label: 'Savings', color: '#2563EB', bg: '#DBEAFE' },
  income:  { label: 'Income',  color: '#16A34A', bg: '#DCFCE7' },
};
const TODAY_LABEL = formatDate(new Date().toISOString());

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}>
      {label && <p style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill || '#DC2626', fontWeight: 700, margin: 0 }}>
          {p.name}: {formatAmount(p.value)}
        </p>
      ))}
    </div>
  );
}

function DCard({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }) {
  return (
    <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ─── Main ─── */
export default function DesktopDashboard({
  transactions, income,
  selectedPeriod, onPeriodChange,
  onAddTransaction, onUpdateTransaction, onAddIncome,
}) {
  /* Entry form */
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType]     = useState('expense');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  /* Income form */
  const [iName, setIName]     = useState('');
  const [iAmount, setIAmount] = useState('');
  const iNameRef   = useRef(null);
  const iAmountRef = useRef(null);

  /* Wastage */
  const [editingWaste, setEditingWaste] = useState(null);
  const [wasteInput, setWasteInput]     = useState('');
  const wasteInputRef = useRef(null);
  const lastTapRef    = useRef({});

  /* History */
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([TODAY_LABEL]));

  /* ── Filtered data for selected period ── */
  const filtTxns = useMemo(() => filterItemsByPeriod(transactions, selectedPeriod), [transactions, selectedPeriod]);
  const filtInc  = useMemo(() => filterItemsByPeriod(income, selectedPeriod),       [income, selectedPeriod]);

  /* ── Derived stats (period-aware) ── */
  const stats = useMemo(() => {
    const openingBalance = getOpeningBalance(selectedPeriod, transactions, income);
    const totalIncome  = filtInc.reduce((s, i) => s + i.amount, 0);
    const totalExpense = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavings = filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const totalPerson  = filtTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
    const totalWaste   = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0);
    const balance      = openingBalance + totalIncome - totalExpense - totalSavings - totalPerson;
    const wastePercent = totalExpense > 0 ? ((totalWaste / totalExpense) * 100).toFixed(1) : '0.0';
    return { openingBalance, totalIncome, totalExpense, totalSavings, totalPerson, totalWaste, balance, wastePercent };
  }, [filtTxns, filtInc, selectedPeriod, transactions, income]);

  /* ── Today's entries (always "today", period-independent) ── */
  const todayTxns = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [transactions]);
  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);

  /* ── Chart data ── */
  const pieData = useMemo(() => [
    { name: 'Expense', value: filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: '#DC2626' },
    { name: 'Savings', value: filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0), color: '#2563EB' },
    { name: 'Person',  value: filtTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0),  color: '#D97706' },
  ].filter(d => d.value > 0), [filtTxns]);

  /* Last 7 days always shows actual last-7-day spending (time-series) */
  const barData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key   = d.toDateString();
    const total = transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === key).reduce((s, t) => s + t.amount, 0);
    return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), amount: total };
  }), [transactions]);

  /* ── History grouped (period-filtered, smart grouping) ── */
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
    onAddTransaction({ id: generateId(), name: n, amount: a, type, date: new Date().toISOString(), month: getCurrentMonthValue(), wasteAmount: undefined });
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

  const handleTxnTap = useCallback((txn) => {
    if (txn.type !== 'expense') return;
    const now = Date.now(), last = lastTapRef.current[txn.id] || 0, D = 400;
    if (now - last < D) {
      lastTapRef.current[txn.id] = 0;
      setEditingWaste(txn.id);
      setWasteInput(txn.wasteAmount != null ? String(txn.wasteAmount) : '');
      setTimeout(() => wasteInputRef.current?.focus(), 80);
    } else {
      lastTapRef.current[txn.id] = now;
      setTimeout(() => {
        if (lastTapRef.current[txn.id] !== now) return;
        onUpdateTransaction({ ...txn, wasteAmount: txn.wasteAmount === txn.amount ? undefined : txn.amount });
      }, D);
    }
  }, [onUpdateTransaction]);

  function saveWaste(txn) {
    const val = parseFloat(wasteInput);
    onUpdateTransaction({ ...txn, wasteAmount: (!isNaN(val) && val > 0 && val <= txn.amount) ? val : undefined });
    setEditingWaste(null); setWasteInput('');
  }

  function toggleGroup(label) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }

  const sel = ENTRY_TYPES.find(t => t.key === type);
  const iStyle = (fc) => ({ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, fontSize: 13, border: '1.5px solid #E2E8F0', background: '#FAFBFC', color: '#0F172A', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' });
  const onFocus = (c) => ({ onFocus: e => (e.target.style.borderColor = c), onBlur: e => (e.target.style.borderColor = '#E2E8F0') });
  const positive = stats.balance >= 0;

  return (
    <div style={{ minHeight: '100%', background: '#F8FAFC', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* ══ HEADER ══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 #E2E8F0', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AppIcon size={38} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>Expense Tracker</div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>Financial Command Center</div>
          </div>
        </div>

        {/* Period selector in header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PeriodSelector
            period={selectedPeriod}
            onChange={onPeriodChange}
            transactions={transactions}
            income={income}
          />
          <div style={{ padding: '7px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, background: positive ? '#DCFCE7' : '#FEE2E2', color: positive ? '#16A34A' : '#DC2626', border: `1.5px solid ${positive ? '#BBF7D0' : '#FECACA'}` }}>
            Balance: {formatAmount(stats.balance)}
          </div>
        </div>
      </div>

      {/* ══ SUMMARY STRIP ══ */}
      <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {/* Balance (large) */}
        <div style={{ background: positive ? '#16A34A' : '#DC2626', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)' }}>Remaining</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{formatAmount(stats.balance)}</div>
          {stats.openingBalance !== 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <ArrowDownToLine size={10} />Opening: {formatAmount(stats.openingBalance)}
            </div>
          )}
        </div>
        {/* Income */}
        <div style={{ background: '#DCFCE7', border: '1.5px solid #BBF7D0', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16A34A' }}>Income</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#16A34A22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={12} color="#16A34A" /></div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#16A34A' }}>{formatAmount(stats.totalIncome)}</div>
        </div>
        {/* Expense */}
        <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#DC2626' }}>Expense</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#DC262622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingDown size={12} color="#DC2626" /></div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#DC2626' }}>{formatAmount(stats.totalExpense)}</div>
        </div>
        {/* Savings */}
        <div style={{ background: '#DBEAFE', border: '1.5px solid #BFDBFE', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2563EB' }}>Savings</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#2563EB22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PiggyBank size={12} color="#2563EB" /></div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#2563EB' }}>{formatAmount(stats.totalSavings)}</div>
        </div>
        {/* Waste */}
        <div style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97706' }}>Wastage</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#D9770622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Flame size={12} color="#D97706" /></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{stats.wastePercent}%</div>
          <div style={{ fontSize: 10, color: '#D97706', fontWeight: 600, marginTop: 2 }}>{formatAmount(stats.totalWaste)}</div>
        </div>
      </div>

      {/* ══ MAIN GRID ══ */}
      <div style={{ padding: '14px 28px 0', display: 'grid', gridTemplateColumns: '380px 1fr', gap: 14, alignItems: 'start' }}>

        {/* ── LEFT: Entry form + Today's entries ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Entry Form */}
          <DCard>
            <CardHeader title="Quick Entry" sub={`Today: ${formatAmount(todayTotal)} · ${todayTxns.length} entries`} />
            <div style={{ padding: '14px 18px 18px' }}>
              {/* Type picker */}
              <div style={{ display: 'flex', gap: 0, background: '#F1F5F9', borderRadius: 12, padding: 3, marginBottom: 12, border: '1px solid #E2E8F0' }}>
                {ENTRY_TYPES.map(t => (
                  <button key={t.key} id={`desktop-type-${t.key}`} onClick={() => setType(t.key)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: type === t.key ? t.color : 'transparent', color: type === t.key ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
                    <t.Icon size={11} />{t.label}
                  </button>
                ))}
              </div>
              {/* Name */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <PenLine size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input id="desktop-input-name" ref={nameRef} type="text" placeholder="Description…" value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), amountRef.current?.focus())}
                  autoComplete="off" style={iStyle(sel.color)} {...onFocus(sel.color)} />
              </div>
              {/* Amount */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <IndianRupee size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input id="desktop-input-amount" ref={amountRef} type="number" placeholder="0.00" value={amount}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveEntry())}
                  inputMode="decimal" style={{ ...iStyle(sel.color), fontSize: 15, fontWeight: 700 }} {...onFocus(sel.color)} />
              </div>
              <button id="desktop-btn-save" onClick={saveEntry} disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                style={{ width: '100%', padding: '10px', borderRadius: 11, fontSize: 12, fontWeight: 700, background: sel.color, color: '#fff', border: 'none', cursor: 'pointer', opacity: (!name.trim() || !amount || parseFloat(amount) <= 0) ? 0.4 : 1, fontFamily: 'inherit' }}>
                Add {sel.label} ↵
              </button>
            </div>
          </DCard>

          {/* Today's Entries */}
          <DCard style={{ maxHeight: 320 }}>
            <CardHeader title="Today's Entries" sub={`${todayTxns.length} transactions`} />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {todayTxns.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8 }}>
                  <ShoppingCart size={22} style={{ color: '#CBD5E1' }} />
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No entries yet today</p>
                </div>
              ) : todayTxns.slice().reverse().map((txn) => {
                const m = TYPE_META[txn.type];
                const isWasted  = txn.wasteAmount != null && txn.wasteAmount > 0;
                const isEditing = editingWaste === txn.id;
                return (
                  <div key={txn.id}>
                    <div onClick={() => handleTxnTap(txn)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid #F1F5F9', cursor: txn.type === 'expense' ? 'pointer' : 'default', background: isWasted ? '#FEF2F2' : 'transparent', borderLeft: isWasted ? '3px solid #DC2626' : '3px solid transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.name}</span>
                        {isWasted && <Flame size={10} style={{ color: '#DC2626', flexShrink: 0 }} />}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.color, marginLeft: 8, flexShrink: 0 }}>{formatAmount(txn.amount)}</span>
                    </div>
                    {isEditing && (
                      <div style={{ display: 'flex', gap: 6, padding: '7px 14px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                        <input ref={wasteInputRef} type="number" placeholder="Waste amount" value={wasteInput} onChange={e => setWasteInput(e.target.value)} inputMode="decimal"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid #DC2626', background: '#fff', color: '#0F172A', outline: 'none', fontFamily: 'inherit' }}
                          onKeyDown={e => { if (e.key === 'Enter') saveWaste(txn); if (e.key === 'Escape') { setEditingWaste(null); setWasteInput(''); } }} />
                        <button onClick={() => saveWaste(txn)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => { setEditingWaste(null); setWasteInput(''); }} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, background: '#E2E8F0', color: '#64748B', border: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {todayTxns.length > 0 && <div style={{ padding: '6px 18px', borderTop: '1px solid #F1F5F9', fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>Tap expense = waste · Double-tap = custom amount</div>}
          </DCard>
        </div>

        {/* ── RIGHT: Income + Analytics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Income Panel */}
          <DCard>
            <CardHeader title="Income" right={
              <div style={{ padding: '3px 10px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A', fontSize: 11, fontWeight: 700, border: '1px solid #BBF7D0' }}>
                {formatAmount(income.reduce((s, i) => s + i.amount, 0))} total
              </div>
            } />
            <div style={{ padding: '12px 16px' }}>
              <div style={{ position: 'relative', marginBottom: 7 }}>
                <PenLine size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input id="desktop-income-name" ref={iNameRef} type="text" placeholder="Source (Salary, etc.)" value={iName}
                  onChange={e => setIName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), iAmountRef.current?.focus())}
                  autoComplete="off" style={iStyle('#16A34A')} {...onFocus('#16A34A')} />
              </div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <IndianRupee size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input id="desktop-income-amount" ref={iAmountRef} type="number" placeholder="0.00" value={iAmount}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
                  inputMode="decimal" style={{ ...iStyle('#16A34A'), fontSize: 14, fontWeight: 700 }} {...onFocus('#16A34A')} />
              </div>
              <button id="desktop-btn-income" onClick={saveIncome} disabled={!iName.trim() || !iAmount || parseFloat(iAmount) <= 0}
                style={{ width: '100%', padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!iName.trim() || !iAmount || parseFloat(iAmount) <= 0) ? 0.4 : 1, fontFamily: 'inherit' }}>
                Add Income ↵
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 180, borderTop: '1px solid #F1F5F9' }}>
              {income.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70 }}>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No income added yet</p>
                </div>
              ) : income.slice().reverse().map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Wallet size={12} style={{ color: '#16A34A' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0F172A' }}>{entry.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>{formatAmount(entry.amount)}</span>
                </div>
              ))}
            </div>
          </DCard>

          {/* Analytics */}
          <DCard>
            <CardHeader title="Analytics" sub={`${getPeriodLabel(selectedPeriod)}`} />
            <div style={{ padding: '12px 16px', overflowY: 'auto' }}>
              {/* Pie chart */}
              {pieData.length > 0 ? (
                <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Distribution</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {pieData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color }} />
                          <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>{d.name}: {formatAmount(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>No data for this period</p>
                </div>
              )}
              {/* 7-day bar */}
              <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Last 7 Days Spending</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="amount" name="Expense" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
              {/* Waste meter */}
              <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 12, marginBottom: 6 }}>Waste Meter</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{formatAmount(stats.totalWaste)}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626' }}>{stats.wastePercent}%</span>
              </div>
              <div style={{ height: 7, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, parseFloat(stats.wastePercent))}%`, background: 'linear-gradient(90deg, #F59E0B, #DC2626)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </DCard>
        </div>
      </div>

      {/* ══ HISTORY ══ */}
      <div style={{ padding: '14px 28px 28px' }}>
        <DCard>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Transaction History</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                {getPeriodLabel(selectedPeriod)} · {filtTxns.length} transactions · Click to expand
              </div>
            </div>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {histGrouped.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                <p style={{ fontSize: 13, color: '#94A3B8' }}>No transactions in this period</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {histGrouped.map(group => {
                  const total  = group.entries.reduce((s, t) => s + t.amount, 0);
                  const waste  = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
                  const isOpen = expandedGroups.has(group.label);
                  const isToday = group.label === TODAY_LABEL;
                  return (
                    <div key={group.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <button onClick={() => toggleGroup(group.label)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', background: isToday ? '#F0FDF4' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 10, fontFamily: 'inherit', borderLeft: isToday ? '3px solid #16A34A' : '3px solid transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          {isOpen ? <ChevronDown size={13} style={{ color: '#64748B', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: '#64748B', flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{group.label}</span>
                          {isToday && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase' }}>Today</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {waste > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#DC2626', fontWeight: 600 }}><Flame size={10} />{formatAmount(waste)}</span>}
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{formatAmount(total)}</span>
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>{group.entries.length}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #F1F5F9' }}>
                          {group.entries.map((txn, i) => {
                            const m = TYPE_META[txn.type] || TYPE_META.expense;
                            const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                            return (
                              <div key={txn.id} onClick={() => handleTxnTap(txn)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 8px 42px', borderBottom: i < group.entries.length - 1 ? '1px solid #F8FAFC' : 'none', background: isWasted ? '#FEF2F2' : 'transparent', cursor: txn.type === 'expense' ? 'pointer' : 'default', borderLeft: isWasted ? '3px solid #DC2626' : '3px solid transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                                  <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.name}</span>
                                  {isWasted && <span style={{ fontSize: 10, color: '#DC2626', flexShrink: 0 }}>🔥{txn.wasteAmount === txn.amount ? 'Full' : formatAmount(txn.wasteAmount)}</span>}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: m.color, marginLeft: 8, flexShrink: 0 }}>{formatAmount(txn.amount)}</span>
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
    </div>
  );
}
