import { useState, useRef, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, Users, PiggyBank, PenLine, IndianRupee,
  Wallet, TrendingUp, TrendingDown, Flame, ChevronDown,
  ChevronRight, CreditCard, Scale,
} from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount, formatDate, groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';

/* ─── Constants ─────────────────────────────────────────────────── */
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

/* ─── Chart tooltip ─────────────────────────────────────────────── */
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

/* ─── Card wrapper ───────────────────────────────────────────────── */
function DCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Card header ────────────────────────────────────────────────── */
function CardHeader({ title, sub, right }) {
  return (
    <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, color, bg, border, Icon, isLarge }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 16, padding: isLarge ? '18px 20px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: isLarge ? 8 : 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color} />
        </div>
      </div>
      <div style={{ fontSize: isLarge ? 22 : 17, fontWeight: 800, color, lineHeight: 1.1 }}>{formatAmount(value)}</div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function DesktopDashboard({
  transactions, income,
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
  const [histFilter, setHistFilter] = useState('Day');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([TODAY_LABEL]));

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const totalIncome  = income.reduce((s, i) => s + i.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavings = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const totalPerson  = transactions.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
    const totalWaste   = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0);
    const balance      = totalIncome - totalExpense - totalSavings - totalPerson;
    const wastePercent = totalExpense > 0 ? ((totalWaste / totalExpense) * 100).toFixed(1) : '0.0';
    return { totalIncome, totalExpense, totalSavings, totalPerson, totalWaste, balance, wastePercent };
  }, [transactions, income]);

  /* ── Today transactions ── */
  const todayTxns = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [transactions]);

  /* ── Chart data ── */
  const pieData = useMemo(() => [
    { name: 'Expense', value: transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: '#DC2626' },
    { name: 'Savings', value: transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0), color: '#2563EB' },
    { name: 'Person',  value: transactions.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0),  color: '#D97706' },
  ].filter(d => d.value > 0), [transactions]);

  const barData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toDateString();
      const total = transactions
        .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === key)
        .reduce((s, t) => s + t.amount, 0);
      return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), amount: total, date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
    });
  }, [transactions]);

  /* ── History grouped ── */
  const histGrouped = useMemo(() =>
    histFilter === 'Day'   ? groupByDay(transactions)
    : histFilter === 'Week'  ? groupByWeek(transactions)
    : groupByMonth(transactions),
    [histFilter, transactions]
  );

  /* ── Today total ── */
  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);

  /* ── Handlers ── */
  function saveEntry() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || isNaN(a) || a <= 0) return;
    onAddTransaction({ id: generateId(), name: n, amount: a, type, date: new Date().toISOString(), wasteAmount: undefined });
    setName(''); setAmount('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function saveIncome() {
    const n = iName.trim(), a = parseFloat(iAmount);
    if (!n || isNaN(a) || a <= 0) return;
    onAddIncome({ id: generateId(), name: n, amount: a, type: 'income', date: new Date().toISOString() });
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
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  const sel = ENTRY_TYPES.find(t => t.key === type);
  const inputStyle = (focusColor) => ({
    width: '100%', padding: '10px 12px 10px 36px',
    borderRadius: 10, fontSize: 13, border: '1.5px solid #E2E8F0',
    background: '#FAFBFC', color: '#0F172A', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
  });

  const focusHandler = (color) => ({
    onFocus: e => (e.target.style.borderColor = color),
    onBlur:  e => (e.target.style.borderColor = '#E2E8F0'),
  });

  return (
    <div style={{ minHeight: '100%', background: '#F8FAFC', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* ══════════════════════════════════════════════════════════
          HEADER BAR
      ══════════════════════════════════════════════════════════ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>Expense Tracker</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Personal Finance Command Center</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>Live Dashboard</div>
          </div>
          <div style={{
            padding: '8px 16px', borderRadius: 20, fontWeight: 700, fontSize: 14,
            background: stats.balance >= 0 ? '#DCFCE7' : '#FEE2E2',
            color: stats.balance >= 0 ? '#16A34A' : '#DC2626',
            border: `1.5px solid ${stats.balance >= 0 ? '#BBF7D0' : '#FECACA'}`,
          }}>
            Balance: {formatAmount(stats.balance)}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SUMMARY STRIP — 5 stat cards
      ══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <div style={{ background: stats.balance >= 0 ? '#16A34A' : '#DC2626', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / 2' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)' }}>Remaining Balance</span>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{formatAmount(stats.balance)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Income − Expense − Savings − Given</div>
        </div>
        <StatCard label="Total Income"  value={stats.totalIncome}  color="#16A34A" bg="#DCFCE7" border="#BBF7D0" Icon={TrendingUp}   />
        <StatCard label="Total Expense" value={stats.totalExpense} color="#DC2626" bg="#FEE2E2" border="#FECACA" Icon={TrendingDown}  />
        <StatCard label="Savings"       value={stats.totalSavings} color="#2563EB" bg="#DBEAFE" border="#BFDBFE" Icon={PiggyBank}     />
        {/* Waste % card */}
        <div style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97706' }}>Wastage</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#D9770622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={13} color="#D97706" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{stats.wastePercent}%</div>
          <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>{formatAmount(stats.totalWaste)} wasted</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN GRID — 2 columns
      ══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: '400px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Entry Form Card */}
          <DCard>
            <CardHeader
              title="Quick Entry"
              sub={`Today: ${formatAmount(todayTotal)} · ${todayTxns.length} entries`}
            />
            <div style={{ padding: '16px 20px 20px' }}>
              {/* Type picker */}
              <div style={{ display: 'flex', gap: 0, background: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 14, border: '1px solid #E2E8F0' }}>
                {ENTRY_TYPES.map(t => (
                  <button key={t.key} id={`desktop-type-${t.key}`} onClick={() => setType(t.key)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '8px 6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: type === t.key ? t.color : 'transparent',
                      color: type === t.key ? '#fff' : '#64748B',
                      boxShadow: type === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                    <t.Icon size={12} />{t.label}
                  </button>
                ))}
              </div>

              {/* Name input */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <PenLine size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  id="desktop-input-name"
                  ref={nameRef}
                  type="text"
                  placeholder="Description…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), amountRef.current?.focus())}
                  autoComplete="off"
                  style={inputStyle(sel.color)}
                  {...focusHandler(sel.color)}
                />
              </div>

              {/* Amount input */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <IndianRupee size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  id="desktop-input-amount"
                  ref={amountRef}
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveEntry())}
                  inputMode="decimal"
                  style={{ ...inputStyle(sel.color), fontSize: 16, fontWeight: 700 }}
                  {...focusHandler(sel.color)}
                />
              </div>

              <button
                id="desktop-btn-save"
                onClick={saveEntry}
                disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: sel.color, color: '#fff', border: 'none', cursor: 'pointer', opacity: (!name.trim() || !amount || parseFloat(amount) <= 0) ? 0.4 : 1, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
              >
                Add {sel.label} ↵
              </button>
            </div>
          </DCard>

          {/* Today's Entries Card */}
          <DCard style={{ maxHeight: 340 }}>
            <CardHeader title="Today's Entries" sub={`${todayTxns.length} transactions`} />
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {todayTxns.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10 }}>
                  <ShoppingCart size={24} style={{ color: '#CBD5E1' }} />
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No entries yet today</p>
                </div>
              ) : todayTxns.slice().reverse().map((txn, i) => {
                const m = TYPE_META[txn.type];
                const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                const isEditing = editingWaste === txn.id;
                return (
                  <div key={txn.id}>
                    <div
                      onClick={() => handleTxnTap(txn)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F1F5F9', cursor: txn.type === 'expense' ? 'pointer' : 'default', background: isWasted ? '#FEF2F2' : 'transparent', borderLeft: isWasted ? '3px solid #DC2626' : '3px solid transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.name}</span>
                        {isWasted && <Flame size={11} style={{ color: '#DC2626', flexShrink: 0 }} />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.color, marginLeft: 8, flexShrink: 0 }}>{formatAmount(txn.amount)}</span>
                    </div>
                    {isEditing && (
                      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                        <input ref={wasteInputRef} type="number" placeholder="Waste amount" value={wasteInput} onChange={e => setWasteInput(e.target.value)} inputMode="decimal"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid #DC2626', background: '#fff', color: '#0F172A', outline: 'none', fontFamily: 'inherit' }}
                          onKeyDown={e => { if (e.key === 'Enter') saveWaste(txn); if (e.key === 'Escape') { setEditingWaste(null); setWasteInput(''); } }} />
                        <button onClick={() => saveWaste(txn)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => { setEditingWaste(null); setWasteInput(''); }} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#E2E8F0', color: '#64748B', border: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {todayTxns.length > 0 && (
              <div style={{ padding: '8px 20px', borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                Tap expense to mark waste · Double-tap for custom amount
              </div>
            )}
          </DCard>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Income Panel + Analytics side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Income Panel */}
            <DCard>
              <CardHeader
                title="Income"
                right={
                  <div style={{ padding: '4px 10px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A', fontSize: 12, fontWeight: 700, border: '1px solid #BBF7D0' }}>
                    {formatAmount(income.reduce((s, i) => s + i.amount, 0))}
                  </div>
                }
              />
              <div style={{ padding: '14px 16px' }}>
                {/* Income form */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <PenLine size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  <input id="desktop-income-name" ref={iNameRef} type="text" placeholder="Source (Salary, etc.)" value={iName}
                    onChange={e => setIName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), iAmountRef.current?.focus())}
                    autoComplete="off"
                    style={inputStyle('#16A34A')} {...focusHandler('#16A34A')} />
                </div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <IndianRupee size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  <input id="desktop-income-amount" ref={iAmountRef} type="number" placeholder="0.00" value={iAmount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
                    inputMode="decimal"
                    style={{ ...inputStyle('#16A34A'), fontSize: 15, fontWeight: 700 }} {...focusHandler('#16A34A')} />
                </div>
                <button id="desktop-btn-income" onClick={saveIncome} disabled={!iName.trim() || !iAmount || parseFloat(iAmount) <= 0}
                  style={{ width: '100%', padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!iName.trim() || !iAmount || parseFloat(iAmount) <= 0) ? 0.4 : 1, fontFamily: 'inherit' }}>
                  Add Income ↵
                </button>
              </div>
              {/* Income list */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, borderTop: '1px solid #F1F5F9' }}>
                {income.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No income added yet</p>
                  </div>
                ) : income.slice().reverse().map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Wallet size={13} style={{ color: '#16A34A' }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{entry.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>{formatAmount(entry.amount)}</span>
                  </div>
                ))}
              </div>
            </DCard>

            {/* Analytics Panel */}
            <DCard>
              <CardHeader title="Analytics" sub="Spending breakdown" />
              <div style={{ padding: '14px 16px', overflowY: 'auto' }}>

                {/* Pie chart */}
                {pieData.length > 0 ? (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Distribution</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pieData.map(d => (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 12, color: '#94A3B8' }}>No data yet</p>
                  </div>
                )}

                {/* 7-day bar chart */}
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Last 7 Days</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="amount" name="Expense" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Waste meter */}
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 14, marginBottom: 8 }}>Waste Meter</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>{formatAmount(stats.totalWaste)} wasted</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#DC2626' }}>{stats.wastePercent}%</span>
                </div>
                <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, parseFloat(stats.wastePercent))}%`, background: 'linear-gradient(90deg, #F59E0B, #DC2626)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </DCard>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HISTORY — full width, collapsible
      ══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '16px 28px 28px' }}>
        <DCard>
          {/* History header + filter */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Transaction History</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Click date to expand/collapse</div>
            </div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, border: '1px solid #E2E8F0' }}>
              {['Day', 'Week', 'Month'].map(f => (
                <button key={f} onClick={() => setHistFilter(f)}
                  style={{ padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: histFilter === f ? '#2563EB' : 'transparent', color: histFilter === f ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped history */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {histGrouped.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                <p style={{ fontSize: 13, color: '#94A3B8' }}>No transactions yet</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 0 }}>
                {histGrouped.map(group => {
                  const total   = group.entries.reduce((s, t) => s + t.amount, 0);
                  const waste   = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
                  const isOpen  = expandedGroups.has(group.label);
                  const isToday = group.label === TODAY_LABEL;
                  return (
                    <div key={group.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* Group header — clickable */}
                      <button
                        onClick={() => toggleGroup(group.label)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: isToday ? '#F0FDF4' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12, fontFamily: 'inherit', borderLeft: isToday ? '3px solid #16A34A' : '3px solid transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          {isOpen ? <ChevronDown size={14} style={{ color: '#64748B', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#64748B', flexShrink: 0 }} />}
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{group.label}</span>
                          {isToday && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {waste > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                              <Flame size={11} />{formatAmount(waste)}
                            </div>
                          )}
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{formatAmount(total)}</span>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>{group.entries.length} items</span>
                        </div>
                      </button>

                      {/* Expanded entries */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #F1F5F9' }}>
                          {group.entries.map((txn, i) => {
                            const m = TYPE_META[txn.type] || TYPE_META.expense;
                            const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                            return (
                              <div key={txn.id} onClick={() => handleTxnTap(txn)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px 9px 44px', borderBottom: i < group.entries.length - 1 ? '1px solid #F8FAFC' : 'none', background: isWasted ? '#FEF2F2' : 'transparent', cursor: txn.type === 'expense' ? 'pointer' : 'default', borderLeft: isWasted ? '3px solid #DC2626' : '3px solid transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                                  <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.name}</span>
                                  {isWasted && (
                                    <span style={{ fontSize: 10, color: '#DC2626', flexShrink: 0 }}>
                                      🔥 {txn.wasteAmount === txn.amount ? 'Full' : formatAmount(txn.wasteAmount)}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: m.color, flexShrink: 0, marginLeft: 8 }}>{formatAmount(txn.amount)}</span>
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
