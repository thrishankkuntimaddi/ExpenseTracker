import { useState, useMemo } from 'react';
import { PenLine, IndianRupee, Wallet, Trash2, TrendingUp, CalendarDays, Calendar, Pencil, ArrowRightLeft, HandCoins, ClipboardList } from 'lucide-react';
import { isCarryForward } from '../../utils/carryForward';
import { formatAmount, groupByDay } from '../../utils/dateHelpers';
import { sumAmounts } from '../../utils/finance';
import { filterItemsByPeriod } from '../../utils/periodHelpers';
import { useViewMonth, monthName } from '../../app/month';
import EditIncomeModal from '../../components/EditIncomeModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { useStats } from '../../hooks/useStats';
import { PageHeader, HeaderAction } from '../../components/Page';
import { Plus } from 'lucide-react';
import { useShell } from '../../app/shellContext';
import EntryAmount from '../../components/EntryAmount';

export default function IncomeTab({
  income: rawIncome = [], onUpdateIncome, onDeleteIncome,
  selectedPeriod: periodProp,
  transactions = [], onDeleteTransaction, theme, settings,
}) {
  const { month, period: selectedPeriod } = useViewMonth(periodProp);
  // `income` here includes the synthetic carry-forward lines; rawIncome is what is stored
  const { income } = useStats(transactions, rawIncome, selectedPeriod, theme, settings);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [deletingTxnId, setDeletingTxnId] = useState(null);


  // Filter income by selected period
  const filtInc = useMemo(
    () => filterItemsByPeriod(income, selectedPeriod),
    [income, selectedPeriod]
  );
  const filtTxns = useMemo(
    () => filterItemsByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod]
  );


  const totalIncome = sumAmounts(filtInc);

  const borrowedTxns = useMemo(
    () => filtTxns.filter(t => t.type === 'person' && t.direction === 'borrowed'),
    [filtTxns]
  );

  const combinedItems = useMemo(() => {
    const incList = filtInc.map(i => ({ ...i, isBorrowed: !!i.isBorrowed, isRepaymentRec: !!i.isRepaymentRec }));
    const borList = borrowedTxns.map(t => ({ ...t, isBorrowed: true }));
    return [...incList, ...borList].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filtInc, borrowedTxns]);

  const grouped = useMemo(() => groupByDay(combinedItems), [combinedItems]);

  // Totals by kind, and where income comes from (by name), for the period
  const kindTotals = useMemo(() => {
    const t = { income: 0, borrowed: 0, repayment: 0 };
    combinedItems.forEach((i) => { t[i.isRepaymentRec ? 'repayment' : i.isBorrowed ? 'borrowed' : 'income'] += Number(i.amount) || 0; });
    return t;
  }, [combinedItems]);
  const bySource = useMemo(() => {
    const m = {};
    filtInc.forEach((i) => { const k = (i.name || 'Other').trim(); m[k] = m[k] ?? { name: k, amount: 0, count: 0 }; m[k].amount += Number(i.amount) || 0; m[k].count += 1; });
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  }, [filtInc]);
  const periodLabel = monthName(month);
  const shell = useShell();


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
          title="Delete this entry?"
          message="It moves to Recently Deleted (Settings), where you can restore it."
          onConfirm={() => { onDeleteIncome(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
      {deletingTxnId && (
        <ConfirmDeleteModal
          title="Delete this entry?"
          message="It moves to Recently Deleted (Settings), where you can restore it."
          onConfirm={() => { onDeleteTransaction?.(deletingTxnId); setDeletingTxnId(null); }}
          onCancel={() => setDeletingTxnId(null)}
        />
      )}

      {/* Header */}
      <PageHeader title="Money in" subtitle="Everything that reached your account — earned, borrowed, paid back" month
        actions={shell && <HeaderAction id="income-add" Icon={Plus} label="Add" onClick={() => shell.openAdd('income')} />} />

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="income-layout">

          {/* Summary: period total, this month, where it comes from */}
          <div className="income-left" style={{ padding: '16px 16px 4px' }}>
            <div className="hero-card hero-income" style={{ borderRadius: 22, padding: '16px 18px', color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Received · {periodLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 2 }}>{formatAmount(totalIncome)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                <HeroFigure label="Earned" value={formatAmount(kindTotals.income)} />
                <HeroFigure label="Borrowed" value={formatAmount(kindTotals.borrowed)} />
                <HeroFigure label="Paid back to you" value={formatAmount(kindTotals.repayment)} />
              </div>
            </div>

            {bySource.length > 0 && (
              <>
                <p className="section-label" style={{ margin: '18px 4px 8px' }}>By source</p>
                <div className="card" style={{ padding: '4px 14px' }}>
                  {bySource.slice(0, 5).map((src, i) => (
                    <div key={src.name} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{src.count}×</span>
                        <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--income)', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(src.amount)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: 'var(--surface2)', marginTop: 7, overflow: 'hidden' }}>
                        <div style={{ width: `${totalIncome > 0 ? (src.amount / totalIncome) * 100 : 0}%`, height: '100%', borderRadius: 99, background: 'var(--income)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ height: 14 }} />
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
                              background: isCarryForward(entry) ? 'var(--accent-bg)' : entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isCarryForward(entry)
                                ? <ArrowRightLeft size={14} style={{ color: 'var(--accent)' }} />
                                : <TrendingUp size={14} style={{ color: entry.isBorrowed ? 'var(--person)' : 'var(--income)' }} />}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                  fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                  background: isCarryForward(entry) ? 'var(--accent-bg)' : entry.isRepaymentRec ? '#d1fae5' : entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                                  color: isCarryForward(entry) ? 'var(--accent)' : entry.isRepaymentRec ? '#059669' : entry.isBorrowed ? 'var(--person)' : 'var(--income)',
                                }}>
                                  {isCarryForward(entry) ? '↪ Carry forward' : entry.isRepaymentRec ? 'Got back' : entry.isBorrowed ? 'Borrowed' : 'Income'}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                  {entry.name}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isCarryForward(entry) ? 'var(--accent)' : entry.isRepaymentRec ? '#059669' : entry.isBorrowed ? 'var(--person)' : 'var(--income)' }}>
                              <EntryAmount entry={entry} amount={Math.abs(entry.amount)} prefix={entry.amount < 0 ? '−' : '+'} />
                            </span>

                            {isCarryForward(entry) && (
                              <span title="Computed from the previous month's remaining balance. Change it in Settings → Carry forward." style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: 'var(--surface2)' }}>auto</span>
                            )}

                            {/* Edit button for all entries (Income, Borrowed, Repayment Rec) */}
                            {onUpdateIncome && !isCarryForward(entry) && (
                              <button onClick={() => setEditingEntry(entry)}
                                style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--income)'; e.currentTarget.style.background = 'var(--income-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                                <Pencil size={12} />
                              </button>
                            )}
                            {!isCarryForward(entry) && <button
                              onClick={() => {
                                if (income.some(i => i.id === entry.id)) {
                                  setDeletingId(entry.id);
                                } else if (transactions.some(t => t.id === entry.id)) {
                                  setDeletingTxnId(entry.id);
                                } else {
                                  setDeletingId(entry.id);
                                }
                              }}
                              style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                              <Trash2 size={12} />
                            </button>}
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
          .income-right  { padding: 0 16px 24px !important; }
        }
      `}</style>
    </div>
  );
}

function HeroFigure({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}
