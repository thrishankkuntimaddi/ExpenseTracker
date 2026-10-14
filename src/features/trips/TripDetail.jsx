// ─── TripDetail ───────────────────────────────────────────────────
// One screen, like the paper you'd draw after a trip:
//   left   the sheet — Person | What | Amount. Type a name (it completes
//          from the trip's people; a new name joins the trip), what was
//          paid for, the amount; Enter moves on. Paste rows from Excel.
//   right  the settlement, live — totals, who pays whom (mark paid),
//          paid vs share per wallet (and who owes whom inside a wallet),
//          where the money went, share / invite / close.
//
// Shared trips (several accounts): everyone sees every row; you edit your
// own rows and your wallet partner's; the creator edits anything, closes,
// reopens and manages people. Either side of a payment can mark it paid.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Check, ArrowRight, Users, Share2, Lock, Unlock, CheckCircle2, UserPlus, X, PieChart, BookPlus, Crown } from 'lucide-react';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import Sheet from '../../components/Sheet';
import Avatar from '../../components/Avatar';
import RollingNumber from '../../motion/RollingNumber';
import { flyCoin, burstCoins, pop } from '../../motion/motion';
import { formatAmount, formatDateShort } from '../../utils/dateHelpers';
import { computeTripSummary, unitIdOf } from '../../utils/split';
import { categoryMeta } from '../../utils/categories';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';
import { currencySymbol } from '../../utils/money';

const newRow = (paidBy = '', date) => ({ id: generateId(), title: '', amount: '', paidBy, splitAmong: [], date });
const isValidRow = (r) => r.paidBy && String(r.title ?? '').trim() && Number(r.amount) > 0;
const isBlankRow = (r) => !String(r.title ?? '').trim() && (r.amount === '' || r.amount == null);
const rowKey = (r) => JSON.stringify([String(r.title ?? ''), r.amount === '' || r.amount == null ? null : Number(r.amount), r.paidBy ?? '', r.splitAmong ?? [], r.category ?? null]);
const label = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 };

