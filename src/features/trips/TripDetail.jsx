// ─── TripDetail ───────────────────────────────────────────────────
// One trip: add expenses, see who paid what, the settle-up plan ("Dev pays
// Arjun ₹2,400"), mark transfers as paid, and close.
import { useMemo, useState } from 'react';
import { Plus, Trash2, Check, ArrowRight, Users, Wallet, Share2, Lock, Unlock, Pencil, CheckCircle2 } from 'lucide-react';
import { formatAmount, formatDateShort } from '../../utils/dateHelpers';
import { computeTripSummary } from '../../utils/split';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';
import { fieldStyle } from '../../components/formTokens';

export default function TripDetail({ trip, onChange, onEdit, onShare, onClose, onReopen }) {
  const s = useMemo(() => computeTripSummary(trip), [trip]);
  const closed = trip.status === 'closed';
  const members = trip.members ?? [];

  /* ── add-expense form ── */
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(trip.meMemberId ?? members[0]?.id ?? '');
  const [splitAmong, setSplitAmong] = useState([]);   // [] = everyone
  const [date, setDate] = useState(trip.endDate && trip.endDate < toKey(new Date()) ? trip.endDate : toKey(new Date()));
  const amt = Number(amount);
  const canAdd = !closed && title.trim() && amt > 0 && paidBy;

  function addExpense() {
    if (!canAdd) return;
    const e = { id: generateId(), title: title.trim(), amount: amt, paidBy, splitAmong, date };
    onChange({ ...trip, expenses: [...(trip.expenses ?? []), e] });
    setTitle(''); setAmount(''); setSplitAmong([]);
  }
  function removeExpense(id) { onChange({ ...trip, expenses: trip.expenses.filter((e) => e.id !== id) }); }
  function markPaid(t) {
    onChange({ ...trip, settlements: [...(trip.settlements ?? []), { id: generateId(), fromUnit: t.from, toUnit: t.to, amount: t.amount, date: toKey(new Date()) }] });
  }
  function removeSettlement(id) { onChange({ ...trip, settlements: trip.settlements.filter((x) => x.id !== id) }); }
  const toggleSplit = (id) => setSplitAmong((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Summary strip ── */}
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
            <Btn onClick={onShare} Icon={Share2}>Share</Btn>
            {!closed && <Btn onClick={onEdit} Icon={Pencil}>Edit</Btn>}
            {closed
              ? <Btn onClick={onReopen} Icon={Unlock}>Reopen</Btn>
              : <Btn onClick={onClose} Icon={Lock} filled disabled={!s.count}>Close trip</Btn>}
          </div>
        </div>
        {closed && (
          <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 9, background: 'var(--surface2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={11} /> Closed{trip.closedAt ? ` on ${formatDateShort(trip.closedAt)}` : ''} — reopen to change anything.
          </div>
        )}
      </div>

      {/* ── Settle-up plan ── */}
      <div className="card">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight size={12} /> Who pays whom</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.isSettled ? 'var(--income)' : 'var(--expense)' }}>
            {s.count === 0 ? '—' : s.isSettled ? 'All settled ✓' : `${formatAmount(s.outstanding)} outstanding`}
          </span>
        </div>
        {s.transfers.length === 0 ? (
          <div style={{ padding: '14px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {s.count === 0 ? 'Add expenses below to see the split.' : <><CheckCircle2 size={14} style={{ color: 'var(--income)' }} /> Everyone is square.</>}
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

      {/* ── Per person / wallet ── */}
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
              <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${s.total ? Math.min(100, (u.paid / s.total) * 100) : 0}%`, background: 'var(--external)' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add expense ── */}
      {!closed && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Wallet size={12} /> Add expense</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="What (fuel, hotel, dinner…)" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExpense()} style={fieldStyle} />
            <input type="text" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }} onKeyDown={(e) => e.key === 'Enter' && addExpense()} style={{ ...fieldStyle, fontWeight: 700 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Paid by
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} style={{ ...fieldStyle, marginTop: 4 }}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === trip.meMemberId ? ' (me)' : ''}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fieldStyle, marginTop: 4 }} />
            </label>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5 }}>Split among {splitAmong.length === 0 ? 'everyone' : `${splitAmong.length} of ${members.length}`}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <Chip active={splitAmong.length === 0} onClick={() => setSplitAmong([])}>Everyone</Chip>
            {members.map((m) => <Chip key={m.id} active={splitAmong.includes(m.id)} onClick={() => toggleSplit(m.id)}>{m.name}</Chip>)}
          </div>
          <button onClick={addExpense} disabled={!canAdd} style={{ width: '100%', padding: 11, borderRadius: 11, border: 'none', background: canAdd ? 'var(--external)' : 'var(--surface2)', color: canAdd ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={14} /> Add to trip
          </button>
        </div>
      )}

      {/* ── Expenses list ── */}
      <div className="card">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          <span>Expenses · {s.count}</span><span>{formatAmount(s.total)}</span>
        </div>
        {s.count === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>Nothing yet. Add the first expense above.</div>
        ) : [...trip.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e, i, arr) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                paid by <strong style={{ color: 'var(--text-secondary)' }}>{nameOf(e.paidBy)}</strong>
                {e.splitAmong?.length ? ` · split ${e.splitAmong.length} way${e.splitAmong.length === 1 ? '' : 's'}` : ' · everyone'}
                {e.date ? ` · ${formatDateShort(e.date)}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>{formatAmount(e.amount)}</span>
            {!closed && <button onClick={() => removeExpense(e.id)} aria-label="Remove expense" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={13} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn({ children, onClick, Icon, filled, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: filled ? 'var(--external)' : 'var(--external-bg)', color: filled ? '#fff' : 'var(--external)', border: filled ? 'none' : '1px solid var(--external-border)' }}>
      <Icon size={12} /> {children}
    </button>
  );
}
function Chip({ children, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${active ? 'var(--external)' : 'var(--border)'}`, background: active ? 'var(--external-bg)' : 'transparent', color: active ? 'var(--external)' : 'var(--text-secondary)' }}>
      {children}
    </button>
  );
}
