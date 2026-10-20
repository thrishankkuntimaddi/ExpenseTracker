// ─── History ─────────────────────────────────────────────────────
// Every entry of the month in one list — money that came in and money that
// went out. One compact row each:
//   what it was for                                  +₹250 (green) / −₹80 (red)
//   [Kind] category · status                                     ✎  🗑
// Kind is Income, Expense, Borrowed, Lent, Got back, Paid back, Savings,
// Given or Billing (utils/entryKinds.js). Status: debts are Open until the
// person's balance is back to zero, then Settled; everything else is Done.
// Tap a row (or ✎) to edit it.
import { useState, useMemo, useCallback } from 'react';
import { LayoutList, Flame, Trash2, ChevronDown, ChevronUp, Pencil, Search, X, ChevronsDownUp, ChevronsUpDown, CheckCircle2, Clock3, Banknote } from 'lucide-react';
import { formatAmount, formatDate, getWeekStart } from '../../utils/dateHelpers';
import MonthSwitcher from '../../components/MonthSwitcher';
import { useViewMonth } from '../../app/month';
import { useTransactions } from '../../hooks/useTransactions';
import { getSavingsType } from '../../utils/typeConfig';
import { categoryOf, categoryTotals, categoryColor, categoryMeta, EMPTY_RULES } from '../../utils/categories';
import { CategoryIcon } from '../../components/CategoryPicker';
import { currentTheme } from '../../utils/theme';
import { isCarryForward } from '../../utils/carryForward';
import { debtLedger } from '../../utils/debts';
import { ENTRY_KINDS, ENTRY_KIND_ORDER, entryKind, isDebtKind } from '../../utils/entryKinds';
import { sumAmounts } from '../../utils/finance';
import EditTransactionModal from '../../components/EditTransactionModal';
import EditIncomeModal from '../../components/EditIncomeModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import ProfileButton from '../../components/ProfileButton';
import BackButton from '../../components/BackButton';
import EntryAmount from '../../components/EntryAmount';
import HelpButton from '../../tour/HelpButton';

const ALL_TIME = { type: 'all' };
const norm = (s) => String(s ?? '').trim().toLowerCase();

