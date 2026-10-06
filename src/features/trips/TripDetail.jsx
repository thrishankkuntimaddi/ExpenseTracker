// ─── TripDetail ───────────────────────────────────────────────────
// Two steps, like a paper settlement:
//   1. The table — Person | What | Amount — fill it in as the trip goes.
//   2. Settle up — totals, paid vs share per wallet, who pays whom, mark paid, close.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Check, ArrowRight, ArrowLeft, Users, Share2, Lock, Unlock, Pencil, CheckCircle2, Receipt, UserPlus, GripVertical, X } from 'lucide-react';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { formatAmount, formatDateShort } from '../../utils/dateHelpers';
import { computeTripSummary } from '../../utils/split';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';

const thStyle = {
  padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-muted)', background: 'var(--surface2)', textAlign: 'left', borderBottom: '1px solid var(--border)',
};
const cellInput = {
  width: '100%', border: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 500, outline: 'none', padding: '9px 10px', minWidth: 0,
};

const newRow = (paidBy = '', date) => ({ id: generateId(), title: '', amount: '', paidBy, splitAmong: [], date });
const isValidRow = (r) => r.paidBy && r.title.trim() && Number(r.amount) > 0;

export default function TripDetail({ trip, onChange, onEdit, onShare, onClose, onReopen, onDelete }) {
  const closed = trip.status === 'closed';
  const members = trip.members ?? [];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMember, setEditingMember] = useState(null);   // member id whose inline editor is open
  const [stepState, setStep] = useState(1);
  const step = closed ? 2 : stepState;   // a closed trip always shows the settlement

  /* ── Table rows: local, debounced autosave (one Firestore write per pause, not per keystroke) ── */
  const [rows, setRows] = useState(() => (trip.expenses?.length ? trip.expenses : [newRow(trip.meMemberId ?? members[0]?.id, trip.startDate)]));
  const [dirty, setDirty] = useState(false);     // unsaved local edits (render-visible)
  const dirtyRef = useRef(false);                // same flag for the unmount flush
  const timer = useRef(null);
  const latest = useRef({ trip, rows });
  useEffect(() => { latest.current = { trip, rows }; }, [trip, rows]);

  // Adopt rows arriving from the server (another device) unless we are mid-edit
  const [syncedFrom, setSyncedFrom] = useState(trip.expenses);
  if (trip.expenses !== syncedFrom) {
    setSyncedFrom(trip.expenses);
    if (!dirty && trip.expenses?.length) setRows(trip.expenses);
  }

  const persist = () => {
    clearTimeout(timer.current);
    const { trip: t, rows: r } = latest.current;
    const kept = r.filter((x) => x.title.trim() || x.amount !== '' || x.paidBy);
    onChange({ ...t, expenses: kept.map((x) => ({ ...x, amount: x.amount === '' ? '' : Number(x.amount) })) });
    dirtyRef.current = false; setDirty(false);
  };
  const scheduleSave = () => { dirtyRef.current = true; setDirty(true); clearTimeout(timer.current); timer.current = setTimeout(persist, 700); };
  useEffect(() => () => { if (dirtyRef.current) persist(); clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (id, patch) => { setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r))); scheduleSave(); };
  const removeRow = (id) => { setRows((p) => (p.length > 1 ? p.filter((r) => r.id !== id) : [newRow(trip.meMemberId ?? members[0]?.id, trip.startDate)])); scheduleSave(); };
  const addRow = () => setRows((p) => [...p, newRow(p[p.length - 1]?.paidBy ?? trip.meMemberId ?? members[0]?.id, trip.startDate)]);
  const moveRow = (from, to) => {
    if (from === to) return;
    setRows((p) => { const n = p.slice(); const [r] = n.splice(from, 1); n.splice(to, 0, r); return n; });
    scheduleSave();
  };

  /* Drag-to-reorder via pointer events (mouse + touch). The grip has
     touch-action: none so the page does not scroll while dragging. */
  const drag = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  function gripDown(e, index, id) {
    const rowEl = e.currentTarget.closest('[data-row]');
    drag.current = { startY: e.clientY, from: index, cur: index, rowH: rowEl?.offsetHeight || 40, count: rows.length };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDraggingId(id);
  }
  function gripMove(e) {
    const d = drag.current; if (!d) return;
    const target = Math.max(0, Math.min(d.count - 1, d.from + Math.round((e.clientY - d.startY) / d.rowH)));
    if (target !== d.cur) { moveRow(d.cur, target); d.cur = target; }
  }
  function gripUp() { drag.current = null; setDraggingId(null); }
  function gripKey(e, index) {
    if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); moveRow(index, index - 1); }
    if (e.key === 'ArrowDown' && index < rows.length - 1) { e.preventDefault(); moveRow(index, index + 1); }
  }

  /* People: inline editing (me / pays together / remove) */
  const usedBy = (id) => rows.some((r) => r.paidBy === id);
  function updateMembers(nextMembers, extra = {}) { onChange({ ...trip, members: nextMembers, ...extra }); }
  function renameMember(id, name) { updateMembers(members.map((m) => (m.id === id ? { ...m, name } : m))); }
  function setMe(id) { onChange({ ...trip, meMemberId: trip.meMemberId === id ? undefined : id }); }
  function setPaysWith(id, otherId) {
    const other = members.find((m) => m.id === otherId);
    if (!other) { updateMembers(members.map((m) => (m.id === id ? { ...m, groupId: undefined } : m))); return; }
    const gid = other.groupId ?? generateId();
    updateMembers(members.map((m) => (m.id === id || m.id === otherId ? { ...m, groupId: gid } : m)));
  }
  function removeMember(id) {
    if (usedBy(id)) return;
    const left = members.filter((m) => m.id !== id);
    const counts = {}; left.forEach((m) => { if (m.groupId) counts[m.groupId] = (counts[m.groupId] ?? 0) + 1; });
    updateMembers(left.map((m) => (m.groupId && counts[m.groupId] < 2 ? { id: m.id, name: m.name } : m)),
      { meMemberId: trip.meMemberId === id ? undefined : trip.meMemberId });
    setEditingMember(null);
  }

  /* ── People quick-add (grouping + "me" live in Edit trip) ── */
  const [newPerson, setNewPerson] = useState('');
  function addPeople(raw) {
    const names = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const fresh = names.filter((n) => !members.some((m) => m.name.toLowerCase() === n.toLowerCase())).map((n) => ({ id: generateId(), name: n }));
    if (fresh.length) onChange({ ...trip, members: [...members, ...fresh] });
    setNewPerson('');
  }

  /* ── Summary from the valid rows only ── */
  const validExpenses = useMemo(() => rows.filter(isValidRow).map((r) => ({ ...r, amount: Number(r.amount) })), [rows]);
  const tripForMaths = useMemo(() => ({ ...trip, expenses: validExpenses }), [trip, validExpenses]);
  const s = useMemo(() => computeTripSummary(tripForMaths), [tripForMaths]);
  const tableTotal = validExpenses.reduce((sum, r) => sum + r.amount, 0);
  const canContinue = validExpenses.length > 0 && members.length >= 2;
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? '?';

  function markPaid(t) {
    onChange({ ...trip, settlements: [...(trip.settlements ?? []), { id: generateId(), fromUnit: t.from, toUnit: t.to, amount: t.amount, date: toKey(new Date()) }] });
  }
  function removeSettlement(id) { onChange({ ...trip, settlements: trip.settlements.filter((x) => x.id !== id) }); }
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));

  /* ═══ Stepper ═══ */
  const stepper = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {[{ n: 1, label: 'Who paid for what' }, { n: 2, label: 'Settle up' }].map((st, i) => {
        const active = step === st.n, done = step > st.n;
        return (
          <div key={st.n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === 0 ? '0 0 auto' : '1 1 auto' }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: done || active ? 'var(--external)' : 'var(--border)', borderRadius: 2, minWidth: 16 }} />}
            <button onClick={() => (st.n === 1 ? !closed && setStep(1) : canContinue && (persist(), setStep(2)))} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${active ? 'var(--external)' : 'var(--border)'}`,
              background: active ? 'var(--external)' : done ? 'var(--external-bg)' : 'transparent',
              color: active ? '#fff' : done ? 'var(--external)' : 'var(--text-muted)',
            }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, background: active ? 'rgba(255,255,255,.25)' : 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{done ? '✓' : st.n}</span>
              {st.label}
            </button>
          </div>
        );
      })}
    </div>
  );

  /* ═══ STEP 1 — the table ═══ */
  if (step === 1) {
    return (
      <div>
        {stepper}

        {/* People */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={12} /> People · {members.length}</span>
            <button onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)' }}>
              <Pencil size={10} /> Who is me · pays together
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Tap a person to set “this is me”, who they pay together with, or remove them.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {members.map((m) => {
              const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
              const active = editingMember === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setEditingMember(active ? null : m.id)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  background: active ? 'var(--external)' : 'var(--surface2)', border: `1.5px solid ${active ? 'var(--external)' : 'var(--border)'}`,
                  color: active ? '#fff' : 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {m.name}{m.id === trip.meMemberId && <span style={{ color: active ? '#fff' : 'var(--external)' }}>· me</span>}{partner && <span style={{ color: active ? 'rgba(255,255,255,.8)' : 'var(--text-muted)', fontWeight: 500 }}>· with {partner.name}</span>}
                  <Pencil size={9} style={{ opacity: 0.7 }} />
                </button>
              );
            })}
          </div>
          {editingMember && members.some((m) => m.id === editingMember) && (() => {
            const m = members.find((x) => x.id === editingMember);
            const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
            const others = members.filter((o) => o.id !== m.id);
            return (
              <div style={{ padding: 12, borderRadius: 12, border: '1.5px solid var(--external-border)', background: 'var(--external-bg)', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" value={m.name} onChange={(e) => renameMember(m.id, e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 13, fontWeight: 700, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={() => setEditingMember(null)} aria-label="Done" style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'var(--external)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={trip.meMemberId === m.id} onChange={() => setMe(m.id)} style={{ width: 16, height: 16, accentColor: 'var(--external)' }} />
                  This is me (my share and dues go to my ledger on close)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  <span>Pays together with</span>
                  <select value={partner?.id ?? ''} onChange={(e) => setPaysWith(m.id, e.target.value)} style={{ flex: '0 1 170px', padding: '7px 8px', borderRadius: 9, fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                    <option value="">Nobody — pays alone</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Two people who pay together count as one wallet: their spending and dues are combined (e.g. a couple).</div>
                <button onClick={() => removeMember(m.id)} disabled={usedBy(m.id)} title={usedBy(m.id) ? 'Has rows in the table — reassign them first' : 'Remove from trip'} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: usedBy(m.id) ? 'not-allowed' : 'pointer', opacity: usedBy(m.id) ? 0.5 : 1, background: 'var(--expense-bg)', color: 'var(--expense)', border: '1px solid var(--expense-border)' }}>
                  <X size={12} /> Remove {m.name}{usedBy(m.id) ? ' (has rows)' : ''}
                </button>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={newPerson} placeholder="Add people — comma separated" onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPeople(newPerson); } }}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => addPeople(newPerson)} style={{ padding: '0 12px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}><UserPlus size={13} /> Add</button>
          </div>
        </div>

        {/* The table */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Receipt size={14} style={{ color: 'var(--external)' }} /> Expenses</span>
          <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={11} /> Add Row
          </button>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(90px, 1.1fr) minmax(80px, 1.6fr) 88px 32px' }}>
            <div style={{ ...thStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Drag to reorder"><GripVertical size={12} /></div>
            <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Person</div>
            <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>What paid</div>
            <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
            <div style={thStyle} />
          </div>
          {rows.map((r, i) => (
            <div key={r.id} data-row style={{ display: 'grid', gridTemplateColumns: '34px minmax(90px, 1.1fr) minmax(80px, 1.6fr) 88px 32px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', background: draggingId === r.id ? 'var(--external-bg)' : isValidRow(r) ? 'transparent' : 'var(--surface2)', boxShadow: draggingId === r.id ? 'inset 0 0 0 1.5px var(--external)' : 'none', transition: 'background 0.12s' }}>
              <button type="button" aria-label="Drag to reorder (or use arrow keys)" title="Drag to reorder · ↑/↓ keys"
                onPointerDown={(e) => gripDown(e, i, r.id)} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={gripUp} onKeyDown={(e) => gripKey(e, i)}
                style={{ width: 34, height: 38, border: 'none', background: 'transparent', color: draggingId === r.id ? 'var(--external)' : 'var(--text-muted)', cursor: draggingId === r.id ? 'grabbing' : 'grab', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
                <GripVertical size={14} />
              </button>
              <select value={r.paidBy} onChange={(e) => updateRow(r.id, { paidBy: e.target.value })} style={{ ...cellInput, fontWeight: 600, appearance: 'auto', borderLeft: '1px solid var(--border)' }}>
                <option value="">Who?</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="text" value={r.title} placeholder="Fuel, hotel, dinner…" onChange={(e) => updateRow(r.id, { title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && i === rows.length - 1 && isValidRow(r)) addRow(); }}
                style={{ ...cellInput, borderLeft: '1px solid var(--border)' }} />
              <input type="text" inputMode="decimal" value={r.amount} placeholder="0" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateRow(r.id, { amount: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && isValidRow(r)) { if (i === rows.length - 1) addRow(); } }}
                style={{ ...cellInput, borderLeft: '1px solid var(--border)', fontWeight: 700, textAlign: 'right' }} />
              <button onClick={() => removeRow(r.id)} aria-label="Remove row" style={{ width: 32, height: 36, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{validExpenses.length} item{validExpenses.length === 1 ? '' : 's'} · {members.length} people{members.length ? ` · ${formatAmount(members.length ? tableTotal / members.length : 0)} per head` : ''}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Total {formatAmount(tableTotal)}</span>
          </div>
        </div>

        {/* Per-person quick totals */}
        {validExpenses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {s.members.map((m) => (
              <span key={m.id} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {m.name}: <strong style={{ color: 'var(--text)' }}>{formatAmount(m.paid)}</strong>
              </span>
            ))}
          </div>
        )}

        <button onClick={() => { persist(); setStep(2); }} disabled={!canContinue} style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 12, border: 'none', background: canContinue ? 'var(--external)' : 'var(--surface2)', color: canContinue ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: 13, cursor: canContinue ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {canContinue ? 'Done — see who pays whom' : members.length < 2 ? 'Add at least two people' : 'Fill in at least one row'} <ArrowRight size={15} />
        </button>

        {onDelete && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <button onClick={() => setConfirmDelete(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--expense-bg)', color: 'var(--expense)', border: '1px solid var(--expense-border)' }}>
              <Trash2 size={13} /> Delete trip
            </button>
          </div>
        )}
        {confirmDelete && (
          <ConfirmDeleteModal title={`Delete “${trip.name}”?`} message="All its rows and settlements are removed. Entries already posted to your ledger stay."
            onConfirm={() => { setConfirmDelete(false); onDelete(trip.id); }} onCancel={() => setConfirmDelete(false)} />
        )}
      </div>
    );
  }

  /* ═══ STEP 2 — settle up ═══ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {stepper}

      {/* Summary */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Total spent</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, marginTop: 2 }}>{formatAmount(s.total)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {members.length} people · {formatAmount(s.perHead)} per head · {s.count} item{s.count === 1 ? '' : 's'}
              {trip.startDate && <> · {formatDateShort(trip.startDate)}{trip.endDate ? ` – ${formatDateShort(trip.endDate)}` : ''}</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!closed && <Btn onClick={() => setStep(1)} Icon={ArrowLeft}>Table</Btn>}
            <Btn onClick={onShare} Icon={Share2}>Share</Btn>
            {closed
              ? <Btn onClick={onReopen} Icon={Unlock}>Reopen</Btn>
              : <Btn onClick={onClose} Icon={Lock} filled disabled={!s.count}>Close trip</Btn>}
            {onDelete && <Btn onClick={() => setConfirmDelete(true)} Icon={Trash2} danger>Delete</Btn>}
          </div>
        </div>
        {confirmDelete && (
          <ConfirmDeleteModal title={`Delete “${trip.name}”?`} message="All its rows and settlements are removed. Entries already posted to your ledger stay."
            onConfirm={() => { setConfirmDelete(false); onDelete(trip.id); }} onCancel={() => setConfirmDelete(false)} />
        )}
        {closed && (
          <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 9, background: 'var(--surface2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={11} /> Closed{trip.closedAt ? ` on ${formatDateShort(trip.closedAt)}` : ''} — reopen to change anything.
          </div>
        )}
      </div>

      {/* Who pays whom */}
      <div className="card">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight size={12} /> Who pays whom</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.isSettled ? 'var(--income)' : 'var(--expense)' }}>
            {s.isSettled ? 'All settled ✓' : `${formatAmount(s.outstanding)} remaining`}
          </span>
        </div>
        {s.transfers.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} style={{ color: 'var(--income)' }} /> Everyone is square.
          </div>
        ) : s.transfers.map((t, i) => {
          const mine = s.meUnit && (t.from === s.meUnit || t.to === s.meUnit);
          return (
            <div key={`${t.from}-${t.to}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: i < s.transfers.length - 1 ? '1px solid var(--border)' : 'none', background: mine ? 'var(--external-bg)' : 'transparent' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)' }}>
                <strong>{t.fromName}</strong> <span style={{ color: 'var(--text-muted)' }}>pays</span> <strong>{t.toName}</strong>
                {mine && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--external)', marginLeft: 6 }}>{t.to === s.meUnit ? 'to you' : 'you pay'}</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--expense)', flexShrink: 0 }}>{formatAmount(t.amount)}</span>
              {!closed && (
                <button onClick={() => markPaid(t)} title="Mark as paid" style={{ height: 30, padding: '0 10px', borderRadius: 8, border: 'none', background: 'var(--income)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Check size={12} /> Paid
                </button>
              )}
            </div>
          );
        })}
        {(trip.settlements?.length ?? 0) > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Settled so far · {formatAmount(s.settledTotal)}</div>
            {trip.settlements.map((x) => (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                <CheckCircle2 size={12} style={{ color: 'var(--income)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>{unitName[x.fromUnit] ?? '?'} → {unitName[x.toUnit] ?? '?'} · {formatAmount(x.amount)}{x.date ? ` · ${formatDateShort(x.date)}` : ''}</span>
                {!closed && <button onClick={() => removeSettlement(x.id)} aria-label="Undo" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paid vs share */}
      <div className="card">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={12} /> Paid vs share</div>
        {s.units.map((u, i) => {
          const pos = u.remaining > 0.004, neg = u.remaining < -0.004;
          return (
            <div key={u.id} style={{ padding: '10px 14px', borderBottom: i < s.units.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {u.name}{u.id === s.meUnit && <span style={{ fontSize: 10, color: 'var(--external)', marginLeft: 6 }}>you</span>}
                    {u.isGroup && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>one wallet</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>paid {formatAmount(u.paid)} · share {formatAmount(u.share)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--income)' : neg ? 'var(--expense)' : 'var(--text-muted)' }}>
                    {pos ? `gets ${formatAmount(u.remaining)}` : neg ? `owes ${formatAmount(-u.remaining)}` : 'settled'}
                  </div>
                  {(u.settledIn > 0 || u.settledOut > 0) && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>after settlements</div>}
                </div>
              </div>
              <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${s.total ? Math.min(100, (u.paid / s.total) * 100) : 0}%`, height: '100%', background: 'var(--external)' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* The table, read-only recap */}
      <div className="card">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          <span>Expenses · {s.count}</span><span>{formatAmount(s.total)}</span>
        </div>
        {validExpenses.map((e, i) => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8, padding: '9px 14px', borderBottom: i < validExpenses.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(e.paidBy)}</span>
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
            <span style={{ fontWeight: 800, color: 'var(--text)' }}>{formatAmount(e.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn({ children, onClick, Icon, filled, disabled, danger }) {
  const tone = danger ? 'expense' : 'external';
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: filled ? `var(--${tone})` : `var(--${tone}-bg)`, color: filled ? '#fff' : `var(--${tone})`, border: filled ? 'none' : `1px solid var(--${tone}-border)` }}>
      <Icon size={12} /> {children}
    </button>
  );
}
