// ─── Debts ───────────────────────────────────────────────────────
// Who owes you and whom you owe — lent, borrowed, got back, paid back —
// from transactions AND income, so money returned to you (recorded as
// income) closes the debt. Gifts ("given, no return expected") are
// spending and never listed. Debts aren't monthly: they carry over until
// settled, and settled people stay in their own list for the record.
import { useMemo, useState } from 'react';
import { Plus, Search, ChevronRight, ChevronDown, ArrowLeft, Pencil, Trash2, Check, X, ArrowLeftRight } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill } from '../../components/Page';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { useShell } from '../../app/shellContext';
import { debtLedger, debtTotals, DEBT_MOVES, DEBT_MOVE_KEYS, debtEntryFields } from '../../utils/debts';
import Sheet from '../../components/Sheet';
import Sign from '../../motion/Sign';
import { generateId } from '../../utils/storage';
import { formatAmount, isoToDateInput, dateInputToISO, isoToMonth, todayInputValue } from '../../utils/dateHelpers';
import { currencySymbol } from '../../utils/money';
import EntryAmount from '../../components/EntryAmount';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DebtsPage({
  transactions = [], income = [],
  onAddTransaction, onAddIncome, onUpdateTransaction, onDeleteTransaction, onUpdateIncome, onDeleteIncome,
}) {
  const shell = useShell();
  const [openKey, setOpenKey] = useState(null);
  const [search, setSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const ledger = useMemo(() => debtLedger(transactions, income), [transactions, income]);
  const totals = debtTotals(ledger);
  const person = openKey && ledger.find((p) => p.key === openKey);
  const add = (opts) => shell?.openAdd('debt', opts);

  if (person) {
    return <PersonDebt person={person} onBack={() => setOpenKey(null)} onAdd={add}
      onUpdate={(e, patch) => (e.source === 'income' ? onUpdateIncome : onUpdateTransaction)?.({ ...e.entry, ...patch })}
      onDelete={(e) => (e.source === 'income' ? onDeleteIncome : onDeleteTransaction)?.(e.id)} />;
  }

  const q = search.trim().toLowerCase();
  const match = (p) => !q || p.name.toLowerCase().includes(q);
  const owesYou = ledger.filter((p) => p.net > 0 && match(p));
  const youOwe = ledger.filter((p) => p.net < 0 && match(p));
  const settled = ledger.filter((p) => p.settled && match(p));

  return (
    <div className="tab-root debts-page">
      <PageHeader title="Debts" subtitle="Lent, borrowed, paid back — carried over until settled"
        actions={<HeaderAction id="debts-add" Icon={Plus} label="Add" onClick={() => add({ move: 'lent' })} />} />

      <div className="tab-body">
        {ledger.length === 0 ? (
          <>
          <QuickDebts ledger={ledger} onAddTransaction={onAddTransaction} onAddIncome={onAddIncome} toast={shell?.toast} />
          <EmptyState Icon={ArrowLeftRight} tone="lent" title="No debts yet"
            text="Lend or borrow money and it’s tracked here per person until it’s paid back. Money you simply gave away is spending, not a debt."
            action={<PrimaryPill id="debts-empty-add" Icon={Plus} tone="lent" onClick={() => add({ move: 'lent' })}>Add a debt</PrimaryPill>} />
          </>
        ) : (
          <>
            <QuickDebts ledger={ledger} onAddTransaction={onAddTransaction} onAddIncome={onAddIncome} toast={shell?.toast} />
            <div className="card debts-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 0, overflow: 'hidden' }}>
              <Total label="Owed to you" value={totals.owedToYou} tone="lent" count={ledger.filter((p) => p.net > 0).length} />
              <Total label="You owe" value={totals.youOwe} tone="borrowed" count={ledger.filter((p) => p.net < 0).length} border />
            </div>

            {ledger.length > 5 && (
              <div style={{ position: 'relative', marginTop: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input id="debts-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…"
                  style={{ width: '100%', padding: '11px 14px 11px 38px', fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            )}

            {owesYou.length > 0 && <List id="debts-owe-you" title="Owe you" hint="they’ll pay you back" people={owesYou} onOpen={setOpenKey} />}
            {youOwe.length > 0 && <List id="debts-you-owe" title="You owe" hint="you’ll pay them back" people={youOwe} onOpen={setOpenKey} />}
            {!owesYou.length && !youOwe.length && !q && (
              <div className="card" style={{ marginTop: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sign kind="check" size={18} /></span>
                <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-secondary)' }}>All settled — nobody owes anything.</span>
              </div>
            )}

            {settled.length > 0 && (
              <>
                <button id="debts-settled-toggle" onClick={() => setShowSettled((s) => !s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '20px 4px 8px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span className="section-label" style={{ margin: 0 }}>Settled · {settled.length}</span>
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showSettled ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {showSettled && <List people={settled} onOpen={setOpenKey} bare />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Quick entry: a sheet of debts, saved together ─────────────
   Person completes from your ledger (a new name is fine), Type from
   Lent / Borrowed / Got back / Paid back ("g" → Got back). */
const draftRow = (list = []) => ({ id: generateId(), name: '', move: list[list.length - 1]?.move ?? 'lent', amount: '', note: '', date: todayInputValue() });
const readyRow = (r) => r.name.trim() && DEBT_MOVES[r.move] && Number(r.amount) > 0;

function QuickDebts({ ledger, onAddTransaction, onAddIncome, toast }) {
  const [rows, setRows] = useState([]);
  const ready = rows.filter(readyRow);
  const sum = ready.reduce((t, r) => t + Number(r.amount), 0);
  function save() {
    ready.forEach((r) => {
      const { store, fields } = debtEntryFields(r.move);
      const iso = dateInputToISO(r.date || todayInputValue());
      const name = r.name.trim();
      const entry = { id: generateId(), name: name.charAt(0).toUpperCase() + name.slice(1), amount: Number(r.amount), ...fields, ...(r.note.trim() ? { note: r.note.trim() } : {}), date: iso, month: isoToMonth(iso) };
      if (store === 'income') onAddIncome?.(entry); else onAddTransaction?.(entry);
    });
    setRows(rows.filter((r) => !readyRow(r)));
    toast?.(`Added ${ready.length} debt entr${ready.length === 1 ? 'y' : 'ies'} · ${formatAmount(sum)}`);
  }
  return (
    <div id="debts-quick" style={{ marginBottom: 14 }}>
      <SectionHeading title="Quick entry" hint="type, Enter to move on — paste from Excel works" />
      <Sheet id="debts-sheet" tone="lent" rows={rows} onChange={setRows} makeRow={draftRow} rowLabel={(r) => r.name}
        columns={[
          { key: 'name', label: 'Person', type: 'pick', width: 'minmax(96px, 1.1fr)', placeholder: 'Who?', options: ledger.map((p) => ({ value: p.name, label: p.name })), onCreate: (n) => n },
          { key: 'move', label: 'Type', type: 'pick', width: 'minmax(92px, 0.9fr)', placeholder: 'Lent', options: DEBT_MOVE_KEYS.map((k) => ({ value: k, label: DEBT_MOVES[k].label })) },
          { key: 'amount', label: `Amount ${currencySymbol()}`, type: 'amount', width: '96px', placeholder: '0' },
          { key: 'note', label: 'Note', type: 'text', width: 'minmax(80px, 1fr)', placeholder: 'optional' },
          { key: 'date', label: 'Date', type: 'date', width: '132px' },
        ]}
        footer={
          <button id="debts-quick-save" type="button" onClick={save} disabled={!ready.length}
            style={{ marginLeft: 'auto', padding: '7px 14px', border: 'none', fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: ready.length ? 'pointer' : 'default', background: ready.length ? 'var(--lent)' : 'var(--surface)', color: ready.length ? '#fff' : 'var(--text-muted)' }}>
            {ready.length ? `Save ${ready.length} entr${ready.length === 1 ? 'y' : 'ies'} · ${formatAmount(sum)}` : 'Fill a row to save'}
          </button>
        } />
    </div>
  );
}

function Total({ label, value, tone, count, border }) {
  return (
    <div style={{ padding: '14px 16px', borderLeft: border ? '1px solid var(--border)' : 'none' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: value > 0 ? `var(--${tone})` : 'var(--text-muted)', letterSpacing: '-0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(value)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{count ? `${count} ${count === 1 ? 'person' : 'people'}` : 'Nobody'}</div>
    </div>
  );
}

function List({ id, title, hint, people, onOpen, bare }) {
  return (
    <>
      {!bare && <SectionHeading id={id} title={title} hint={hint} />}
      <div className="card">
        {people.map((p, i) => {
          const tone = p.settled ? null : p.net > 0 ? 'lent' : 'borrowed';
          return (
            <button key={p.key} id={`debt-${p.key.replace(/\s+/g, '-')}`} onClick={() => onOpen(p.key)} className="debt-row"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 'none', borderTop: i ? '1px solid var(--border)' : 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span className="debt-avatar" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, background: tone ? `var(--${tone}-bg)` : 'var(--surface2)', color: tone ? `var(--${tone})` : 'var(--text-muted)' }}>
                {p.name[0]?.toUpperCase() ?? '?'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {p.entries.length} entr{p.entries.length === 1 ? 'y' : 'ies'} · last {fmtDate(p.lastDate)}
                </span>
              </span>
              <span style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: tone ? `var(--${tone})` : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{p.settled ? 'Settled' : formatAmount(Math.abs(p.net))}</span>
                {!p.settled && <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{p.net > 0 ? 'owes you' : 'you owe'}</span>}
              </span>
              <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── One person ── */
function PersonDebt({ person, onBack, onAdd, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const p = person;
  const tone = p.settled ? 'income' : p.net > 0 ? 'lent' : 'borrowed';
  const actions = p.settled
    ? [{ move: 'lent', label: 'Lend' }, { move: 'borrowed', label: 'Borrow' }]
    : p.net > 0
      ? [{ move: 'got_back', label: 'Got money back', primary: true, amount: p.net }, { move: 'lent', label: 'Lend more' }]
      : [{ move: 'paid_back', label: 'Pay back', primary: true, amount: -p.net }, { move: 'borrowed', label: 'Borrow more' }];

  return (
    <div className="tab-root debts-person">
      {deleting && (
        <ConfirmDeleteModal title="Delete this entry?" message="It moves to Recently Deleted (Profile → Your data), where you can restore it."
          onConfirm={() => { onDelete(deleting); setDeleting(null); }} onCancel={() => setDeleting(null)} />
      )}
      <div className="tab-header page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button id="debt-person-back" onClick={onBack} aria-label="Back to debts"
            style={{ width: 34, height: 34, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={17} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 750, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{p.entries.length} entr{p.entries.length === 1 ? 'y' : 'ies'}</p>
          </div>
        </div>
      </div>

      <div className="tab-body">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {p.settled ? 'All settled' : p.net > 0 ? `${p.name} owes you` : `You owe ${p.name}`}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: `var(--${tone})`, letterSpacing: '-0.03em', marginTop: 2 }}>{formatAmount(Math.abs(p.net))}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <Mini label="Lent" value={p.lent} />
            <Mini label="Got back" value={p.gotBack} />
            <Mini label="Borrowed" value={p.borrowed} />
            <Mini label="Paid back" value={p.paidBack} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {actions.map((a) => (
              <button key={a.move} id={`debt-action-${a.move}`} onClick={() => onAdd({ move: a.move, name: p.name })}
                style={{ flex: 1, minWidth: 120, padding: '10px 14px', border: a.primary ? 'none' : '1px solid var(--border)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: a.primary ? `var(--${DEBT_MOVES[a.move].tone})` : 'var(--surface2)', color: a.primary ? '#fff' : 'var(--text-secondary)' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <SectionHeading title="History" hint="newest first" />
        <div className="card">
          {p.entries.map((e, i) => {
            const m = DEBT_MOVES[e.move];
            const isIn = e.move === 'got_back' || e.move === 'borrowed';
            return (
              <div key={`${e.source}-${e.id}`} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                {editing === e.id ? (
                  <EditRow entry={e} onCancel={() => setEditing(null)} onSave={(patch) => { onUpdate(e, patch); setEditing(null); }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                    <span style={{ padding: '3px 9px', fontSize: 11, fontWeight: 700, background: `var(--${m.tone}-bg)`, color: `var(--${m.tone})`, borderRadius: 99, flexShrink: 0 }}>{m.label}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtDate(e.date)}</span>
                      {e.note && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</span>}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 750, color: isIn ? 'var(--income)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}><EntryAmount entry={e} prefix={isIn ? '+' : '−'} /></span>
                    <button aria-label="Edit" onClick={() => setEditing(e.id)} style={iconBtn}><Pencil size={13} /></button>
                    <button aria-label="Delete" onClick={() => setDeleting(e)} style={iconBtn}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const iconBtn = { width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

function Mini({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 750, color: value ? 'var(--text)' : 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatAmount(value)}</div>
    </div>
  );
}

function EditRow({ entry, onSave, onCancel }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [dateInput, setDateInput] = useState(isoToDateInput(entry.date));
  const [note, setNote] = useState(entry.note ?? '');
  const ok = Number(amount) > 0;
  const input = { padding: '8px 10px', fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', minWidth: 0 };
  return (
    <div style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface2)' }}>
      <input aria-label="Amount" value={amount} inputMode="decimal" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }} style={{ ...input, width: 100, fontWeight: 700 }} autoFocus />
      <input aria-label="Date" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} style={{ ...input, width: 140 }} />
      <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" style={{ ...input, flex: 1, minWidth: 120 }} />
      <button aria-label="Save" disabled={!ok} onClick={() => { const iso = dateInputToISO(dateInput); onSave({ amount: Number(amount), date: iso, month: isoToMonth(iso), note: note.trim() || null }); }}
        style={{ ...iconBtn, background: ok ? 'var(--accent)' : 'var(--surface)', color: ok ? '#fff' : 'var(--text-muted)' }}><Check size={14} /></button>
      <button aria-label="Cancel" onClick={onCancel} style={iconBtn}><X size={14} /></button>
    </div>
  );
}
