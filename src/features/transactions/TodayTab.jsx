import { useRef, useState } from 'react';
import {
  PenLine, IndianRupee, ShoppingCart, Users, PiggyBank,
  Zap, TrendingDown, Coins
} from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount } from '../../utils/dateHelpers';

const TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)',  Icon: Users       },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank   },
];

function AppHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--accent)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}>
        <Zap size={18} color="#fff" strokeWidth={2.5} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          Expense Tracker
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
          Smart Financial Tracking
        </div>
      </div>
    </div>
  );
}

export default function TodayTab({ transactions, onAdd }) {
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType]     = useState('expense');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  const now = new Date();
  const todayTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  });

  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todaySavings = todayTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const todayPerson  = todayTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
  const todayTotal   = todayExpense + todaySavings + todayPerson;

  function handleNameKey(e)   { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); } }
  function handleAmountKey(e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
  function handleAmountInput(e) {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
  }

  function save() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || !amount || isNaN(a) || a <= 0) return;
    onAdd({
      id: generateId(), name: n, amount: a, type,
      date: new Date().toISOString(),
      month: new Date().toISOString().slice(0, 7),
      wasteAmount: undefined,
    });
    setName(''); setAmount('');
    nameRef.current?.focus();
  }

  const sel = TYPES.find(t => t.key === type);
  const canSave = !!name.trim() && !!amount && parseFloat(amount) > 0;

  return (
    <div className="tab-root">

      {/* ── Header ── */}
      <div className="tab-header">
        <AppHeader />

        {/* Date Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              {now.toLocaleDateString('en-IN', { year: 'numeric' })}
            </div>
          </div>

          {/* Today's total pill */}
          {todayTotal > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--expense-bg)', border: '1px solid var(--expense-border)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <TrendingDown size={12} style={{ color: 'var(--expense)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--expense)' }}>
                {formatAmount(todayTotal)}
              </span>
            </div>
          )}
        </div>

        {/* ── Summary Chips — placed right under date ── */}
        {(todayExpense > 0 || todaySavings > 0 || todayPerson > 0) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <SummaryChip label="Spent"  value={todayExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={ShoppingCart} />
            <SummaryChip label="Saved"  value={todaySavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />
            <SummaryChip label="Given"  value={todayPerson}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}        />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Entry Form Column */}
        <div className="today-form-col" style={{ flex: '0 0 100%', padding: '16px 20px 0' }}>

          {/* Type Selector */}
          <div style={{
            display: 'flex', gap: 0,
            background: 'var(--surface2)',
            borderRadius: 14, padding: 4, marginBottom: 14,
            border: '1px solid var(--border)',
          }}>
            {TYPES.map(t => (
              <button
                key={t.key}
                id={`type-${t.key}`}
                onClick={() => setType(t.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 4px', borderRadius: 10,
                  fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: type === t.key ? t.color : 'transparent',
                  color: type === t.key ? '#fff' : 'var(--text-secondary)',
                  boxShadow: type === t.key ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <t.Icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Entry Card */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 16,
            border: `1.5px solid ${sel.border}`,
            boxShadow: 'var(--shadow)',
            padding: 16,
            marginBottom: 16,
          }}>
            {/* Type indicator band */}
            <div style={{
              height: 3, borderRadius: 99, background: sel.color,
              marginBottom: 14, opacity: 0.7,
            }} />

            {/* Name */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <PenLine size={14} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                id="input-name"
                ref={nameRef}
                type="text"
                placeholder="What did you spend on?"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleNameKey}
                autoComplete="off"
                style={{
                  width: '100%', paddingLeft: 38, paddingRight: 14,
                  paddingTop: 12, paddingBottom: 12,
                  borderRadius: 10, fontSize: 14,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text)', outline: 'none',
                  fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = sel.color)}
                onBlur={e =>  (e.target.style.borderColor = 'var(--input-border)')}
              />
            </div>

            {/* Amount */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <IndianRupee size={14} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
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
                  width: '100%', paddingLeft: 38, paddingRight: 14,
                  paddingTop: 12, paddingBottom: 12,
                  borderRadius: 10, fontSize: 22, fontWeight: 700,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text)', outline: 'none',
                  fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = sel.color)}
                onBlur={e =>  (e.target.style.borderColor = 'var(--input-border)')}
              />
            </div>

            {/* Save Button */}
            <button
              id="btn-save-entry"
              onClick={save}
              disabled={!canSave}
              style={{
                width: '100%', padding: '13px',
                borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: canSave ? sel.color : 'var(--surface2)',
                color: canSave ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                letterSpacing: '0.01em',
              }}
            >
              Add {sel.label}
            </button>
          </div>
        </div>

        {/* Entries List Column */}
        <div className="today-entries-col" style={{ flex: '0 0 100%', padding: '0 20px 20px' }}>
          {todayTxns.length > 0 ? (
            <>
              <p className="section-label" style={{ marginBottom: 10 }}>
                Today's Entries — {todayTxns.length}
              </p>
              <div className="card">
                {todayTxns.slice().reverse().map((txn, i) => {
                  const t = TYPES.find(x => x.key === txn.type);
                  return (
                    <div key={txn.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 16px',
                      borderBottom: i < todayTxns.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: t.bg, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <t.Icon size={14} style={{ color: t.color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 500, color: 'var(--text)',
                            display: 'block', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {txn.name}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {t.label}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: t.color, marginLeft: 12, flexShrink: 0,
                      }}>
                        {formatAmount(txn.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '32px 20px', gap: 12,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Coins size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Nothing logged yet
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Add your first entry above
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .today-form-col    { flex: 0 0 400px !important; padding: 24px !important; }
          .today-entries-col { flex: 1 1 0% !important; padding: 24px 24px 24px 0 !important; overflow-y: auto; }
        }
      `}</style>
    </div>
  );
}

function SummaryChip({ label, value, color, bg, border, Icon }) {
  if (value === 0) return null;
  return (
    <div style={{
      borderRadius: 10, padding: '7px 12px',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon size={12} style={{ color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{formatAmount(value)}</span>
    </div>
  );
}
