import { useRef, useState } from 'react';
import { PenLine, IndianRupee, ShoppingCart, Users, PiggyBank } from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount } from '../utils/dateHelpers';

const TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person', label: 'Person', color: 'var(--person)', bg: 'var(--person-bg)', border: 'var(--person-border)', Icon: Users },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank },
];

export default function TodayTab({ transactions, onAdd }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const nameRef = useRef(null);
  const amountRef = useRef(null);

  const todayTxns = transactions.filter(t => {
    const d = new Date(t.date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todaySavings = todayTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const todayPerson  = todayTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);

  function handleNameKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); }
  }
  function handleAmountKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
  }
  function handleAmountInput(e) {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val);
  }

  function save() {
    const trimName = name.trim();
    const parsedAmount = parseFloat(amount);
    if (!trimName || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    onAdd({ id: generateId(), name: trimName, amount: parsedAmount, type, date: new Date().toISOString(), wasteAmount: undefined });
    setName('');
    setAmount('');
    nameRef.current?.focus();
  }

  const sel = TYPES.find(t => t.key === type);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Today</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Today Summary Pills ── */}
      {(todayExpense > 0 || todaySavings > 0 || todayPerson > 0) && (
        <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
          <SummaryPill label="Spent" value={todayExpense} color="var(--expense)" bg="var(--expense-bg)" />
          <SummaryPill label="Saved" value={todaySavings} color="var(--savings)" bg="var(--savings-bg)" />
          <SummaryPill label="Given" value={todayPerson}  color="var(--person)"  bg="var(--person-bg)" />
        </div>
      )}

      {/* ── Entry Card ── */}
      <div className="mx-5 mb-5 rounded-2xl p-5" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>

        {/* Type Segmented Control */}
        <div className="flex rounded-xl mb-5 p-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          {TYPES.map(t => (
            <button
              key={t.key}
              id={`type-${t.key}`}
              onClick={() => setType(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={type === t.key
                ? { background: t.color, color: '#fff', boxShadow: 'var(--shadow-sm)' }
                : { background: 'transparent', color: 'var(--text-secondary)' }
              }
            >
              <t.Icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Name Field */}
        <div className="relative mb-3">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <PenLine size={15} />
          </div>
          <input
            id="input-name"
            ref={nameRef}
            type="text"
            placeholder="Description (e.g. Coffee, Rent…)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleNameKey}
            autoComplete="off"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
            style={{ background: '#fff', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            onFocus={e => (e.target.style.borderColor = sel.color)}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Amount Field */}
        <div className="relative mb-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <IndianRupee size={15} />
          </div>
          <input
            id="input-amount"
            ref={amountRef}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountInput}
            onKeyDown={handleAmountKey}
            inputMode="decimal"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all duration-150"
            style={{ background: '#fff', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            onFocus={e => (e.target.style.borderColor = sel.color)}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Save Button */}
        <button
          id="btn-save-entry"
          onClick={save}
          disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
          className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: sel.color, color: '#fff', minHeight: 48 }}
        >
          Add {sel.label}
        </button>
      </div>

      {/* ── Today Entries ── */}
      {todayTxns.length > 0 ? (
        <div className="mx-5 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Today's Entries
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {todayTxns.slice().reverse().map((txn, i) => {
              const t = TYPES.find(x => x.key === txn.type);
              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: i < todayTxns.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold shrink-0"
                      style={{ background: t.bg, color: t.color }}>
                      <t.Icon size={11} /> {t.label}
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{txn.name}</span>
                  </div>
                  <span className="text-sm font-bold ml-3 shrink-0" style={{ color: t.color }}>{formatAmount(txn.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center pb-16 gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--expense-bg)' }}>
            <ShoppingCart size={28} style={{ color: 'var(--expense)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No transactions yet</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Start tracking your spending</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, color, bg }) {
  if (value === 0) return null;
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}33` }}>
      <div className="text-xs font-medium mb-0.5" style={{ color }}>{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{formatAmount(value)}</div>
    </div>
  );
}
