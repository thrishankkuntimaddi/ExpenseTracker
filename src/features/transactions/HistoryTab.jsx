import { useState, useMemo } from 'react';
import { LayoutList, Flame, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import PeriodSelector from '../../components/PeriodSelector';
import { useWastage } from '../../hooks/useWastage';
import { useTransactions } from '../../hooks/useTransactions';
import { TYPE_META } from '../../utils/typeConfig';


export default function HistoryTab({
  transactions, income = [], selectedPeriod, onPeriodChange,
  onUpdateTransaction, onDeleteTransaction,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = useWastage(onUpdateTransaction);

  /* ─ Filter & group — shared hook eliminates the duplicate useMemo blocks ─ */
  const { filtTxns, grouped, grouping } = useTransactions(transactions, selectedPeriod);

  const periodTotals = useMemo(() => ({
    expense: filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    savings: filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    person:  filtTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0),
    waste:   filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0),
  }), [filtTxns]);

  /* ─ Wastage — delegated to useWastage hook ─ */

  function toggleGroup(label) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  const groupLabel = grouping === 'month' ? 'Grouped by month'
    : grouping === 'week' ? 'Grouped by week'
    : 'Grouped by day';

  return (
    <div className="tab-root">

      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              History
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {groupLabel} · {filtTxns.length} transactions
            </p>
          </div>
        </div>

        {/* Period selector */}
        <PeriodSelector
          period={selectedPeriod}
          onChange={onPeriodChange}
          transactions={transactions}
          income={income}
        />

        {/* Period summary strip */}
        {filtTxns.length > 0 && (
          <div style={{
            display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap',
          }}>
            <MiniChip label="Spent"  val={periodTotals.expense} color="var(--expense)" bg="var(--expense-bg)"  />
            <MiniChip label="Saved"  val={periodTotals.savings} color="var(--savings)" bg="var(--savings-bg)"  />
            <MiniChip label="Given"  val={periodTotals.person}  color="var(--person)"  bg="var(--person-bg)"   />
            {periodTotals.waste > 0 && (
              <MiniChip label="🔥 Waste" val={periodTotals.waste} color="var(--expense)" bg="var(--expense-bg)" />
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="tab-body">

        {grouped.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="history-grid">
            {grouped.map(group => {
              const total    = group.entries.reduce((s, t) => s + t.amount, 0);
              const waste    = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
              const isCollapsed = collapsedGroups.has(group.label);

              return (
                <div key={group.label} style={{ marginBottom: 16 }}>
                  {/* Group header — tappable to collapse */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 6,
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      padding: '4px 2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isCollapsed
                        ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronUp   size={13} style={{ color: 'var(--text-muted)' }} />
                      }
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {group.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ({group.entries.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {waste > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, padding: '2px 7px',
                          borderRadius: 20, background: 'var(--expense-bg)', color: 'var(--expense)',
                        }}>
                          <Flame size={10} />{formatAmount(waste)}
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {formatAmount(total)}
                      </span>
                    </div>
                  </button>

                  {/* Group card */}
                  {!isCollapsed && (
                    <div className="card">
                      {group.entries.map((txn, i) => {
                        const meta      = TYPE_META[txn.type] || TYPE_META.expense;
                        const isWasted  = txn.wasteAmount != null && txn.wasteAmount > 0;
                        const isEditing = editingWaste === txn.id;
                        const isFullWaste = txn.wasteAmount === txn.amount;

                        return (
                          <div key={txn.id}>
                            <div
                              onClick={txn.type === 'expense' ? () => handleTxnTap(txn) : undefined}
                              onDoubleClick={e => e.preventDefault()}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 14px',
                                cursor: txn.type === 'expense' ? 'pointer' : 'default',
                                background: isWasted ? 'var(--expense-bg)' : 'transparent',
                                borderLeft: isWasted ? '3px solid var(--expense)' : '3px solid transparent',
                                borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                                userSelect: 'none',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{
                                  fontSize: 10, padding: '3px 7px', borderRadius: 6,
                                  fontWeight: 700, background: meta.bg, color: meta.color, flexShrink: 0,
                                }}>
                                  {meta.label}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <span style={{
                                    fontSize: 13, fontWeight: 500, color: 'var(--text)',
                                    display: 'block', overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {txn.name}
                                  </span>
                                  {txn.type === 'external' ? (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {txn.externalSource ? `${txn.externalSource} · ` : ''}Paid {formatAmount(txn.amount)} · Rcvd {formatAmount(txn.settlement ?? 0)}
                                    </span>
                                  ) : isWasted ? (
                                    <span style={{ fontSize: 11, color: 'var(--expense)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Flame size={10} />
                                      {isFullWaste ? 'Full waste' : `Waste: ${formatAmount(txn.wasteAmount)}`}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {txn.type === 'external' ? (() => {
                                  const profit = (txn.settlement ?? txn.amount) - txn.amount;
                                  return (
                                    <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? '#16A34A' : '#DC2626', marginLeft: 8 }}>
                                      {profit >= 0 ? '+' : ''}{formatAmount(profit)}
                                    </span>
                                  );
                                })() : (
                                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color, marginLeft: 8 }}>
                                    {formatAmount(txn.amount)}
                                  </span>
                                )}
                                {onDeleteTransaction && (
                                  <button
                                    onClick={e => { e.stopPropagation(); onDeleteTransaction(txn.id); }}
                                    style={{
                                      width: 24, height: 24, borderRadius: 6,
                                      background: 'transparent', border: 'none',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: 'var(--text-muted)', cursor: 'pointer',
                                      transition: 'color 0.15s, background 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.color = 'var(--expense)';
                                      e.currentTarget.style.background = 'var(--expense-bg)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.color = 'var(--text-muted)';
                                      e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditing && txn.type === 'expense' && (
                              <div style={{
                                display: 'flex', gap: 8, alignItems: 'center',
                                padding: '10px 14px',
                                background: 'var(--expense-bg)',
                                borderTop: '1px solid var(--expense-border)',
                              }}>
                                <input
                                  ref={wasteInputRef}
                                  type="number"
                                  placeholder="Waste amount"
                                  value={wasteInput}
                                  onChange={e => setWasteInput(e.target.value)}
                                  inputMode="decimal"
                                  style={{
                                    flex: 1, padding: '8px 10px', borderRadius: 8,
                                    fontSize: 13, border: '1.5px solid var(--expense)',
                                    background: 'var(--input-bg)', color: 'var(--text)',
                                    outline: 'none', fontFamily: 'inherit',
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveWaste(txn);
                                    if (e.key === 'Escape') cancelWaste();
                                  }}
                                />
                                <button
                                  onClick={() => saveWaste(txn)}
                                  style={{
                                    padding: '7px 12px', borderRadius: 8,
                                    fontSize: 12, fontWeight: 700,
                                    background: 'var(--expense)', color: '#fff',
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelWaste}
                                  style={{
                                    padding: '7px 10px', borderRadius: 8,
                                    fontSize: 12, fontWeight: 600,
                                    background: 'var(--surface2)', color: 'var(--text-secondary)',
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isCollapsed && (
                    <p style={{
                      fontSize: 10, marginTop: 5, paddingLeft: 2,
                      color: 'var(--text-muted)',
                    }}>
                      Tap expense to toggle waste · Double-tap for custom amount
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; }
        }
      `}</style>
    </div>
  );
}

function MiniChip({ label, val, color, bg }) {
  if (!val) return null;
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 8,
      background: bg, fontSize: 11, fontWeight: 600, color,
    }}>
      {label}: {formatAmount(val)}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60%', gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <LayoutList size={26} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          No transactions in this period
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Try a different time range
        </p>
      </div>
    </div>
  );
}
