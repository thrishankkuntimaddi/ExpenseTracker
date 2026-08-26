import { useRef, useState, useMemo } from 'react';
import { PenLine, IndianRupee, Wallet, Trash2, TrendingUp, CalendarDays, Calendar, Pencil } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, groupByDay, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { filterItemsByPeriod, getCurrentMonthValue } from '../../utils/periodHelpers';
import PeriodSelector from '../../components/PeriodSelector';
import EditIncomeModal from '../../components/EditIncomeModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

export default function IncomeTab({
  income = [], onAddIncome, onUpdateIncome, onDeleteIncome,
  selectedPeriod, onPeriodChange,
  transactions = [], onAddTransaction, onDeleteTransaction,
}) {
  const [incMode, setIncMode]     = useState('income'); // 'income' | 'borrowed'
  const [name, setName]           = useState('');
  const [amount, setAmount]       = useState('');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);

  const nameRef   = useRef(null);
  const amountRef = useRef(null);

  // Filter income by selected period
  const filtInc = useMemo(
    () => filterItemsByPeriod(income, selectedPeriod),
    [income, selectedPeriod]
  );
  const filtTxns = useMemo(
    () => filterItemsByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod]
  );

  const currentMonth = getCurrentMonthValue();

  const totalIncome = filtInc.reduce((s, i) => s + i.amount, 0);
  const pureIncome  = filtInc.filter(i => !i.isBorrowed && !i.isRepaymentRec).reduce((s, i) => s + i.amount, 0);
  const borrowedInc = filtInc.filter(i => i.isBorrowed).reduce((s, i) => s + i.amount, 0);
  const repaymentRecInc = filtInc.filter(i => i.isRepaymentRec).reduce((s, i) => s + i.amount, 0);

  const borrowedTxns = useMemo(
    () => filtTxns.filter(t => t.type === 'person' && t.direction === 'borrowed'),
    [filtTxns]
  );

  const combinedItems = useMemo(() => {
    const incList = filtInc.map(i => ({ ...i, isBorrowed: !!i.isBorrowed }));
    const borList = borrowedTxns.map(t => ({ ...t, isBorrowed: true }));
    return [...incList, ...borList].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filtInc, borrowedTxns]);

  const grouped = useMemo(() => groupByDay(combinedItems), [combinedItems]);

  const thisMonthIncome = income
    .filter(i => i.date?.slice(0, 7) === currentMonth)
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
    const isoDate = dateInputToISO(dateInput);
    onAddIncome({
      id: generateId(),
      name: n,
      amount: a,
      type: 'income',
      isBorrowed: incMode === 'borrowed',
      date: isoDate,
      month: isoToMonth(isoDate),
    });
    setName(''); setAmount(''); setDateInput(todayInputValue());
    nameRef.current?.focus();
  }

  const canSave = !!name.trim() && !!amount && parseFloat(amount) > 0;

  return (
    <div className="tab-root">
      {/* Edit modal */}
      {editingEntry && (
        <EditIncomeModal
          entry={editingEntry}
          onSave={onUpdateIncome}
          onDelete={onDeleteIncome}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <ConfirmDeleteModal
          title="Delete income entry?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteIncome(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}

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
                  {filtInc.length} income {filtInc.length === 1 ? 'entry' : 'entries'}
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
              {/* 2-way mode toggle */}
              <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 10, padding: 3, marginBottom: 14, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIncMode('income')}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: incMode === 'income' ? 'var(--income)' : 'transparent',
                    color: incMode === 'income' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  💰 Income
                </button>
                <button
                  type="button"
                  onClick={() => setIncMode('borrowed')}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: incMode === 'borrowed' ? 'var(--person)' : 'transparent',
                    color: incMode === 'borrowed' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  🤝 Borrowed
                </button>
              </div>

              {/* Name */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <PenLine size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-name" ref={nameRef} type="text"
                  placeholder={incMode === 'income' ? 'Source (Salary, Freelance…)' : 'Person Name'}
                  value={name}
                  onChange={e => setName(e.target.value)} onKeyDown={handleNameKey} autoComplete="off"
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = incMode === 'income' ? 'var(--income)' : 'var(--person)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>

              {/* Amount */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <IndianRupee size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="income-input-amount" ref={amountRef} type="text"
                  placeholder="0.00" value={amount}
                  onChange={handleAmountInput} onKeyDown={handleAmountKey} inputMode="decimal"
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 20, fontWeight: 700, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = incMode === 'income' ? 'var(--income)' : 'var(--person)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>

              {/* Date */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="date"
                  value={dateInput}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDateInput(e.target.value)}
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = incMode === 'income' ? 'var(--income)' : 'var(--person)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>

              <button id="btn-save-income" onClick={save} disabled={!canSave}
                style={{
                  width: '100%', padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: canSave ? (incMode === 'income' ? 'var(--income)' : 'var(--person)') : 'var(--surface2)',
                  color: canSave ? '#fff' : 'var(--text-muted)', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                {incMode === 'income' ? 'Add Income ↵' : 'Add Borrowed Money ↵'}
              </button>

              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
              </div>
            </div>
          </div>

          {/* RIGHT: Income & Borrowed list */}
          <div className="income-right" style={{ padding: '0 20px 20px' }}>
            {combinedItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={22} style={{ color: 'var(--income)' }} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  No income or borrowed money in this period.
                </p>
              </div>
            ) : (
              <>
                <p className="section-label" style={{ marginBottom: 10 }}>Inflows History</p>
                {grouped.map(group => (
                  <div key={group.label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{group.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--income)' }}>
                        +{formatAmount(group.entries.reduce((s, e) => s + e.amount, 0))}
                      </span>
                    </div>
                    <div className="card">
                      {group.entries.map((entry, i) => (
                        <div key={entry.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <TrendingUp size={14} style={{ color: entry.isBorrowed ? 'var(--person)' : 'var(--income)' }} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                  fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                  background: entry.isRepaymentRec ? '#d1fae5' : entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                                  color: entry.isRepaymentRec ? '#059669' : entry.isBorrowed ? 'var(--person)' : 'var(--income)',
                                }}>
                                  {entry.isRepaymentRec ? '⮐ Repayment Rec.' : entry.isBorrowed ? 'Borrowed' : 'Income'}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                  {entry.name}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: entry.isRepaymentRec ? '#059669' : entry.isBorrowed ? 'var(--person)' : 'var(--income)' }}>
                              +{formatAmount(entry.amount)}
                            </span>

                            {/* Quick Repay button for Borrowed entries */}
                            {entry.isBorrowed && onAddTransaction && (
                              <button
                                onClick={() => {
                                  onAddTransaction({
                                    id: generateId(),
                                    name: entry.name,
                                    amount: entry.amount,
                                    type: 'person',
                                    direction: 'repaid',
                                    date: new Date().toISOString(),
                                    month: isoToMonth(new Date().toISOString()),
                                  });
                                }}
                                style={{
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                  background: 'var(--person-bg)', border: '1px solid var(--person-border)',
                                  color: 'var(--person)', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                                title="Repay this debt"
                              >
                                Repay
                              </button>
                            )}

                            {!entry.isBorrowed && onUpdateIncome && (
                              <button onClick={() => setEditingEntry(entry)}
                                style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--income)'; e.currentTarget.style.background = 'var(--income-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                                <Pencil size={12} />
                              </button>
                            )}
                            {((!entry.isBorrowed && !entry.isRepaymentRec && onDeleteIncome) || (entry.isBorrowed && onDeleteTransaction)) && (
                              <button
                                onClick={() => {
                                  if (entry.isBorrowed) onDeleteTransaction(entry.id);
                                  else setDeletingId(entry.id);
                                }}
                                style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                            {entry.isRepaymentRec && onDeleteIncome && (
                              <button
                                onClick={() => setDeletingId(entry.id)}
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
