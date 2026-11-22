// ─── History ─────────────────────────────────────────────────────
// Every entry of the month in one list — money that came in and money that
// went out. One compact row each:
//   what it was for                                  +₹250 (green) / −₹80 (red)
//   [Kind] category · status                                     ✎  🗑
// Kind is Income, Expense, Borrowed, Lent, Got back, Paid back, Savings,
// Given or Billing (utils/entryKinds.js). Status: debts are Open until the
// person's balance is back to zero, then Settled; everything else is Done.
// Tap a row (or ✎) to edit it.
import { accountsSetUp, listAccounts, accountOf, accountLabel, colorOf } from '../../utils/accounts';
import { useState, useMemo, useCallback, useRef } from 'react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { LayoutList, Flame, Trash2, ChevronDown, ChevronUp, Pencil, Search, X, ChevronsDownUp, ChevronsUpDown, CheckCircle2, Clock3, Banknote, Wallet, ArrowDownLeft, ArrowUpRight, Undo2, Receipt, Gift, PiggyBank, FileUp } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import MonthSwitcher from '../../components/MonthSwitcher';
import { useViewMonth, monthName } from '../../app/month';
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
import { HeaderAction } from '../../components/Page';
import EntryAmount from '../../components/EntryAmount';
import HelpButton from '../../tour/HelpButton';
import BigAmount from '../../components/BigAmount';
import { formatMoneyCompact } from '../../utils/money';

import { t as tr } from '../../i18n';
import { useShell } from '../../app/shellContext';
import SwipeRow from '../../components/SwipeRow';
import StatementImport from '../import/StatementImport';
const ALL_TIME = { type: 'all' };
const norm = (s) => String(s ?? '').trim().toLowerCase();

