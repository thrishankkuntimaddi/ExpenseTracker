import { useRef, useState, useMemo } from 'react';
import { PenLine, IndianRupee, Wallet, Trash2, TrendingUp, CalendarDays } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, groupByDay, formatDate } from '../../utils/dateHelpers';
import { filterItemsByPeriod } from '../../utils/periodHelpers';
import PeriodSelector from '../../components/PeriodSelector';

export default function IncomeTab({ income, onAddIncome, onDeleteIncome, selectedPeriod, onPeriodChange, transactions }) {
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  // Filter income by selected period
  const filtInc = useMemo(
    () => filterItemsByPeriod(income, selectedPeriod),
    [income, selectedPeriod]
  );

  const totalIncome     = filtInc.reduce((s, i) => s + i.amount, 0);
  const allTimeIncome   = income.reduce((s, i) => s + i.amount, 0);
  const grouped         = groupByDay(filtInc);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthIncome = income.filter(i => i.date?.slice(0, 7) === currentMonth)
    .reduce((s, i) => s + i.amount, 0);

  function handleNameKey(e)   { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); } }
  function handleAmountKey(e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
  function handleAmountInput(e) {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
  }

  function save() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || !amount || isNaN(a) || a <= 0) return;
    onAddIncome({
      id: generateId(), name: n, amount: a, type: 'income',
      date: new Date().toISOString(),
      month: new Date().toISOString().slice(0, 7),
    });
    setName(''); setAmount('');
    nameRef.current?.focus();
  }

  const canSave = !!name.trim() && !!amount && parseFloat(amount) > 0;

  return (
    <div className="tab-root">

      {/* Header */}
      <div className="tab-header">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
          Income
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          Track all your income sources
        </p>
        <div style={{ marginTop: 10 }}>
          <PeriodSelector
            period={selectedPeriod}
            onChange={onPeriodChange}
            transactions={transactions || []}
            income={income}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="income-layout">

          {/* LEFT: Hero + Form */}
          <div className="income-left" style={{ padding: '16px 20px' }}>

            {/* Hero cards row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {/* Period Income */}
              <div style={{
                flex: 1, borderRadius: 16, padding: '16px 18px',
                background: 'var(--income)', boxShadow: 'var(--shadow-md)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)' }}>
                    Period Total
                  </span>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={14} color="#fff" />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
                  {formatAmount(totalIncome)}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  {filtInc.length} entries this period
                </div>
              </div>

              {/* This Month */}
              <div style={{
                flex: 1, borderRadius: 16, padding: '16px 18px',
                background: 'var(--income-bg)', border: '1.5px solid var(--income-border)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--income)' }}>
                    This Month
                  </span>
                  <TrendingUp size={14} style={{ color: 'var(--income)' }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--income)', lineHeight: 1.1 }}>
                  {formatAmount(thisMonthIncome)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Form */}
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1.5px solid var(--income-border)', boxShadow: 'var(--shadow)', padding: 16,
            }}>
              <p className="section-label" style={{ marginBottom: 12 }}>Add Income</p>

              {/* Name */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <PenLine size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-name" ref={nameRef} type="text"
                  placeholder="Source (Salary, Freelance…)" value={name}
                  onChange={e => setName(e.target.value)} onKeyDown={handleNameKey} autoComplete="off"
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>

              {/* Amount */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <IndianRupee size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-amount" ref={amountRef} type="number"
                  placeholder="0.00" value={amount}
                  onChange={handleAmountInput} onKeyDown={handleAmountKey} inputMode="decimal"
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 20, fontWeight: 700, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>

              <button id="btn-save-income" onClick={save} disabled={!canSave}
                style={{ width: '100%', padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, background: canSave ? 'var(--income)' : 'var(--surface2)', color: canSave ? '#fff' : 'var(--text-muted)', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                Add Income
              </button>
            </div>
          </div>

          {/* RIGHT: Income list */}
          <div className="income-right" style={{ padding: '0 20px 20px' }}>
            {filtInc.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={22} style={{ color: 'var(--income)' }} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  No income in this period.
                </p>
              </div>
            ) : (
              <>
                <p className="section-label" style={{ marginBottom: 10 }}>Income History</p>
                {grouped.map(group => (
                  <div key={group.label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{group.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--income)' }}>
                        {formatAmount(group.entries.reduce((s, e) => s + e.amount, 0))}
                      </span>
                    </div>
                    <div className="card">
                      {group.entries.map((entry, i) => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <TrendingUp size={14} style={{ color: 'var(--income)' }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{entry.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--income)' }}>{formatAmount(entry.amount)}</span>
                            {onDeleteIncome && (
                              <button onClick={() => onDeleteIncome(entry.id)}
                                style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .income-layout { display: flex; align-items: flex-start; height: 100%; }
          .income-left   { flex: 0 0 420px; }
          .income-right  { flex: 1; padding: 16px 20px 24px 0 !important; overflow-y: auto; }
        }
        @media (max-width: 1023px) {
          .income-layout { display: block; }
          .income-right  { padding: 0 20px 24px !important; }
        }
      `}</style>
    </div>
  );
}
