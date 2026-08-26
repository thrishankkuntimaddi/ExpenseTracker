import { useState, useMemo } from 'react';
import { LayoutList, Flame, Trash2, ChevronDown, ChevronUp, Upload, Pencil } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import PeriodSelector from '../../components/PeriodSelector';
import { useWastage } from '../../hooks/useWastage';
import { useTransactions } from '../../hooks/useTransactions';
import { TYPE_META, getDirectionMeta } from '../../utils/typeConfig';
import LoadMonthlyData from '../../components/LoadMonthlyData';
import EditTransactionModal from '../../components/EditTransactionModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

export default function HistoryTab({
  transactions, income = [], selectedPeriod, onPeriodChange,
  onUpdateTransaction, onDeleteTransaction,
  onAddTransaction, onAddIncome,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [showImport, setShowImport]           = useState(false);
  const [editingTxn, setEditingTxn]         = useState(null);
  const [deletingId, setDeletingId]         = useState(null);

  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = useWastage(onUpdateTransaction);

  /* ─ Filter & group ─ */
  const { filtTxns, grouped, grouping } = useTransactions(transactions, selectedPeriod);

  const periodTotals = useMemo(() => ({
    expense: filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    savings: filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    person:  filtTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0),
    waste:   filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0),
  }), [filtTxns]);

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
      {/* Edit modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onSave={onUpdateTransaction}
          onDelete={onDeleteTransaction}
          onClose={() => setEditingTxn(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <ConfirmDeleteModal
          title="Delete transaction?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteTransaction(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Load Past Data modal */}
      {showImport && onAddTransaction && onAddIncome && (
        <LoadMonthlyData
          onAddTransaction={onAddTransaction}
          onAddIncome={onAddIncome}
          onClose={() => setShowImport(false)}
          transactions={transactions}
          income={income}
        />
      )}

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
          {/* Load Past Data button */}
          {onAddTransaction && onAddIncome && (
            <button
              id="mobile-btn-load-past-data"
              onClick={() => setShowImport(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 10,
                fontSize: 11, fontWeight: 700,
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                border: '1.5px solid var(--accent-border)',
                cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--accent-bg)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
            >
              <Upload size={11} />
              Load Past Data
            </button>
          )}
        </div>

        {/* Period selector */}
        <PeriodSelector
          period={selectedPeriod}
          onChange={onPeriodChange}
          transactions={transactions}
          income={income}
        />

        {/* Period Totals Summary */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
          <StatPill label="Expense" value={periodTotals.expense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" />
          <StatPill label="Savings" value={periodTotals.savings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" />
          <StatPill label="Person"  value={periodTotals.person}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  />
          {periodTotals.waste > 0 && (
            <StatPill label="Waste"   value={periodTotals.waste}   color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={Flame} />
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <LayoutList size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              No transactions in this period
            </p>
          </div>
        ) : (
          grouped.map(group => {
            const isCollapsed = collapsedGroups.has(group.label);
            const groupTotal  = group.entries.reduce((s, t) => s + t.amount, 0);

            return (
              <div key={group.label} style={{ marginBottom: 14 }}>
                {/* Group header bar */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    background: 'var(--surface2)', cursor: 'pointer',
                    fontFamily: 'inherit', marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isCollapsed ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {group.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({group.entries.length})
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {formatAmount(groupTotal)}
                  </span>
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div className="card">
                    {group.entries.map((txn, i) => {
                      const m = txn.type === 'person'
                        ? getDirectionMeta(txn.direction)
                        : (TYPE_META[txn.type] || TYPE_META.expense);
                      const isWasted  = txn.wasteAmount != null && txn.wasteAmount > 0;
                      const isEditingWaste = editingWaste === txn.id;

                      // Amount color: repayment entries show as income-colored
                      const amtColor = txn.type === 'person' && txn.direction === 'repayment'
                        ? 'var(--repayment-rec)'
                        : m.color;

                      return (
                        <div key={txn.id}>
                          <div
                            onClick={() => handleTxnTap(txn)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 14px',
                              borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                              cursor: 'pointer',
                              background: isWasted ? m.bg : 'transparent',
                              borderLeft: isWasted ? `3px solid ${m.color}` : '3px solid transparent',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span style={{
                                fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700,
                                background: m.bg, color: m.color, border: `1px solid ${m.border}`,
                                flexShrink: 0,
                              }}>
                                {txn.type === 'person' ? m.label : m.label}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <span style={{
                                  fontSize: 13, fontWeight: 600, color: 'var(--text)',
                                  display: 'block', overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {txn.name}
                                </span>
                                {isWasted && (
                                  <span style={{ fontSize: 11, color: 'var(--expense)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Flame size={10} /> Wasted: {formatAmount(txn.wasteAmount)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: amtColor }}>
                                {txn.type === 'person' && txn.direction === 'repayment' ? '+' : ''}{formatAmount(txn.amount)}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); setEditingTxn(txn); }}
                                style={{
                                  width: 26, height: 26, borderRadius: 6,
                                  background: 'transparent', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeletingId(txn.id); }}
                                style={{
                                  width: 26, height: 26, borderRadius: 6,
                                  background: 'transparent', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Waste editor inline row */}
                          {isEditingWaste && (
                            <div style={{
                              display: 'flex', gap: 6, padding: '8px 14px',
                              background: 'var(--expense-bg)', borderBottom: '1px solid var(--expense-border)',
                            }}>
                              <input
                                ref={wasteInputRef}
                                type="number"
                                placeholder="Waste amount"
                                value={wasteInput}
                                onChange={e => setWasteInput(e.target.value)}
                                inputMode="decimal"
                                style={{
                                  flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12,
                                  border: '1.5px solid var(--expense)', background: 'var(--input-bg)',
                                  color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter')  saveWaste(txn);
                                  if (e.key === 'Escape') cancelWaste();
                                }}
                              />
                              <button
                                onClick={() => saveWaste(txn)}
                                style={{
                                  padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                  background: 'var(--expense)', color: '#fff', border: 'none', cursor: 'pointer',
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelWaste}
                                style={{
                                  padding: '5px 10px', borderRadius: 8, fontSize: 12,
                                  background: 'var(--surface2)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, color, bg, border, Icon }) {
  return (
    <div style={{
      padding: '5px 10px', borderRadius: 20,
      background: bg, border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
    }}>
      {Icon && <Icon size={11} style={{ color }} />}
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{formatAmount(value)}</span>
    </div>
  );
}
