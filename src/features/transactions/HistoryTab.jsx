import { useState, useMemo, useCallback } from 'react';
import { LayoutList, Flame, Trash2, ChevronDown, ChevronUp, Upload, Pencil, Search, X } from 'lucide-react';
import { formatAmount, formatDate, getWeekStart } from '../../utils/dateHelpers';
import PeriodSelector from '../../components/PeriodSelector';
import { useWastage } from '../../hooks/useWastage';
import { useTransactions } from '../../hooks/useTransactions';
import { TYPE_META, getDirectionMeta } from '../../utils/typeConfig';
import { categoryOf, categoryTotals, categoryColor, EMPTY_RULES } from '../../utils/categories';
import { CategoryBadge, CategoryIcon } from '../../components/CategoryPicker';
import { currentTheme } from '../../utils/theme';
import LoadMonthlyData from '../../components/LoadMonthlyData';
import EditTransactionModal from '../../components/EditTransactionModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

export default function HistoryTab({
  transactions, income = [], selectedPeriod, onPeriodChange,
  onUpdateTransaction, onDeleteTransaction,
  onAddTransaction, onAddIncome,
  settings, onLearnCategory,
}) {
  const [expandAll, setExpandAll]         = useState(false);
  const [search, setSearch]               = useState('');
  const [catFilter, setCatFilter]         = useState(null);
  const [typeFilter, setTypeFilter]       = useState(null); // 'expense' | 'savings' | 'person' | null
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const theme = currentTheme();
  const [customToggles, setCustomToggles] = useState({});
  const [showImport, setShowImport]       = useState(false);
  const [editingTxn, setEditingTxn]     = useState(null);
  const [deletingId, setDeletingId]     = useState(null);

  const { editingWaste, wasteInput, wasteInputRef, handleTxnTap, saveWaste, cancelWaste, setWasteInput } = useWastage(onUpdateTransaction);

  /* ─ Filter & group ─ */
  const q = search.trim().toLowerCase();
  const predicate = useCallback((t) => {
    if (typeFilter && t.type !== typeFilter) return false;
    if (catFilter && categoryOf(t, categoryRules) !== catFilter) return false;
    if (q && !`${t.name ?? ''} ${t.platform ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q) && !String(t.amount).includes(q)) return false;
    return true;
  }, [typeFilter, catFilter, q, categoryRules]);
  const hasFilter = !!(q || catFilter || typeFilter);
  const { filtTxns, periodTxns, grouped, grouping } = useTransactions(transactions, selectedPeriod, hasFilter ? predicate : null);

  // Category chips for this period (from every expense in the period, not the filtered subset)
  const periodCats = useMemo(() => categoryTotals(periodTxns, categoryRules), [periodTxns, categoryRules]);

  const periodTotals = useMemo(() => ({
    expense: periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    savings: periodTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    person:  periodTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0),
    waste:   periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0),
  }), [periodTxns]);

  function isGroupCurrent(groupLabel) {
    const todayIso = new Date().toISOString();
    let isCurrent = false;

    if (grouping === 'month') {
      const currentMonthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      isCurrent = groupLabel === currentMonthLabel;
    } else if (grouping === 'week') {
      const currentWeekLabel = `Week of ${formatDate(getWeekStart(todayIso).toISOString())}`;
      isCurrent = groupLabel === currentWeekLabel;
    } else {
      const todayLabel = formatDate(todayIso);
      isCurrent = groupLabel === todayLabel;
    }

    if (isCurrent) return true;

    // Fallback: If current day/period is not present in grouped list, expand the top/first group
    const hasCurrentGroupInList = grouped.some(g => {
      if (grouping === 'month') return g.label === new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (grouping === 'week') return g.label === `Week of ${formatDate(getWeekStart(todayIso).toISOString())}`;
      return g.label === formatDate(todayIso);
    });

    if (!hasCurrentGroupInList && grouped.length > 0 && grouped[0].label === groupLabel) {
      return true;
    }

    return false;
  }

  function isGroupExpanded(groupLabel) {
    if (customToggles[groupLabel] !== undefined) {
      return customToggles[groupLabel];
    }
    if (effectiveExpandAll) {
      return true;
    }
    return isGroupCurrent(groupLabel);
  }

  function toggleGroup(label) {
    const currentlyExpanded = isGroupExpanded(label);
    setCustomToggles(prev => ({
      ...prev,
      [label]: !currentlyExpanded,
    }));
  }

  function handleToggleExpandAll(checked) {
    setExpandAll(checked);
    setCustomToggles({});
  }

  const groupLabel = grouping === 'month' ? 'Grouped by month'
    : grouping === 'week' ? 'Grouped by week'
    : 'Grouped by day';

  // Expand everything while searching/filtering so matches are visible
  const effectiveExpandAll = expandAll || hasFilter;

  return (
    <div className="tab-root">
      {/* Edit modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onSave={onUpdateTransaction}
          onDelete={onDeleteTransaction}
          onClose={() => setEditingTxn(null)}
          categoryRules={categoryRules}
          onLearnCategory={onLearnCategory}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                {groupLabel} · {filtTxns.length}{hasFilter ? ` of ${periodTxns.length}` : ''} transactions
              </p>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: expandAll ? 'var(--accent-bg)' : 'var(--surface2)',
                  border: `1.5px solid ${expandAll ? 'var(--accent-border)' : 'var(--border)'}`,
                  color: expandAll ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={expandAll}
                  onChange={e => handleToggleExpandAll(e.target.checked)}
                  style={{
                    accentColor: 'var(--accent)',
                    cursor: 'pointer',
                    width: 13,
                    height: 13,
                    margin: 0,
                  }}
                />
                <span>Expand All</span>
              </label>
            </div>
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

        {/* Search */}
        <div style={{ position: 'relative', marginTop: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            id="history-search"
            type="search"
            placeholder="Search name, platform or amount…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 32, paddingTop: 9, paddingBottom: 9,
              borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)',
              background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
              WebkitAppearance: 'none', appearance: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Period Totals Summary — tap to filter by type */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          <StatPill label="Expense" value={periodTotals.expense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" active={typeFilter === 'expense'} onClick={() => setTypeFilter(f => f === 'expense' ? null : 'expense')} />
          <StatPill label="Savings" value={periodTotals.savings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" active={typeFilter === 'savings'} onClick={() => setTypeFilter(f => f === 'savings' ? null : 'savings')} />
          <StatPill label="Person"  value={periodTotals.person}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  active={typeFilter === 'person'}  onClick={() => setTypeFilter(f => f === 'person' ? null : 'person')} />
          {periodTotals.waste > 0 && (
            <StatPill label="Waste"   value={periodTotals.waste}   color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={Flame} />
          )}
        </div>

        {/* Category chips — tap to filter */}
        {periodCats.length > 1 && (
          <div className="cat-scroll" style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {periodCats.map(c => {
              const color = categoryColor(c.key, theme);
              const active = catFilter === c.key;
              return (
                <button key={c.key} onClick={() => setCatFilter(f => f === c.key ? null : c.key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '4px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1.5px solid ${active ? color : 'var(--border)'}`,
                  background: active ? color + '22' : 'transparent', color: active ? color : 'var(--text-secondary)',
                }}>
                  <CategoryIcon category={c.key} size={10} />
                  {c.label}
                  <span style={{ opacity: 0.75, fontWeight: 600 }}>{formatAmount(c.amount)}</span>
                </button>
              );
            })}
            {hasFilter && (
              <button onClick={() => { setCatFilter(null); setTypeFilter(null); setSearch(''); }} style={{ flexShrink: 0, padding: '4px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <LayoutList size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {hasFilter ? 'Nothing matches these filters' : 'No transactions in this period'}
            </p>
          </div>
        ) : (
          grouped.map(group => {
            const isCollapsed = !isGroupExpanded(group.label);
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
                              {txn.type === 'expense' ? (
                                <CategoryBadge category={categoryOf(txn, categoryRules)} compact theme={theme} />
                              ) : (
                                <span style={{
                                  fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700,
                                  background: m.bg, color: m.color, border: `1px solid ${m.border}`,
                                  flexShrink: 0,
                                }}>
                                  {m.label}
                                </span>
                              )}
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

function StatPill({ label, value, color, bg, border, Icon, active, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} aria-pressed={onClick ? !!active : undefined} style={{
      padding: '5px 10px', borderRadius: 20,
      background: bg, border: `${active ? 2 : 1}px solid ${active ? color : border}`,
      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
      boxShadow: active ? `0 0 0 2px ${bg}` : 'none',
    }}>
      {Icon && <Icon size={11} style={{ color }} />}
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{formatAmount(value)}</span>
    </Tag>
  );
}
