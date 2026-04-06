import { useState, useRef, useCallback } from 'react';
import { CalendarDays, Calendar, LayoutList, Flame } from 'lucide-react';
import { formatAmount, groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';

const FILTERS = [
  { key: 'Day',   label: 'Day',   Icon: CalendarDays },
  { key: 'Week',  label: 'Week',  Icon: Calendar     },
  { key: 'Month', label: 'Month', Icon: LayoutList   },
];

const TYPE_META = {
  expense: { label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)' },
  person:  { label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)'  },
  savings: { label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)' },
  income:  { label: 'Income',  color: 'var(--income)',  bg: 'var(--income-bg)'  },
};

export default function HistoryTab({ transactions, onUpdateTransaction }) {
  const [filter, setFilter]         = useState('Day');
  const [editingWaste, setEditingWaste] = useState(null);
  const [wasteInput, setWasteInput] = useState('');
  const lastTapRef   = useRef({});
  const wasteInputRef = useRef(null);

  const grouped = filter === 'Day'   ? groupByDay(transactions)
    : filter === 'Week'  ? groupByWeek(transactions)
    : groupByMonth(transactions);

  const handleTxnTap = useCallback((txn) => {
    if (txn.type !== 'expense') return;
    const now = Date.now(), last = lastTapRef.current[txn.id] || 0, D = 400;
    if (now - last < D) {
      lastTapRef.current[txn.id] = 0;
      setEditingWaste(txn.id);
      setWasteInput(txn.wasteAmount != null ? String(txn.wasteAmount) : '');
      setTimeout(() => wasteInputRef.current?.focus(), 80);
    } else {
      lastTapRef.current[txn.id] = now;
      setTimeout(() => {
        if (lastTapRef.current[txn.id] !== now) return;
        onUpdateTransaction({ ...txn, wasteAmount: txn.wasteAmount === txn.amount ? undefined : txn.amount });
      }, D);
    }
  }, [onUpdateTransaction]);

  function saveWaste(txn) {
    const val = parseFloat(wasteInput);
    onUpdateTransaction({ ...txn, wasteAmount: (!isNaN(val) && val > 0 && val <= txn.amount) ? val : undefined });
    setEditingWaste(null); setWasteInput('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>History</h1>
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {FILTERS.map(({ key, label, Icon }) => (
              <button
                key={key}
                id={`history-filter-${key.toLowerCase()}`}
                onClick={() => setFilter(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  border: filter === key ? 'none' : '1px solid var(--border)',
                  background: filter === key ? 'var(--accent)' : 'var(--surface)',
                  color: filter === key ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: filter === key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
        {grouped.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutList size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>No transactions found</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add entries from the Today tab</p>
            </div>
          </div>
        )}

        <div className="history-grid">
          {grouped.map(group => {
            const total = group.entries.reduce((s, t) => s + t.amount, 0);
            const waste = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
            return (
              <div key={group.label} style={{ marginBottom: 20 }}>
                {/* Date Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{group.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {waste > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'var(--expense-bg)', color: 'var(--expense)' }}>
                        <Flame size={10} />{formatAmount(waste)}
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{formatAmount(total)}</span>
                  </div>
                </div>

                {/* Group Card */}
                <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  {group.entries.map((txn, i) => {
                    const meta = TYPE_META[txn.type] || TYPE_META.expense;
                    const isWasted  = txn.wasteAmount != null && txn.wasteAmount > 0;
                    const isEditing = editingWaste === txn.id;
                    const isFullWaste = txn.wasteAmount === txn.amount;

                    return (
                      <div key={txn.id}>
                        <div
                          onClick={() => handleTxnTap(txn)}
                          onDoubleClick={e => e.preventDefault()}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '13px 16px', cursor: txn.type === 'expense' ? 'pointer' : 'default',
                            background: isWasted ? 'var(--expense-bg)' : 'transparent',
                            borderLeft: isWasted ? '3px solid var(--expense)' : '3px solid transparent',
                            borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, fontWeight: 600, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                              {meta.label}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {txn.name}
                              </span>
                              {isWasted && (
                                <span style={{ fontSize: 11, color: 'var(--expense)' }}>
                                  🔥 {isFullWaste ? 'Full waste' : `Waste: ${formatAmount(txn.wasteAmount)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: meta.color, marginLeft: 12, flexShrink: 0 }}>
                            {formatAmount(txn.amount)}
                          </span>
                        </div>

                        {/* Inline Waste Editor */}
                        {isEditing && txn.type === 'expense' && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', background: 'var(--expense-bg)', borderTop: '1px solid var(--expense-border)' }}>
                            <input
                              ref={wasteInputRef}
                              type="number"
                              placeholder="Waste amount"
                              value={wasteInput}
                              onChange={e => setWasteInput(e.target.value)}
                              inputMode="decimal"
                              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1.5px solid var(--expense)', background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                              onKeyDown={e => { if (e.key === 'Enter') saveWaste(txn); if (e.key === 'Escape') { setEditingWaste(null); setWasteInput(''); } }}
                            />
                            <button onClick={() => saveWaste(txn)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--expense)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => { setEditingWaste(null); setWasteInput(''); }} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--border)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, marginTop: 6, paddingLeft: 2, color: 'var(--text-muted)' }}>
                  Tap to mark waste · Double-tap for custom amount
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop 2-col grid for history groups */}
      <style>{`
        @media (min-width: 1024px) {
          .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; }
        }
      `}</style>
    </div>
  );
}
