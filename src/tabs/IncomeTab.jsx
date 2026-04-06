import { useRef, useState } from 'react';
import { PenLine, IndianRupee, Wallet } from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount, groupByDay } from '../utils/dateHelpers';

export default function IncomeTab({ income, onAddIncome }) {
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const grouped     = groupByDay(income);

  function handleNameKey(e)   { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); } }
  function handleAmountKey(e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
  function handleAmountInput(e) { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }

  function save() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || !amount || isNaN(a) || a <= 0) return;
    onAddIncome({ id: generateId(), name: n, amount: a, type: 'income', date: new Date().toISOString(), month: new Date().toISOString().slice(0, 7) });
    setName(''); setAmount('');
    nameRef.current?.focus();
  }

  const G = 'var(--income)', GB = 'var(--income-bg)', GBR = 'var(--income-border)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Income</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Track all your income sources</p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="income-layout">

          {/* LEFT: Hero + Form */}
          <div className="income-left" style={{ padding: '20px 24px' }}>

            {/* Total Hero */}
            <div style={{ borderRadius: 20, padding: '20px 22px', background: G, boxShadow: 'var(--shadow-md)', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Total Income</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0 }}>{formatAmount(totalIncome)}</p>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={22} color="#fff" />
              </div>
            </div>

            {/* Form */}
            <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: 20 }}>
              {/* Name */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <PenLine size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-name"
                  ref={nameRef}
                  type="text"
                  placeholder="Source (e.g. Salary, Freelance…)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleNameKey}
                  autoComplete="off"
                  style={{ width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13, borderRadius: 12, fontSize: 14, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = G)}
                  onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              {/* Amount */}
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <IndianRupee size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-amount"
                  ref={amountRef}
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={handleAmountInput}
                  onKeyDown={handleAmountKey}
                  inputMode="decimal"
                  style={{ width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13, borderRadius: 12, fontSize: 18, fontWeight: 700, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = G)}
                  onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <button
                id="btn-save-income"
                onClick={save}
                disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                style={{ width: '100%', padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 600, background: G, color: '#fff', border: 'none', cursor: 'pointer', opacity: (!name.trim() || !amount || parseFloat(amount) <= 0) ? 0.4 : 1, fontFamily: 'inherit' }}
              >
                Add Income
              </button>
            </div>
          </div>

          {/* RIGHT: Income list */}
          <div className="income-right" style={{ padding: '20px 24px', paddingLeft: 0 }}>
            {income.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: GB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={22} style={{ color: G }} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No income added yet.</p>
              </div>
            ) : grouped.map(group => (
              <div key={group.label} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{group.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{formatAmount(group.entries.reduce((s, e) => s + e.amount, 0))}</span>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  {group.entries.map((entry, i) => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{entry.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{formatAmount(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .income-layout { display: flex; align-items: flex-start; gap: 0; height: 100%; }
          .income-left   { flex: 0 0 420px; }
          .income-right  { flex: 1; padding: 20px 24px 24px 0 !important; overflow-y: auto; }
        }
        @media (max-width: 1023px) {
          .income-layout { display: block; }
          .income-right  { padding: 0 24px 24px !important; }
        }
      `}</style>
    </div>
  );
}