export default function HistoryTab({
  transactions = [], income = [], selectedPeriod,
  onUpdateTransaction, onDeleteTransaction, onUpdateIncome, onDeleteIncome,
  settings, onLearnCategory,
}) {
  const { period: monthPeriod } = useViewMonth(selectedPeriod);
  const [allMonths, setAllMonths] = useState(false);   // search every month, not just the one on screen
  const [expandAll, setExpandAll] = useState(null);    // null = default: open when grouped by day
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState(null);
  const [kindFilter, setKindFilter] = useState(null);  // a key of ENTRY_KINDS
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const theme = currentTheme();
  const [customToggles, setCustomToggles] = useState({});
  const [editing, setEditing]   = useState(null);      // a row
  const [deleting, setDeleting] = useState(null);      // a row

  // Both stores, one list. `_src` says where a row lives, `_kind` what it is.
  const rows = useMemo(() => [
    ...transactions.map((t) => ({ ...t, _src: 'transaction', _kind: entryKind(t, 'transaction') })),
    ...income.filter((i) => !isCarryForward(i)).map((i) => ({ ...i, _src: 'income', _kind: entryKind(i, 'income') })),
  ], [transactions, income]);

  // Debts: is this person's balance back to zero?
  const settledByName = useMemo(() => {
    const m = new Map();
    debtLedger(transactions, income).forEach((p) => m.set(p.key, p.settled));
    return m;
  }, [transactions, income]);

  /* ─ Filter & group ─ */
  const q = search.trim().toLowerCase();
  const predicate = useCallback((t) => {
    if (kindFilter && t._kind !== kindFilter) return false;
    if (catFilter && (t._kind !== 'expense' || categoryOf(t, categoryRules) !== catFilter)) return false;
    if (q && !`${t.name ?? ''} ${t.platform ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q) && !String(t.amount).includes(q)) return false;
    return true;
  }, [kindFilter, catFilter, q, categoryRules]);
  const hasFilter = !!(q || catFilter || kindFilter);
  const searchAll = allMonths && hasFilter;
  const { filtTxns, periodTxns, grouped, grouping } = useTransactions(rows, searchAll ? ALL_TIME : monthPeriod, hasFilter ? predicate : null);

  // Kind chips: only kinds that happened this period, with their totals
  const kindTotals = useMemo(() => {
    const m = {};
    periodTxns.forEach((t) => { m[t._kind] = (m[t._kind] ?? 0) + (Number(t.amount) || 0); });
    return ENTRY_KIND_ORDER.filter((k) => m[k]).map((k) => ({ key: k, amount: m[k] }));
  }, [periodTxns]);
  const flow = useMemo(() => ({
    in:  sumAmounts(periodTxns.filter((t) => ENTRY_KINDS[t._kind].sign > 0)),
    out: sumAmounts(periodTxns.filter((t) => ENTRY_KINDS[t._kind].sign < 0)),
  }), [periodTxns]);
  // Category chips: expenses only
  const periodCats = useMemo(() => categoryTotals(periodTxns.filter((t) => t._kind === 'expense'), categoryRules), [periodTxns, categoryRules]);

  const todayIso = new Date().toISOString();
  const currentLabel = grouping === 'month' ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : grouping === 'week' ? `Week of ${formatDate(getWeekStart(todayIso).toISOString())}`
    : formatDate(todayIso);
  const hasCurrent = grouped.some((g) => g.label === currentLabel);
  // Expand everything while searching/filtering so matches are visible
  const effectiveExpandAll = (expandAll ?? grouping === 'day') || hasFilter;
  const isGroupExpanded = (label) => customToggles[label] ?? (effectiveExpandAll || label === currentLabel || (!hasCurrent && grouped[0]?.label === label));
  const toggleGroup = (label) => setCustomToggles((prev) => ({ ...prev, [label]: !isGroupExpanded(label) }));

  const removeRow = (row) => (row._src === 'income' ? onDeleteIncome?.(row.id) : onDeleteTransaction?.(row.id));

  return (
    <div className="tab-root">
      {editing && editing._src === 'transaction' && (
        <EditTransactionModal txn={editing} onSave={onUpdateTransaction} onDelete={onDeleteTransaction}
          onClose={() => setEditing(null)} categoryRules={categoryRules} onLearnCategory={onLearnCategory} />
      )}
      {editing && editing._src === 'income' && (
        <EditIncomeModal entry={editing} onSave={onUpdateIncome} onDelete={onDeleteIncome} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDeleteModal
          title={`Delete “${deleting.name}”?`}
          message="It moves to Recently Deleted (Settings), where you can restore it."
          onConfirm={() => { removeRow(deleting); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Header */}
      <div className="tab-header" id="history-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <BackButton />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>History</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {filtTxns.length}{hasFilter ? ` of ${periodTxns.length}` : ''} entries · money in and out
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <IconAction id="history-expand-all" label={effectiveExpandAll ? 'Collapse all' : 'Expand all'}
              Icon={effectiveExpandAll ? ChevronsDownUp : ChevronsUpDown} onClick={() => { setExpandAll(!effectiveExpandAll); setCustomToggles({}); }} />
            <HelpButton page="history" />
            <ProfileButton />
          </div>
        </div>

        {/* Month + search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!searchAll && <MonthSwitcher compact />}
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input id="history-search" type="search" placeholder="Search…" aria-label="Search name, note or amount"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 30px', borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', WebkitAppearance: 'none', appearance: 'none' }} />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            )}
          </div>
          {hasFilter && (
            <button id="history-all-months" onClick={() => setAllMonths((v) => !v)} aria-pressed={allMonths}
              style={{ flexShrink: 0, padding: '8px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${allMonths ? 'var(--accent)' : 'var(--border)'}`, background: allMonths ? 'var(--accent-bg)' : 'var(--surface2)', color: allMonths ? 'var(--accent)' : 'var(--text-secondary)' }}>
              All months
            </button>
          )}
        </div>

        {/* In / out for the month, then one chip per kind — tap to filter */}
        <div id="history-kinds" className="cat-scroll" style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <span className="hist-flow" style={{ color: 'var(--income)', background: 'var(--income-bg)' }}>In +{formatAmount(flow.in)}</span>
          <span className="hist-flow" style={{ color: 'var(--expense)', background: 'var(--expense-bg)' }}>Out −{formatAmount(flow.out)}</span>
          {kindTotals.map(({ key, amount }) => {
            const k = ENTRY_KINDS[key];
            const on = kindFilter === key;
            return (
              <button key={key} id={`history-kind-${key}`} onClick={() => { setKindFilter((f) => (f === key ? null : key)); setCatFilter(null); }} aria-pressed={on}
                className="hist-chip" style={{ border: `1.5px solid ${on ? `var(--${k.tone})` : 'var(--border)'}`, background: on ? `var(--${k.tone}-bg)` : 'transparent', color: on ? `var(--${k.tone})` : 'var(--text-secondary)' }}>
                {k.label} <span style={{ opacity: 0.75, fontWeight: 600 }}>{formatAmount(amount)}</span>
              </button>
            );
          })}
        </div>

        {/* Categories — when looking at expenses */}
        {(kindFilter === 'expense' || catFilter) && periodCats.length > 1 && (
          <div className="cat-scroll" style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {periodCats.map((c) => {
              const color = categoryColor(c.key, theme);
              const on = catFilter === c.key;
              return (
                <button key={c.key} onClick={() => setCatFilter((f) => (f === c.key ? null : c.key))} className="hist-chip"
                  style={{ border: `1.5px solid ${on ? color : 'var(--border)'}`, background: on ? color + '22' : 'transparent', color: on ? color : 'var(--text-secondary)' }}>
                  <CategoryIcon category={c.key} size={10} />
                  {c.label}
                  <span style={{ opacity: 0.75, fontWeight: 600 }}>{formatAmount(c.amount)}</span>
                </button>
              );
            })}
          </div>
        )}
        {hasFilter && (
          <button onClick={() => { setCatFilter(null); setKindFilter(null); setSearch(''); }} className="hist-chip"
            style={{ marginTop: 8, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Body */}
      <div id="history-list" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <LayoutList size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {hasFilter ? 'Nothing matches these filters' : 'Nothing in this period yet'}
            </p>
          </div>
        ) : grouped.map((group) => {
          const collapsed = !isGroupExpanded(group.label);
          const gin  = sumAmounts(group.entries.filter((t) => ENTRY_KINDS[t._kind].sign > 0));
          const gout = sumAmounts(group.entries.filter((t) => ENTRY_KINDS[t._kind].sign < 0));
          return (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <button onClick={() => toggleGroup(group.label)} className="hist-group">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {collapsed ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{group.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({group.entries.length})</span>
                </span>
                <span style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}>
                  {gin > 0 && <span style={{ color: 'var(--income)' }}>+{formatAmount(gin)}</span>}
                  {gout > 0 && <span style={{ color: 'var(--expense)' }}>−{formatAmount(gout)}</span>}
                </span>
              </button>
              {!collapsed && (
                <div className="card">
                  {group.entries.map((row, i) => (
                    <HistoryRow key={`${row._src}-${row.id}`} row={row} first={i === 0} theme={theme} rules={categoryRules}
                      settled={settledByName.get(norm(row.name))}
                      onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* One entry: name and signed amount; kind, category and status under it; edit and delete. */
function HistoryRow({ row, first, theme, rules, settled, onEdit, onDelete }) {
  const k = ENTRY_KINDS[row._kind];
  const incoming = k.sign > 0;
  const neutral = k.sign === 0;            // cash withdrawn: account → wallet
  const debt = isDebtKind(row._kind);
  const wasted = row._kind === 'expense' && row.wasteAmount > 0;

  let detail = null;
  if (row._kind === 'expense') {
    const cat = categoryOf(row, rules);
    detail = <span className="hist-cat" style={{ color: categoryColor(cat, theme) }}><CategoryIcon category={cat} size={11} />{categoryMeta(cat).label}</span>;
  } else if (row._kind === 'savings') {
    detail = <span className="hist-cat">{getSavingsType(row.savingsType).label}{row.platform ? ` · ${row.platform}` : ''}</span>;
  } else if (neutral) {
    detail = <span className="hist-cat">Account → wallet</span>;
  } else if (row.note) {
    detail = <span className="hist-cat">{row.note}</span>;
  }

  const status = debt
    ? (settled ? { label: 'Settled', Icon: CheckCircle2, color: 'var(--income)' } : { label: 'Open', Icon: Clock3, color: 'var(--borrowed)' })
    : { label: 'Done', Icon: CheckCircle2, color: 'var(--text-muted)' };

  return (
    <div className="hist-row" role="button" tabIndex={0} onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}
      style={{ borderTop: first ? 'none' : '1px solid var(--border)', borderLeftColor: `var(--${k.tone})` }}>
      <span className="hist-name">{row.name}</span>
      <span className="hist-amount" style={{ color: neutral ? 'var(--text-secondary)' : incoming ? 'var(--income)' : 'var(--expense)' }}>
        <EntryAmount entry={row} prefix={neutral ? '' : incoming ? '+' : '−'} />
      </span>
      <span className="hist-meta">
        <span className="hist-kind" style={{ color: `var(--${k.tone})`, background: `var(--${k.tone}-bg)`, borderColor: `var(--${k.tone}-border, var(--border))` }}>{k.label}</span>
        {detail}
        {row.paidWith === 'cash' && <span className="hist-cat" title="Paid in cash"><Banknote size={11} />Cash</span>}
        {wasted && <span className="hist-cat" style={{ color: 'var(--expense)' }}><Flame size={10} />{formatAmount(row.wasteAmount)} wasted</span>}
        <span className="hist-status" style={{ color: status.color }} title={debt ? (settled ? 'This person’s balance is back to zero' : 'Still to be returned') : 'Recorded'}>
          <status.Icon size={11} />{status.label}
        </span>
      </span>
      <span className="hist-actions">
        <button aria-label={`Edit ${row.name}`} title="Edit" className="hist-btn hist-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Pencil size={13} /></button>
        <button aria-label={`Delete ${row.name}`} title="Delete" className="hist-btn hist-del" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={13} /></button>
      </span>
    </div>
  );
}

function IconAction({ id, label, Icon, onClick }) {
  return (
    <button id={id} onClick={onClick} aria-label={label} title={label}
      style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={15} />
    </button>
  );
}
