import { useState, useRef, useCallback } from 'react';
import { CalendarDays, Calendar, LayoutList, Flame } from 'lucide-react';
import { formatAmount, groupByDay, groupByWeek, groupByMonth } from '../utils/dateHelpers';

const FILTERS = [
  { key: 'Day', label: 'Day', Icon: CalendarDays },
  { key: 'Week', label: 'Week', Icon: Calendar },
  { key: 'Month', label: 'Month', Icon: LayoutList },
];

const TYPE_META = {
  expense: { label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)' },
  person:  { label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)'  },
  savings: { label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)' },
  income:  { label: 'Income',  color: 'var(--income)',  bg: 'var(--income-bg)'  },
};

export default function HistoryTab({ transactions, onUpdateTransaction }) {
  const [filter, setFilter] = useState('Day');
  const [editingWaste, setEditingWaste] = useState(null);
  const [wasteInput, setWasteInput] = useState('');
  const lastTapRef = useRef({});
  const wasteInputRef = useRef(null);

  const grouped = filter === 'Day'
    ? groupByDay(transactions)
    : filter === 'Week'
    ? groupByWeek(transactions)
    : groupByMonth(transactions);

  const handleTxnTap = useCallback((txn) => {
    if (txn.type !== 'expense') return;
    const now = Date.now();
    const last = lastTapRef.current[txn.id] || 0;
    const DOUBLE_TAP = 400;
    if (now - last < DOUBLE_TAP) {
      lastTapRef.current[txn.id] = 0;
      setEditingWaste(txn.id);
      setWasteInput(txn.wasteAmount != null ? String(txn.wasteAmount) : '');
      setTimeout(() => wasteInputRef.current?.focus(), 80);
    } else {
      lastTapRef.current[txn.id] = now;
      setTimeout(() => {
        const cur = lastTapRef.current[txn.id];
        if (cur !== now) return;
        onUpdateTransaction({
          ...txn,
          wasteAmount: txn.wasteAmount === txn.amount ? undefined : txn.amount,
        });
      }, DOUBLE_TAP);
    }
  }, [onUpdateTransaction]);

  function saveWaste(txn) {
    const val = parseFloat(wasteInput);
    onUpdateTransaction({
      ...txn,
      wasteAmount: (!isNaN(val) && val > 0 && val <= txn.amount) ? val : undefined,
    });
    setEditingWaste(null);
    setWasteInput('');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text)' }}>History</h1>
        {/* Filter Pills */}
        <div className="flex gap-2">
          {FILTERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              id={`history-filter-${key.toLowerCase()}`}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={filter === key
                ? { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }
                : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
              <LayoutList size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No transactions found</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Add entries from the Today tab</p>
            </div>
          </div>
        )}

        {grouped.map(group => {
          const total = group.entries.reduce((s, t) => s + t.amount, 0);
          const waste = group.entries.reduce((s, t) => s + (t.wasteAmount || 0), 0);
          return (
            <div key={group.label} className="mb-5">
              {/* Date Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{group.label}</span>
                <div className="flex items-center gap-2">
                  {waste > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--expense-bg)', color: 'var(--expense)' }}>
                      <Flame size={10} /> {formatAmount(waste)}
                    </span>
                  )}
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{formatAmount(total)}</span>
                </div>
              </div>

              {/* Group Card */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {group.entries.map((txn, i) => {
                  const meta = TYPE_META[txn.type] || TYPE_META.expense;
                  const isWasted = txn.wasteAmount != null && txn.wasteAmount > 0;
                  const isEditing = editingWaste === txn.id;
                  const isFullWaste = txn.wasteAmount === txn.amount;

                  return (
                    <div key={txn.id}>
                      <div
                        className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none"
                        style={{
                          borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                          background: isWasted ? 'var(--expense-bg)' : 'transparent',
                          borderLeft: isWasted ? '3px solid var(--expense)' : '3px solid transparent',
                        }}
                        onClick={() => handleTxnTap(txn)}
                        onDoubleClick={e => e.preventDefault()}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs px-2 py-0.5 rounded-lg font-semibold shrink-0"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium block truncate" style={{ color: 'var(--text)' }}>{txn.name}</span>
                            {isWasted && (
                              <span className="text-xs" style={{ color: 'var(--expense)' }}>
                                🔥 {isFullWaste ? 'Full waste' : `Waste: ${formatAmount(txn.wasteAmount)}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold ml-3 shrink-0" style={{ color: meta.color }}>
                          {formatAmount(txn.amount)}
                        </span>
                      </div>

                      {/* Inline Waste Input */}
                      {isEditing && txn.type === 'expense' && (
                        <div className="px-4 py-3 flex gap-2 items-center"
                          style={{ background: 'var(--expense-bg)', borderTop: '1px solid var(--expense-border)' }}>
                          <input
                            ref={wasteInputRef}
                            type="number"
                            placeholder="Waste amount"
                            value={wasteInput}
                            onChange={e => setWasteInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-medium"
                            style={{ background: '#fff', border: '1.5px solid var(--expense)', color: 'var(--text)' }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveWaste(txn);
                              if (e.key === 'Escape') { setEditingWaste(null); setWasteInput(''); }
                            }}
                            inputMode="decimal"
                          />
                          <button onClick={() => saveWaste(txn)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold"
                            style={{ background: 'var(--expense)', color: '#fff' }}>Save</button>
                          <button onClick={() => { setEditingWaste(null); setWasteInput(''); }}
                            className="px-3 py-2 rounded-xl text-xs font-semibold"
                            style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-1.5 px-1" style={{ color: 'var(--text-muted)' }}>
                Tap expense to mark waste · Double-tap for custom amount
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
