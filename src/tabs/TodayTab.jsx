import { useRef, useState } from 'react';
import { PenLine, IndianRupee, ShoppingCart, Users, PiggyBank } from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount } from '../utils/dateHelpers';

const TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)',  Icon: Users       },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank   },
];

export default function TodayTab({ transactions, onAdd }) {
  const [name, setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType]   = useState('expense');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  const todayTxns = transactions.filter(t => {
    const d = new Date(t.date), now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });

  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todaySavings = todayTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const todayPerson  = todayTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);

  function handleNameKey(e)   { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); } }
  function handleAmountKey(e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
  function handleAmountInput(e) { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }

  function save() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || !amount || isNaN(a) || a <= 0) return;
    onAdd({ id: generateId(), name: n, amount: a, type, date: new Date().toISOString(), month: new Date().toISOString().slice(0, 7), wasteAmount: undefined });
    setName(''); setAmount('');
    nameRef.current?.focus();
  }

  const sel = TYPES.find(t => t.key === type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Today</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Body: responsive two-column on desktop ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 0 }}>

        {/* LEFT / FULL column: entry form */}
        <div className="today-form-col" style={{ flex: '0 0 100%', padding: '20px 20px 0' }}>

          {/* Summary Chips */}
          {(todayExpense > 0 || todaySavings > 0 || todayPerson > 0) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <SummaryChip label="Spent"  value={todayExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" />
              <SummaryChip label="Saved"  value={todaySavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" />
              <SummaryChip label="Given"  value={todayPerson}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  />
            </div>
          )}

          {/* Entry Card */}
          <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: 20, marginBottom: 20 }}>

            {/* Type Segmented Control */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--surface2)', borderRadius: 14, padding: 4, marginBottom: 18, border: '1px solid var(--border)' }}>
              {TYPES.map(t => (
                <button
                  key={t.key}
                  id={`type-${t.key}`}
                  onClick={() => setType(t.key)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: type === t.key ? t.color : 'transparent',
                    color: type === t.key ? '#fff' : 'var(--text-secondary)',
                    boxShadow: type === t.key ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <t.Icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Name */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <PenLine size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                id="input-name"
                ref={nameRef}
                type="text"
                placeholder="Description (e.g. Coffee, Rent…)"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleNameKey}
                autoComplete="off"
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                  borderRadius: 12, fontSize: 14, border: '1.5px solid var(--border)',
                  background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = sel.color)}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Amount */}
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <IndianRupee size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                id="input-amount"
                ref={amountRef}
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountInput}
                onKeyDown={handleAmountKey}
                inputMode="decimal"
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                  borderRadius: 12, fontSize: 18, fontWeight: 700, border: '1.5px solid var(--border)',
                  background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = sel.color)}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Save Button */}
            <button
              id="btn-save-entry"
              onClick={save}
              disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 600,
                background: sel.color, color: '#fff', border: 'none', cursor: 'pointer',
                opacity: (!name.trim() || !amount || parseFloat(amount) <= 0) ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              Add {sel.label}
            </button>
          </div>
        </div>

        {/* RIGHT / FULL: entries list */}
        <div className="today-entries-col" style={{ flex: '0 0 100%', padding: '0 20px 20px' }}>
          {todayTxns.length > 0 ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Today's Entries
              </p>
              <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {todayTxns.slice().reverse().map((txn, i) => {
                  const t = TYPES.find(x => x.key === txn.type);
                  return (
                    <div key={txn.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderBottom: i < todayTxns.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, padding: '4px 8px', borderRadius: 8, fontWeight: 600,
                          background: t.bg, color: t.color, flexShrink: 0,
                        }}>
                          <t.Icon size={11} />{t.label}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {txn.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.color, marginLeft: 12, flexShrink: 0 }}>
                        {formatAmount(txn.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--expense-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={26} style={{ color: 'var(--expense)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>No transactions yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Start tracking your spending</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Desktop two-column override via CSS ── */}
      <style>{`
        @media (min-width: 1024px) {
          .today-form-col    { flex: 0 0 400px !important; max-width: 400px; padding: 24px !important; }
          .today-entries-col { flex: 1 1 0% !important; padding: 24px 24px 24px 0 !important; overflow-y: auto; }
        }
      `}</style>
    </div>
  );
}

function SummaryChip({ label, value, color, bg, border }) {
  if (value === 0) return null;
  return (
    <div style={{ borderRadius: 10, padding: '8px 14px', background: bg, border: `1px solid ${border}` }}>
      <span style={{ fontSize: 11, fontWeight: 600, color, marginRight: 6 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{formatAmount(value)}</span>
    </div>
  );
}