export default function TripDetail({ trip, ops, onChange, onShare, onInvite, onClose, onReopen, onDelete, onLogMine }) {
  const money = (n) => formatAmount(n, trip?.currency);   // the trip's own currency
  const closed = trip.status === 'closed' || trip.status === 'archived';
  const shared = !!trip.shared;
  const isOwner = !shared || !!trip.isOwner;
  const members = useMemo(() => trip.members ?? [], [trip.members]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMember, setEditingMember] = useState(null);   // member id whose editor is open

  /* ── Who may touch what ── */
  const myId = trip.meMemberId;
  const unitOf = useMemo(() => Object.fromEntries(members.map((m) => [m.id, unitIdOf(m)])), [members]);
  const myUnit = myId ? unitOf[myId] : null;
  const walletIds = useMemo(() => members.filter((m) => myUnit && unitOf[m.id] === myUnit).map((m) => m.id), [members, unitOf, myUnit]);
  const canEditRow = (r) => !closed && (isOwner || walletIds.includes(r.paidBy));
  const canSettle = (fromUnit, toUnit) => !closed && (isOwner || fromUnit === myUnit || toUnit === myUnit);
  // Accounts on a shared trip, by the person they are
  const accountOf = useMemo(() => {
    const out = {};
    Object.entries(trip.uidMember ?? {}).forEach(([uid, mid]) => { out[mid] = { uid, ...(trip.people?.[uid] ?? {}) }; });
    return out;
  }, [trip.uidMember, trip.people]);

  /* ── Rows: local, debounced autosave (one write per pause, not per keystroke) ── */
  const [rows, setRows] = useState(() => trip.expenses ?? []);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const timer = useRef(null);
  const latest = useRef({ trip, rows });
  const membersRef = useRef(members);
  // Rows as last seen from the server: a shared save sends only what changed since
  const baseRef = useRef(new Map((trip.expenses ?? []).map((r) => [r.id, rowKey(r)])));
  useEffect(() => { latest.current = { trip, rows }; }, [trip, rows]);
  // People added from the sheet live here until the saved trip comes back with them
  useEffect(() => { membersRef.current = trip.members ?? []; }, [trip.members]);

  // Adopt rows arriving from the server (another device, a friend) unless we are mid-edit
  const [syncedFrom, setSyncedFrom] = useState(trip.expenses);
  if (trip.expenses !== syncedFrom) {
    setSyncedFrom(trip.expenses);
    if (!dirty && trip.expenses) setRows(trip.expenses);
  }
  useEffect(() => {
    if (!dirtyRef.current && syncedFrom) baseRef.current = new Map(syncedFrom.map((r) => [r.id, rowKey(r)]));
  }, [syncedFrom]);

  const persist = () => {
    clearTimeout(timer.current);
    if (!dirtyRef.current) return;
    const { trip: t, rows: r } = latest.current;
    dirtyRef.current = false; setDirty(false);
    if (ops) {
      // Shared: one document per row — send the rows that changed, delete the ones removed
      const base = baseRef.current;
      const local = new Map(r.map((x) => [x.id, x]));
      const deletes = [...base.keys()].filter((id) => !local.has(id) || isBlankRow(local.get(id)));
      const upserts = r.filter((x) => !isBlankRow(x) && base.get(x.id) !== rowKey(x))
        .map((x) => ({ ...x, paidBy: isOwner || walletIds.includes(x.paidBy) ? x.paidBy : myId, amount: x.amount === '' || x.amount == null ? null : Number(x.amount) }));
      baseRef.current = new Map(r.filter((x) => !isBlankRow(x)).map((x) => [x.id, rowKey(x)]));
      if (upserts.length || deletes.length) ops.saveRows(upserts, deletes);
      return;
    }
    const kept = r.filter((x) => !isBlankRow(x));
    onChange({ ...t, members: membersRef.current, expenses: kept.map((x) => ({ ...x, amount: x.amount === '' ? '' : Number(x.amount) })) });
  };
  const setSheetRows = (next) => {
    setRows(next); latest.current = { ...latest.current, rows: next };
    dirtyRef.current = true; setDirty(true); clearTimeout(timer.current); timer.current = setTimeout(persist, 700);
  };
  useEffect(() => () => { if (dirtyRef.current) persist(); clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── People (the creator manages them) ── */
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
    if (usedBy(id) || accountOf[id]) return;
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
  const memberName = Object.fromEntries(members.map((m) => [m.id, m.name]));
  // E · the moment a trip becomes square: a burst of coins and "All settled ✓" pops
  const settledRef = useRef(null);
  const wasSettled = useRef(s.isSettled || !s.count);
  useEffect(() => {
    const now = s.isSettled && s.count > 0;
    if (now && !wasSettled.current) { burstCoins(settledRef.current); pop(settledRef.current); }
    wasSettled.current = now || !s.count;
  }, [s.isSettled, s.count]);

  function addSettlement(x, e) {
    flyCoin({ from: e?.currentTarget, to: '#trip-total', tone: 'gold' });
    const settlement = { id: generateId(), date: toKey(new Date()), ...x };
    // Who in a wallet actually paid / received — the inside-wallet balance uses it
    if (myId && unitOf[myId] === x.fromUnit && !x.fromMember) settlement.fromMember = myId;
    if (myId && unitOf[myId] === x.toUnit && !x.toMember) settlement.toMember = myId;
    if (ops) ops.addSettlement(settlement);
    else onChange({ ...latest.current.trip, settlements: [...(trip.settlements ?? []), settlement] });
  }
  const markPaid = (t, e) => addSettlement({ fromUnit: t.from, toUnit: t.to, amount: t.amount }, e);
  const markInsidePaid = (u, t, e) => addSettlement({ fromUnit: u.id, toUnit: u.id, fromMember: t.from, toMember: t.to, amount: t.amount }, e);
  const removeSettlement = (id) => (ops ? ops.removeSettlement(id) : onChange({ ...latest.current.trip, settlements: trip.settlements.filter((x) => x.id !== id) }));

  const lastPayer = (list) => {
    const last = list[list.length - 1]?.paidBy;
    if (!isOwner) return walletIds.includes(last) ? last : myId ?? '';
    return last ?? trip.meMemberId ?? members[0]?.id ?? '';
  };
  const allPeople = members.map((m) => ({ value: m.id, label: m.name }));
  const columns = [
    { key: 'paidBy', label: 'Person', type: 'pick', width: 'minmax(96px, 1fr)', placeholder: 'Who paid?', options: allPeople,
      choices: isOwner ? allPeople : allPeople.filter((o) => walletIds.includes(o.value)), onCreate: isOwner ? createMember : undefined },
    { key: 'title', label: 'What', type: 'text', width: 'minmax(110px, 1.6fr)', placeholder: 'Fuel, food, toll…' },
    { key: 'amount', label: `Amount ${currencySymbol(trip.currency)}`, type: 'amount', width: '104px', placeholder: '0' },
  ];

  const editing = isOwner && editingMember && members.find((m) => m.id === editingMember);
  const settlements = trip.settlements ?? [];
  const settlementLabel = (x) => (x.fromUnit === x.toUnit
    ? `${memberName[x.fromMember] ?? '?'} → ${memberName[x.toMember] ?? '?'} (inside wallet)`
    : `${unitName[x.fromUnit] ?? '?'} → ${unitName[x.toUnit] ?? '?'}`);

  return (
    <div className="trip-layout">
      {/* ── LEFT: people + the sheet ── */}
      <div className="trip-entry" style={{ minWidth: 0 }}>
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ ...label, marginBottom: 8, flexWrap: 'wrap' }}>
            <Users size={12} /> People · {members.length}
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
              {isOwner ? (closed ? '' : shared ? '— tap one for “pays together”' : '— tap one for “me” or “pays together”') : '— you can edit your rows and your wallet partner’s'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {members.map((m) => {
              const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
              const on = editingMember === m.id;
              const account = accountOf[m.id];
              const isCreator = account && account.uid === trip.ownerUid;
              return (
                <button key={m.id} type="button" id={`trip-person-${m.id}`} onClick={() => setEditingMember(on ? null : m.id)} className="trip-chip" disabled={closed || !isOwner}
                  style={{ padding: account ? '3px 11px 3px 3px' : '5px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: closed || !isOwner ? 'default' : 'pointer', border: `1.5px solid ${on ? 'var(--external)' : m.id === myId ? 'var(--external-border)' : 'var(--border)'}`, background: on || m.id === myId ? 'var(--external-bg)' : 'var(--surface2)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {account && <Avatar user={{ displayName: account.name || m.name, photoURL: account.photo }} size={20} />}
                  {m.name}
                  {isCreator && <Crown size={11} style={{ color: 'var(--warning, #f59e0b)' }} aria-label="created the trip" />}
                  {m.id === myId && <span style={{ color: 'var(--external)' }}>· you</span>}
                  {partner && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· with {partner.name}</span>}
                  {shared && !account && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· not joined</span>}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{money(paidBy[m.id] ?? 0)}</span>
                </button>
              );
            })}
            {!closed && isOwner && (
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
            const account = accountOf[m.id];
            const locked = usedBy(m.id) || !!account;
            return (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid var(--external-border)', background: 'var(--external-bg)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" aria-label="Name" value={m.name} onChange={(e) => renameMember(m.id, e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={() => setEditingMember(null)} aria-label="Done" style={{ width: 30, height: 30, border: 'none', background: 'var(--external)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></button>
                </div>
                {shared ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {account ? <>Joined with the account <strong>{account.name}</strong> — edits their own rows.</> : <>Not joined yet — send the invite; they pick “{m.name}” when they open it.</>}
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={trip.meMemberId === m.id} onChange={() => setMe(m.id)} style={{ width: 16, height: 16, accentColor: 'var(--external)' }} />
                    This is me — my share and dues go to my ledger when the trip closes
                  </label>
                )}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  <span>Pays together with <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(one wallet — one covers the other)</span></span>
                  <select value={partner?.id ?? ''} onChange={(e) => setPaysWith(m.id, e.target.value)} style={{ flex: '0 1 170px', padding: '6px 8px', fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                    <option value="">Nobody — pays alone</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <button onClick={() => removeMember(m.id)} disabled={locked} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1, background: 'var(--expense-bg)', color: 'var(--expense)', border: '1px solid var(--expense-border)' }}>
                  <X size={12} /> Remove {m.name}{usedBy(m.id) ? ' (has rows)' : account ? ' (has joined)' : ''}
                </button>
              </div>
            );
          })()}
        </div>

        <Sheet id="trip-sheet" tone="external" columns={columns} rows={rows} onChange={setSheetRows} readOnly={closed || (shared && !myId && !isOwner)}
          canEditRow={shared ? canEditRow : undefined}
          makeRow={(list) => newRow(lastPayer(list), trip.startDate)} rowLabel={(r) => r.title}
          footer={<span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span>{validExpenses.length} item{validExpenses.length === 1 ? '' : 's'}{members.length ? ` · ${money(s.perHead)} per head` : ''}</span>
            <strong style={{ fontSize: 14, color: 'var(--text)' }}>Total {money(s.total)}</strong>
          </span>} />
        {!closed && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 2px 0', lineHeight: 1.5 }}>
          {shared && !isOwner
            ? 'Add what you paid for · greyed rows are other people’s — only they (or the trip’s creator) can change them · sums like 120+80 work'
            : 'Enter moves to the next cell · type a new name to add a person · sums like 120+80 work · paste rows from Excel or Sheets'}
        </p>}
      </div>

      {/* ── RIGHT: the settlement, live ── */}
      <div className="trip-settle" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={label}>Total spent</div>
              <div id="trip-total" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                <RollingNumber value={s.total} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {members.length} people · {money(s.perHead)} each
                {trip.startDate && <> · {formatDateShort(trip.startDate)}{trip.endDate ? ` – ${formatDateShort(trip.endDate)}` : ''}</>}
              </div>
              {myId && s.count > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  You paid {money(s.myPaid ?? 0)} · your share {money(s.myShare ?? 0)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => { persist(); onShare(); }} Icon={Share2}>Share</Btn>
              {isOwner && onInvite && <Btn onClick={() => { persist(); onInvite(); }} Icon={UserPlus}>{shared ? 'Invite' : 'Invite friends'}</Btn>}
              {isOwner && (closed
                ? <Btn onClick={onReopen} Icon={Unlock}>Reopen</Btn>
                : <Btn onClick={() => { persist(); onClose(); }} Icon={Lock} filled disabled={!s.count || members.length < 2}>Close trip</Btn>)}
              {!isOwner && closed && onLogMine && myId && <Btn onClick={onLogMine} Icon={BookPlus} filled>Add to my ledger</Btn>}
              {isOwner && onDelete && <Btn onClick={() => setConfirmDelete(true)} Icon={Trash2} danger>Delete</Btn>}
            </div>
          </div>
          {shared && !isOwner && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: 'var(--surface2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Crown size={11} /> Shared by {trip.ownerName || 'the creator'} — they close the trip and can correct any row.
            </div>
          )}
          {closed && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: 'var(--surface2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={11} /> Closed{trip.closedAt ? ` on ${formatDateShort(trip.closedAt)}` : ''} — {isOwner ? 'reopen to change anything.' : 'only its creator can reopen it.'}
            </div>
          )}
        </div>
        {confirmDelete && (
          <ConfirmDeleteModal title={`Delete “${trip.name}”?`} message={shared ? 'It disappears for everyone on it. Entries already posted to ledgers stay.' : 'All its rows and settlements are removed. Entries already posted to your ledger stay.'}
            onConfirm={() => { setConfirmDelete(false); onDelete(trip.id); }} onCancel={() => setConfirmDelete(false)} />
        )}

        <div className="card" id="trip-transfers">
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={label}><ArrowRight size={12} /> Who pays whom</span>
            <span ref={settledRef} className="settle-pop" style={{ fontSize: 11, fontWeight: 700, color: s.isSettled ? 'var(--income)' : 'var(--expense)' }}>
              {!s.count ? '' : s.isSettled ? 'All settled ✓' : `${money(s.outstanding)} to settle`}
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
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--expense)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{money(t.amount)}</span>
                {canSettle(t.from, t.to) && (
                  <button onClick={(e) => markPaid(t, e)} title="Mark as paid — either of you can" style={{ height: 28, padding: '0 10px', border: 'none', background: 'var(--income)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <Check size={12} /> Paid
                  </button>
                )}
              </div>
            );
          })}
          {settlements.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 10px' }}>
              <div style={{ ...label, marginBottom: 4 }}>Settled so far · {money(s.settledTotal)}</div>
              {settlements.map((x) => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                  <CheckCircle2 size={12} style={{ color: 'var(--income)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{settlementLabel(x)} · {money(x.amount)}{x.date ? ` · ${formatDateShort(x.date)}` : ''}</span>
                  {canSettle(x.fromUnit, x.toUnit) && <button onClick={() => removeSettlement(x.id)} aria-label="Undo" title="Undo" style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>}
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>paid {money(u.paid)} · share {money(u.share)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--income)' : neg ? 'var(--expense)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {pos ? `gets ${money(u.remaining)}` : neg ? `owes ${money(-u.remaining)}` : 'settled'}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ width: `${s.total ? Math.min(100, (u.paid / s.total) * 100) : 0}%`, height: '100%', background: 'var(--external)' }} />
                  </div>
                  {u.isGroup && (
                    <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 10, background: 'var(--surface2)', display: 'grid', gap: 5 }}>
                      {u.memberIds.map((mid) => {
                        const r = s.members.find((x) => x.id === mid);
                        return <div key={mid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}><span>{r.name}{mid === u.lead && u.inside?.length ? ' · covers the wallet' : ''}</span><span>paid {money(r.paid)} · share {money(r.share)}</span></div>;
                      })}
                      {u.inside?.length ? u.inside.map((t) => (
                        <div key={`${t.from}-${t.to}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', borderTop: '1px dashed var(--border)', paddingTop: 5 }}>
                          <span style={{ flex: 1, minWidth: 0 }}><strong>{t.fromName}</strong> <span style={{ color: 'var(--text-muted)' }}>owes</span> <strong>{t.toName}</strong></span>
                          <span style={{ fontWeight: 800, color: 'var(--expense)' }}>{money(t.amount)}</span>
                          {canSettle(u.id, u.id) && (
                            <button onClick={(e) => markInsidePaid(u, t, e)} title="Mark as paid back" style={{ height: 24, padding: '0 8px', border: 'none', background: 'var(--income)', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Check size={11} /> Paid
                            </button>
                          )}
                        </div>
                      )) : <div style={{ fontSize: 11, color: 'var(--income)', fontWeight: 600, borderTop: '1px dashed var(--border)', paddingTop: 5 }}>Square between them ✓</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {s.categories.length > 0 && (
          <div className="card" id="trip-report">
            <div style={{ ...label, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}><PieChart size={12} /> Where the money went</div>
            <div style={{ padding: '8px 14px 12px', display: 'grid', gap: 7 }}>
              {s.categories.map((c) => {
                const meta = categoryMeta(c.key);
                return (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)' }}>
                      <span style={{ fontWeight: 600 }}>{meta.label}</span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(c.amount)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {Math.round((c.amount / s.total) * 100)}%</span></span>
                    </div>
                    <div style={{ marginTop: 4, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{ width: `${(c.amount / s.total) * 100}%`, height: '100%', background: meta.light ?? 'var(--external)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
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