export default function HistoryTab({
  transactions = [], income = [], selectedPeriod,
  onUpdateTransaction, onDeleteTransaction, onUpdateIncome, onDeleteIncome,
  settings, onLearnCategory, onAddTransaction, onAddIncome,
}) {
  const shell = useShell();
  const phone = !shell?.desktop;
  const [wasteFor, setWasteFor] = useState(null);      // a row: how much of it was wasted
  const [tipHidden, setTipHidden] = useState(() => { try { return localStorage.getItem('et_hist_tip') === '1'; } catch { return true; } });
  const hideTip = () => { try { localStorage.setItem('et_hist_tip', '1'); } catch { /* storage unavailable */ } setTipHidden(true); };
  /* Wasted: on the entry itself (wasteAmount), counted in Stats */
  const plain = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));
  function setWaste(row, amount, quiet = false) {
    const prev = row.wasteAmount;
    const v = Math.round(Math.min(Number(row.amount) || 0, Math.max(0, Number(amount) || 0)) * 100) / 100;
    onUpdateTransaction?.({ ...plain(row), wasteAmount: v > 0 ? v : undefined });
    if (!quiet) shell?.toast?.({
      text: v > 0 ? `${formatAmount(v)} ${tr('of')} ${row.name} ${tr('marked wasted')}` : `${row.name} — ${tr('not wasted')}`,
      sign: 'check',
      action: { label: tr('Undo'), onClick: () => onUpdateTransaction?.({ ...plain(row), wasteAmount: prev > 0 ? prev : undefined }) },
    });
  }
  // One tap: all of it wasted (again: not wasted). Two taps: how much.
  const tapTimer = useRef(null);
  function tapRow(row) {
    if (row._kind !== 'expense' || settings?.historyTap === 'edit') { setEditing(row); return; }
    if (tapTimer.current && tapTimer.current.id === row.id) {
      clearTimeout(tapTimer.current.t); tapTimer.current = null;
      setWasteFor(row);
      return;
    }
    if (tapTimer.current) clearTimeout(tapTimer.current.t);
    const t = setTimeout(() => { tapTimer.current = null; setWaste(row, row.wasteAmount > 0 ? 0 : row.amount); }, 280);
    tapTimer.current = { id: row.id, t };
  }
  const [importing, setImporting] = useState(false);
  const { period: monthPeriod, month: viewMonth } = useViewMonth(selectedPeriod);
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

  // Only the most recent day with entries starts open (today, else the last
  // day something happened); the rest are collapsed. "Expand all" opens them,
  // and a search or filter opens everything so the matches show.
  const latest = grouped[0]?.label;
  // Days open by default (a day holds a few entries; tapping each open was busywork)
  const effectiveExpandAll = (expandAll ?? grouping === 'day') || hasFilter;
  const isGroupExpanded = (label) => customToggles[label] ?? (effectiveExpandAll || label === latest);
  const toggleGroup = (label) => setCustomToggles((prev) => ({ ...prev, [label]: !isGroupExpanded(label) }));

  const removeRow = (row) => (row._src === 'income' ? onDeleteIncome?.(row.id) : onDeleteTransaction?.(row.id));

  return (
    <div className="tab-root">
      {importing && (
        <StatementImport transactions={transactions} income={income} settings={settings}
          onAddTransaction={onAddTransaction} onAddIncome={onAddIncome} onClose={() => setImporting(false)} />
      )}
      {editing && editing._src === 'transaction' && (
        <EditTransactionModal txn={editing} onSave={onUpdateTransaction} onDelete={onDeleteTransaction}
          onClose={() => setEditing(null)} categoryRules={categoryRules} onLearnCategory={onLearnCategory} />
      )}
      {wasteFor && <WasteModal row={wasteFor} onSave={(v) => setWaste(wasteFor, v)} onClose={() => setWasteFor(null)} />}
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
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{tr("History")}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {filtTxns.length}{hasFilter ? ` of ${periodTxns.length}` : ''} {tr("entries · money in and out")}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <IconAction id="history-import" label={tr("Import a bank statement")} Icon={FileUp} onClick={() => setImporting(true)} />
            <IconAction id="history-expand-all" label={effectiveExpandAll ? tr("Collapse all") : tr("Expand all")}
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
            <input id="history-search" type="search" placeholder={tr("Search…")} aria-label={tr("Search name, note or amount")}
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 30px', borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', WebkitAppearance: 'none', appearance: 'none' }} />
            {search && (
              <button onClick={() => setSearch('')} aria-label={tr("Clear search")} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            )}
          </div>
          {hasFilter && (
            <button id="history-all-months" onClick={() => setAllMonths((v) => !v)} aria-pressed={allMonths}
              style={{ flexShrink: 0, padding: '8px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${allMonths ? 'var(--accent)' : 'var(--border)'}`, background: allMonths ? 'var(--accent-bg)' : 'var(--surface2)', color: allMonths ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {tr("All months")}
            </button>
          )}
        </div>

        {/* In / out for the month, then one chip per kind — tap to filter */}
        <div id="history-kinds" className="cat-scroll" style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
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
            {tr("Clear filters")}
          </button>
        )}
      </div>

      {/* Body */}
      <div id="history-list" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {(flow.in > 0 || flow.out > 0) && (
          <div className="card hist-summary" id="history-summary">
            <div className="tl-title">{tr("Net ·")} {searchAll ? 'all months' : monthName(viewMonth, { month: 'long', year: 'numeric' })}</div>
            <BigAmount value={flow.in - flow.out} size={phone ? 26 : 38} color={flow.in - flow.out < 0 ? 'var(--expense)' : undefined} />
            <div className="hist-summary-strip">
              <div><div className="tl-fig-value" style={{ color: 'var(--income)' }}>+{formatMoneyCompact(flow.in)}</div><div className="tl-fig-label">{tr("Money in")}</div></div>
              <div><div className="tl-fig-value">−{formatMoneyCompact(flow.out)}</div><div className="tl-fig-label">{tr("Money out")}</div></div>
              <div><div className="tl-fig-value">{periodTxns.length}</div><div className="tl-fig-label">{tr("Entries")}</div></div>
            </div>
          </div>
        )}
        {!tipHidden && grouped.length > 0 && settings?.historyTap !== 'edit' && (
          <div id="history-tip" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', padding: '8px 12px', borderRadius: 12, background: 'var(--surface2)', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <Flame size={13} style={{ color: 'var(--expense)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{tr('Tap an expense: all of it wasted · double-tap: how much · swipe right: edit · swipe left: delete')}</span>
            <button type="button" aria-label={tr('Got it')} onClick={hideTip} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>
        )}
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <LayoutList size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {hasFilter ? tr("Nothing matches these filters") : tr("Nothing in this period yet")}
            </p>
          </div>
        ) : grouped.map((group) => {
          const collapsed = !isGroupExpanded(group.label);
          const gin  = sumAmounts(group.entries.filter((t) => ENTRY_KINDS[t._kind].sign > 0));
          const gout = sumAmounts(group.entries.filter((t) => ENTRY_KINDS[t._kind].sign < 0));
          return (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <button onClick={() => toggleGroup(group.label)} className="hist-group">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {collapsed ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
                  <span className="hist-group-title">{grouping === 'day' ? dayName(group.entries[0].date) : group.label}</span>
                </span>
                <span className="hist-group-side">
                  {gin > 0 && <span style={{ color: 'var(--income)' }}>+{formatAmount(gin)}</span>}
                  {gout > 0 && <span style={{ color: 'var(--expense)' }}>−{formatAmount(gout)}</span>}
                  <span className="hist-group-count">{group.entries.length} {tr("entr")}{group.entries.length === 1 ? 'y' : 'ies'}</span>
                </span>
              </button>
              {!collapsed && (
                <div className="hist-cards">
                  {group.entries.map((row) => (
                    <SwipeRow key={`${row._src}-${row.id}`} label={row.name} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)}>
                      <HistoryRow row={row} theme={theme} rules={categoryRules} settings={settings}
                        settled={settledByName.get(norm(row.name))}
                        onTap={() => tapRow(row)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} />
                    </SwipeRow>
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

/* One entry as a card row: an icon for what it is, what it was for, then the
   kind and category; on the right the signed amount, its status, edit and delete. */
const KIND_ICON = { income: Wallet, borrowed: ArrowDownLeft, got_back: Undo2, billing: Receipt, given: Gift, lent: ArrowUpRight, paid_back: Undo2, savings: PiggyBank, withdrawal: Banknote };

function HistoryRow({ row, theme, rules, settings, settled, onTap, onEdit, onDelete }) {
  // Which account — once there's more than the starter Bank + Cash
  const acc = accountsSetUp(settings) && row.type !== 'cash' && !(row.type === 'expense' && row.paidFrom === 'savings')
    ? listAccounts(settings).find((a) => a.id === accountOf(row, settings)) : null;
  const k = ENTRY_KINDS[row._kind];
  const incoming = k.sign > 0;
  const neutral = k.sign === 0;            // cash withdrawn: account → wallet
  const debt = isDebtKind(row._kind);
  const wasted = row._kind === 'expense' && row.wasteAmount > 0;
  const cat = row._kind === 'expense' ? categoryOf(row, rules) : null;
  const catColor = cat ? categoryColor(cat, theme) : null;
  const KindIcon = KIND_ICON[row._kind];

  let detail = null;
  if (cat) detail = <span className="hist-bit" style={{ color: catColor }}>{categoryMeta(cat).label}</span>;
  else if (row._kind === 'savings') detail = <span className="hist-bit">{getSavingsType(row.savingsType).label}{row.platform ? ` · ${row.platform}` : ''}</span>;
  else if (neutral) detail = <span className="hist-bit">{tr("Account → wallet")}</span>;
  else if (row.note) detail = <span className="hist-bit">{row.note}</span>;

  // Only debts have a status worth showing (open / settled); "Done" on every expense was noise
  const status = debt
    ? (settled ? { label: tr("Settled"), Icon: CheckCircle2, color: 'var(--income)' } : { label: tr("Open"), Icon: Clock3, color: 'var(--borrowed)' })
    : null;

  // A card per entry: a colour edge for what it is, its icon, what it was
  // for with kind · category beneath; the signed amount large on the right
  // with its status, edit and delete
  const edge = cat ? catColor : `var(--${k.tone})`;
  return (
    <div className="hist-row" role="button" tabIndex={0} onClick={onTap ?? onEdit} style={{ '--edge': edge }}
      title={row._kind === 'expense' && settings?.historyTap !== 'edit' ? tr('Tap: wasted · double-tap: how much · swipe right: edit') : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}>
      <span className="hist-tile" aria-hidden
        style={cat ? { color: catColor, background: `${catColor}1f` } : { color: `var(--${k.tone})`, background: `var(--${k.tone}-bg)` }}>
        {cat ? <CategoryIcon category={cat} size={17} /> : <KindIcon size={17} />}
      </span>
      <span className="hist-main">
        <span className="hist-name">{row.name}</span>
        <span className="hist-meta">
          <span className="hist-bit hist-kind" style={{ color: `var(--${k.tone})` }}>{k.label}</span>
          {detail}
          {acc ? <span className="hist-bit hist-acct"><span className="acct-dot" aria-hidden style={{ background: colorOf(acc, theme === 'monoflow') }} /> {accountLabel(acc)}</span>
            : row.paidWith === 'cash' && <span className="hist-bit" title={tr("Paid in cash")}><Banknote size={11} /> {tr("Cash")}</span>}
          {wasted && <span className="hist-bit" style={{ color: 'var(--expense)' }}><Flame size={10} /> {formatAmount(row.wasteAmount)} {tr("wasted")}</span>}
        </span>
      </span>
      <span className="hist-side">
        <span className="hist-amount" style={{ color: neutral ? 'var(--text-secondary)' : incoming ? 'var(--income)' : 'var(--text)' }}>
          <EntryAmount entry={row} prefix={neutral ? '' : incoming ? '+' : '−'} />
        </span>
        <span className="hist-foot">
          {status && (
            <span className="hist-status" style={{ color: status.color }} title={settled ? tr("This person’s balance is back to zero") : tr("Still to be returned")}>
              <status.Icon size={11} />{status.label}
            </span>
          )}
          <button aria-label={`Edit ${row.name}`} title={tr("Edit")} className="hist-btn hist-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Pencil size={13} /></button>
          <button aria-label={`Delete ${row.name}`} title={tr("Delete")} className="hist-btn hist-del" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={13} /></button>
        </span>
      </span>
    </div>
  );
}

/* How much of an expense was wasted: all, a part, or none */
function WasteModal({ row, onSave, onClose }) {
  const total = Number(row.amount) || 0;
  const [v, setV] = useState(String(row.wasteAmount > 0 ? row.wasteAmount : total));
  const n = Number(v);
  const ok = v !== '' && n >= 0 && n <= total;
  const save = () => { if (!ok) return; onSave(n); onClose(); };
  const chip = (on) => ({ padding: '6px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${on ? 'var(--expense)' : 'var(--border)'}`, background: on ? 'var(--expense-bg)' : 'var(--surface2)', color: on ? 'var(--expense)' : 'var(--text-secondary)', borderRadius: 99 });
  return (
    <ModalShell title={tr('How much was wasted?')} subtitle={`${row.name} · ${formatAmount(total)}`} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
        <PrimaryButton onClick={save} disabled={!ok} color="var(--expense)"><Flame size={14} /> {n > 0 ? `${tr('Wasted')} ${formatAmount(n)}` : tr('Not wasted')}</PrimaryButton>
      </>}>
      <Field label={tr('Wasted')}>
        <input id="waste-amount" type="text" inputMode="decimal" value={v} autoFocus
          onChange={(e) => { const x = e.target.value; if (x === '' || /^\d*\.?\d*$/.test(x)) setV(x); }}
          onKeyDown={(e) => e.key === 'Enter' && save()} style={{ ...fieldStyle, fontSize: 18, fontWeight: 800 }} />
      </Field>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[[1, tr('All of it')], [0.75, '¾'], [0.5, '½'], [0.25, '¼'], [0, tr('None')]].map(([f, l]) => {
          const amt = Math.round(total * f * 100) / 100;
          return <button key={l} type="button" onClick={() => setV(String(amt))} style={chip(n === amt)}>{l}{f > 0 && f < 1 ? ` · ${formatAmount(amt)}` : ''}</button>;
        })}
      </div>
    </ModalShell>
  );
}

/* "Today", "Yesterday", "Mon, 19 Oct" (with the year when it isn't this one) */
function dayName(iso) {
  const d = new Date(iso), today = new Date(), y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

function IconAction({ id, label, Icon, onClick }) {
  return <HeaderAction id={id} label={label} Icon={Icon} onClick={onClick} />;
}
