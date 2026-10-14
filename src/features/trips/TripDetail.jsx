// ─── TripDetail ───────────────────────────────────────────────────
// One screen, like the paper you'd draw after a trip:
//   left   the sheet — Person | What | Amount. Type a name (it completes
//          from the trip's people; a new name joins the trip), what was
//          paid for, the amount; Enter moves on. Paste rows from Excel.
//   right  the settlement, live — totals, who pays whom (mark paid),
//          paid vs share per wallet, share / close.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Check, ArrowRight, Users, Share2, Lock, Unlock, CheckCircle2, UserPlus, X } from 'lucide-react';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import Sheet from '../../components/Sheet';
import { formatAmount, formatDateShort } from '../../utils/dateHelpers';
import { computeTripSummary } from '../../utils/split';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';

const newRow = (paidBy = '', date) => ({ id: generateId(), title: '', amount: '', paidBy, splitAmong: [], date });
const isValidRow = (r) => r.paidBy && r.title.trim() && Number(r.amount) > 0;
const label = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 };

export default function TripDetail({ trip, onChange, onShare, onClose, onReopen, onDelete }) {
  const closed = trip.status === 'closed' || trip.status === 'archived';
  const members = useMemo(() => trip.members ?? [], [trip.members]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMember, setEditingMember] = useState(null);   // member id whose editor is open

  /* ── Rows: local, debounced autosave (one Firestore write per pause, not per keystroke) ── */
  const [rows, setRows] = useState(() => trip.expenses ?? []);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const timer = useRef(null);
  const latest = useRef({ trip, rows });
  const membersRef = useRef(members);
  useEffect(() => { latest.current = { trip, rows }; }, [trip, rows]);
  // People added from the sheet live here until the saved trip comes back with them
  useEffect(() => { membersRef.current = trip.members ?? []; }, [trip.members]);

  // Adopt rows arriving from the server (another device) unless we are mid-edit
  const [syncedFrom, setSyncedFrom] = useState(trip.expenses);
  if (trip.expenses !== syncedFrom) {
    setSyncedFrom(trip.expenses);
    if (!dirty && trip.expenses) setRows(trip.expenses);
  }

  const persist = () => {
    clearTimeout(timer.current);
    const { trip: t, rows: r } = latest.current;
    const kept = r.filter((x) => x.title.trim() || x.amount !== '');
    onChange({ ...t, members: membersRef.current, expenses: kept.map((x) => ({ ...x, amount: x.amount === '' ? '' : Number(x.amount) })) });
    dirtyRef.current = false; setDirty(false);
  };
  const setSheetRows = (next) => {
    setRows(next); latest.current = { ...latest.current, rows: next };
    dirtyRef.current = true; setDirty(true); clearTimeout(timer.current); timer.current = setTimeout(persist, 700);
  };
  useEffect(() => () => { if (dirtyRef.current) persist(); clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── People ── */
  function saveMembers(next, extra = {}) {
    membersRef.current = next;
    onChange({ ...latest.current.trip, members: next, ...extra });
  }
  // A name typed in the Person column that isn't on the trip yet joins it
  function createMember(name) {
    const existing = membersRef.current.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const m = { id: generateId(), name: name.charAt(0).toUpperCase() + name.slice(1) };
    saveMembers([...membersRef.current, m]);
    return m.id;
  }
  const usedBy = (id) => rows.some((r) => r.paidBy === id);
  const renameMember = (id, name) => saveMembers(members.map((m) => (m.id === id ? { ...m, name } : m)));
  const setMe = (id) => onChange({ ...latest.current.trip, meMemberId: trip.meMemberId === id ? undefined : id });
  function setPaysWith(id, otherId) {
    const other = members.find((m) => m.id === otherId);
    if (!other) { saveMembers(members.map((m) => (m.id === id ? { ...m, groupId: undefined } : m))); return; }
    const gid = other.groupId ?? generateId();
    saveMembers(members.map((m) => (m.id === id || m.id === otherId ? { ...m, groupId: gid } : m)));
  }
  function removeMember(id) {
    if (usedBy(id)) return;
    const left = members.filter((m) => m.id !== id);
    const counts = {}; left.forEach((m) => { if (m.groupId) counts[m.groupId] = (counts[m.groupId] ?? 0) + 1; });
    saveMembers(left.map((m) => (m.groupId && counts[m.groupId] < 2 ? { id: m.id, name: m.name } : m)),
      { meMemberId: trip.meMemberId === id ? undefined : trip.meMemberId });
    setEditingMember(null);
  }
  const [newPerson, setNewPerson] = useState('');
  function addPeople(raw) {
    raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).forEach(createMember);
    setNewPerson('');
  }

  /* ── The settlement, from the complete rows only ── */
  const validExpenses = useMemo(() => rows.filter(isValidRow).map((r) => ({ ...r, amount: Number(r.amount) })), [rows]);
  const tripForMaths = useMemo(() => ({ ...trip, members, expenses: validExpenses }), [trip, members, validExpenses]);
  const s = useMemo(() => computeTripSummary(tripForMaths), [tripForMaths]);
  const paidBy = Object.fromEntries(s.members.map((m) => [m.id, m.paid]));
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));
  function markPaid(t) {
    onChange({ ...latest.current.trip, settlements: [...(trip.settlements ?? []), { id: generateId(), fromUnit: t.from, toUnit: t.to, amount: t.amount, date: toKey(new Date()) }] });
  }
  const removeSettlement = (id) => onChange({ ...latest.current.trip, settlements: trip.settlements.filter((x) => x.id !== id) });

  const lastPayer = (list) => list[list.length - 1]?.paidBy ?? trip.meMemberId ?? members[0]?.id ?? '';
  const columns = [
    { key: 'paidBy', label: 'Person', type: 'pick', width: 'minmax(96px, 1fr)', placeholder: 'Who paid?', options: members.map((m) => ({ value: m.id, label: m.name })), onCreate: createMember },
    { key: 'title', label: 'What', type: 'text', width: 'minmax(110px, 1.6fr)', placeholder: 'Fuel, hotel, dinner…' },
    { key: 'amount', label: 'Amount ₹', type: 'amount', width: '104px', placeholder: '0' },
  ];

  const editing = editingMember && members.find((m) => m.id === editingMember);

  return (
    <div className="trip-layout">
      {/* ── LEFT: people + the sheet ── */}
      <div className="trip-entry" style={{ minWidth: 0 }}>
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ ...label, marginBottom: 8 }}><Users size={12} /> People · {members.length} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>— tap one for “me” or “pays together”</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {members.map((m) => {
              const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
              const on = editingMember === m.id;
              return (
                <button key={m.id} type="button" id={`trip-person-${m.id}`} onClick={() => setEditingMember(on ? null : m.id)} className="trip-chip" disabled={closed}
                  style={{ padding: '5px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: closed ? 'default' : 'pointer', border: `1.5px solid ${on ? 'var(--external)' : 'var(--border)'}`, background: on ? 'var(--external-bg)' : 'var(--surface2)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {m.name}
                  {m.id === trip.meMemberId && <span style={{ color: 'var(--external)' }}>· me</span>}
                  {partner && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· with {partner.name}</span>}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{formatAmount(paidBy[m.id] ?? 0)}</span>
                </button>
              );
            })}
            {!closed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '1 1 160px' }}>
                <input id="trip-add-person" type="text" value={newPerson} placeholder="Add people — comma separated" onChange={(e) => setNewPerson(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPeople(newPerson); } }}
                  style={{ flex: 1, minWidth: 0, padding: '6px 10px', fontSize: 12.5, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                <button type="button" aria-label="Add people" onClick={() => addPeople(newPerson)} style={{ width: 30, height: 30, border: 'none', background: 'var(--external)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserPlus size={13} /></button>
              </span>
            )}
          </div>
          {editing && !closed && (() => {
            const m = editing;
            const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
            const others = members.filter((o) => o.id !== m.id);
            return (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid var(--external-border)', background: 'var(--external-bg)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" aria-label="Name" value={m.name} onChange={(e) => renameMember(m.id, e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={() => setEditingMember(null)} aria-label="Done" style={{ width: 30, height: 30, border: 'none', background: 'var(--external)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={trip.meMemberId === m.id} onChange={() => setMe(m.id)} style={{ width: 16, height: 16, accentColor: 'var(--external)' }} />
                  This is me — my share and dues go to my ledger when the trip closes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  <span>Pays together with <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(one wallet, e.g. a couple)</span></span>
                  <select value={partner?.id ?? ''} onChange={(e) => setPaysWith(m.id, e.target.value)} style={{ flex: '0 1 170px', padding: '6px 8px', fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                    <option value="">Nobody — pays alone</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <button onClick={() => removeMember(m.id)} disabled={usedBy(m.id)} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: usedBy(m.id) ? 'not-allowed' : 'pointer', opacity: usedBy(m.id) ? 0.5 : 1, background: 'var(--expense-bg)', color: 'var(--expense)', border: '1px solid var(--expense-border)' }}>
                  <X size={12} /> Remove {m.name}{usedBy(m.id) ? ' (has rows)' : ''}
                </button>
              </div>
            );
          })()}
        </div>

        <Sheet id="trip-sheet" tone="external" columns={columns} rows={rows} onChange={setSheetRows} readOnly={closed}
          makeRow={(list) => newRow(lastPayer(list), trip.startDate)} rowLabel={(r) => r.title}
          footer={<span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span>{validExpenses.length} item{validExpenses.length === 1 ? '' : 's'}{members.length ? ` · ${formatAmount(s.perHead)} per head` : ''}</span>
            <strong style={{ fontSize: 14, color: 'var(--text)' }}>Total {formatAmount(s.total)}</strong>
          </span>} />
        {!closed && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 2px 0', lineHeight: 1.5 }}>Enter moves to the next cell · type a new name to add a person · sums like 120+80 work · paste rows from Excel or Sheets</p>}
      </div>

      {/* ── RIGHT: the settlement, live ── */}
      <div className="trip-settle" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={label}>Total spent</div>
              <div id="trip-total" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(s.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {members.length} people · {formatAmount(s.perHead)} each
                {trip.startDate && <> · {formatDateShort(trip.startDate)}{trip.endDate ? ` – ${formatDateShort(trip.endDate)}` : ''}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => { persist(); onShare(); }} Icon={Share2}>Share</Btn>
              {closed
                ? <Btn onClick={onReopen} Icon={Unlock}>Reopen</Btn>
                : <Btn onClick={() => { persist(); onClose(); }} Icon={Lock} filled disabled={!s.count || members.length < 2}>Close trip</Btn>}
              {onDelete && <Btn onClick={() => setConfirmDelete(true)} Icon={Trash2} danger>Delete</Btn>}
            </div>
          </div>
          {closed && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: 'var(--surface2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={11} /> Closed{trip.closedAt ? ` on ${formatDateShort(trip.closedAt)}` : ''} — reopen to change anything.
            </div>
          )}
        </div>
        {confirmDelete && (
          <ConfirmDeleteModal title={`Delete “${trip.name}”?`} message="All its rows and settlements are removed. Entries already posted to your ledger stay."
            onConfirm={() => { setConfirmDelete(false); onDelete(trip.id); }} onCancel={() => setConfirmDelete(false)} />
        )}

        <div className="card" id="trip-transfers">
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={label}><ArrowRight size={12} /> Who pays whom</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.isSettled ? 'var(--income)' : 'var(--expense)' }}>
              {!s.count ? '' : s.isSettled ? 'All settled ✓' : `${formatAmount(s.outstanding)} to settle`}
            </span>
          </div>
          {!s.count || members.length < 2 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>{members.length < 2 ? 'Add at least two people.' : 'Fill in a row — the plan appears here as you type.'}</div>
          ) : s.transfers.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} style={{ color: 'var(--income)' }} /> Everyone is square.
            </div>
          ) : s.transfers.map((t, i) => {
            const mine = s.meUnit && (t.from === s.meUnit || t.to === s.meUnit);
            return (
              <div key={`${t.from}-${t.to}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderTop: i ? '1px solid var(--border)' : 'none', background: mine ? 'var(--external-bg)' : 'transparent' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)' }}>
                  <strong>{t.fromName}</strong> <span style={{ color: 'var(--text-muted)' }}>pays</span> <strong>{t.toName}</strong>
                  {mine && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--external)', marginLeft: 6 }}>{t.to === s.meUnit ? 'to you' : 'you pay'}</span>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--expense)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(t.amount)}</span>
                {!closed && (
                  <button onClick={() => markPaid(t)} title="Mark as paid" style={{ height: 28, padding: '0 10px', border: 'none', background: 'var(--income)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <Check size={12} /> Paid
                  </button>
                )}
              </div>
            );
          })}
          {(trip.settlements?.length ?? 0) > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 10px' }}>
              <div style={{ ...label, marginBottom: 4 }}>Settled so far · {formatAmount(s.settledTotal)}</div>
              {trip.settlements.map((x) => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                  <CheckCircle2 size={12} style={{ color: 'var(--income)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{unitName[x.fromUnit] ?? '?'} → {unitName[x.toUnit] ?? '?'} · {formatAmount(x.amount)}{x.date ? ` · ${formatDateShort(x.date)}` : ''}</span>
                  {!closed && <button onClick={() => removeSettlement(x.id)} aria-label="Undo" style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {s.count > 0 && (
          <div className="card">
            <div style={{ ...label, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}><Users size={12} /> Paid vs share</div>
            {s.units.map((u, i) => {
              const pos = u.remaining > 0.004, neg = u.remaining < -0.004;
              return (
                <div key={u.id} style={{ padding: '9px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {u.name}{u.id === s.meUnit && <span style={{ fontSize: 10, color: 'var(--external)', marginLeft: 6 }}>you</span>}
                        {u.isGroup && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>one wallet</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>paid {formatAmount(u.paid)} · share {formatAmount(u.share)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--income)' : neg ? 'var(--expense)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {pos ? `gets ${formatAmount(u.remaining)}` : neg ? `owes ${formatAmount(-u.remaining)}` : 'settled'}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ width: `${s.total ? Math.min(100, (u.paid / s.total) * 100) : 0}%`, height: '100%', background: 'var(--external)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, Icon, filled, disabled, danger }) {
  const tone = danger ? 'expense' : 'external';
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: filled ? `var(--${tone})` : `var(--${tone}-bg)`, color: filled ? '#fff' : `var(--${tone})`, border: filled ? 'none' : `1px solid var(--${tone}-border)` }}>
      <Icon size={12} /> {children}
    </button>
  );
}
