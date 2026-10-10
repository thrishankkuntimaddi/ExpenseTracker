// ─── Desktop dashboard: today's / period entries list with wastage editing ───
import { ShoppingCart, Flame, Pencil, Trash2, X } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import { TYPE_META } from '../../utils/typeConfig';
import { categoryOf } from '../../utils/categories';
import { DCard, CardHeader } from './ui';
import { CategoryBadge } from '../CategoryPicker';

export default function EntriesCard({
  dashTxnView, setDashTxnView, todayTxns, filtTxns, setActiveSection,
  wastage, setEditingTxn, setDeletingTxnId, onDeleteTransaction, categoryRules = {},
}) {
  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = wastage;
  const displayTxns = dashTxnView === 'today' ? todayTxns : filtTxns;
  return (
    <DCard>
      <CardHeader
        title={dashTxnView === 'today' ? "Today's Entries" : "Period Entries"}
        sub={`${displayTxns.length} transactions`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setDashTxnView(v => v === 'today' ? 'period' : 'today')}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {dashTxnView === 'today' ? 'Period →' : 'Today →'}
            </button>
            <button
              onClick={() => setActiveSection('history')}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Full History
            </button>
          </div>
        }
      />
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {displayTxns.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 6 }}>
            <ShoppingCart size={20} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {dashTxnView === 'today' ? 'No entries yet today' : 'No entries in this period'}
            </p>
          </div>
        ) : displayTxns.slice().reverse().map((txn) => {
          const m = TYPE_META[txn.type] || TYPE_META.expense;
          const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
          const isEditing = editingWaste === txn.id;
          const isGivenGift = txn.type === 'person' && txn.direction === 'given_gift';
          const isRepaidThem = txn.type === 'person' && txn.direction === 'repaid';
          const badgeLabel = txn.type === 'person' && txn.direction === 'repayment' ? 'Repayment' :
                             isGivenGift ? 'Given' :
                             isRepaidThem ? 'Repaid' :
                             txn.type === 'person' && txn.direction === 'lent' ? 'Lent' :
                             m.label;
          const badgeBg    = isGivenGift ? '#EEF2FF' : m.bg;
          const badgeColor = isGivenGift ? '#6366F1' : m.color;

          return (
            <div key={txn.id}>
              <div
                onClick={() => handleTxnTap(txn)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 18px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: isWasted ? m.bg : 'transparent',
                  borderLeft: isWasted ? `3px solid ${m.color}` : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {txn.type === 'expense'
                    ? <CategoryBadge category={categoryOf(txn, categoryRules)} compact />
                    : <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: badgeBg, color: badgeColor, flexShrink: 0 }}>
                        {badgeLabel}
                      </span>}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.name}
                    </span>
                    {isWasted && <Flame size={10} style={{ color: m.color, flexShrink: 0 }} />}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: txn.direction === 'repayment' ? 'var(--income)' : m.color, marginLeft: 8 }}>
                    {txn.direction === 'repayment' ? '+' : ''}{formatAmount(txn.amount)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingTxn(txn); }}
                    style={{
                      width: 22, height: 22, borderRadius: 5,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Pencil size={11} />
                  </button>
                  {onDeleteTransaction && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingTxnId(txn.id); }}
                      style={{
                        width: 22, height: 22, borderRadius: 5,
                        background: 'transparent', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
              {isEditing && (
                <div style={{ display: 'flex', gap: 6, padding: '7px 14px', background: 'var(--expense-bg)', borderBottom: '1px solid var(--expense-border)' }}>
                  <input
                    ref={wasteInputRef} type="number" placeholder="Waste amount" value={wasteInput}
                    onChange={e => setWasteInput(e.target.value)} inputMode="decimal"
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--expense)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                    onKeyDown={e => { if (e.key === 'Enter') saveWaste(txn); if (e.key === 'Escape') cancelWaste(); }}
                  />
                  <button onClick={() => saveWaste(txn)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--expense)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={cancelWaste} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Cancel"><X size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DCard>
  );
}
