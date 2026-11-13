// ─── TripPool: money collected up front ───────────────────────────
// "Shiva takes ₹1,000 from each of us and pays for the food." One person
// holds the kitty; the others hand money over before it is spent, and again
// when it runs out. Each handover is a settlement with kind: 'advance', so
// the who-pays-whom plan already counts it — this card records them in one
// go and shows how much of the collected money is left.
//
// Who may record what follows the settlement rules: the trip's creator
// anything; anyone else what their own wallet gave or received.
import { useState } from 'react';
import { HandCoins, Plus, Trash2, X } from 'lucide-react';
import { formatDateShort } from '../../utils/dateHelpers';
import { currencySymbol } from '../../utils/money';
import { t as tr } from '../../i18n';

const label = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 };
const field = { padding: '7px 9px', fontSize: 12.5, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', minWidth: 0 };

export default function TripPool({ summary: s, trip, members, unitOf, myId, myUnit, isOwner, closed, money, advances, onCollect, onUndo }) {
  const canRecord = !closed && (isOwner || !!myUnit) && s.units.length > 1;
  const [form, setForm] = useState(null);   // { holder, amount, note, off: Set<unitId> } while collecting
  const unitName = Object.fromEntries(s.units.map((u) => [u.id, u.name]));
  const memberName = Object.fromEntries(members.map((m) => [m.id, m.name]));

  const start = (pool) => setForm({
    holder: pool?.holderId ?? s.pools[0]?.holderId ?? myId ?? members[0]?.id ?? '',
    amount: pool?.lastAmount ? String(pool.lastAmount) : '',
    note: pool?.purpose?.split(', ')[0] ?? '',
    off: new Set(),
  });

  const holderUnit = form ? unitOf[form.holder] : null;
  // Wallets this account may record a handover for (the holder's own wallet never pays in)
  const fromUnits = form ? s.units.filter((u) => u.id !== holderUnit && (isOwner || holderUnit === myUnit || u.id === myUnit)) : [];
  const chosen = fromUnits.filter((u) => !form.off.has(u.id));
  const each = form ? Math.round((Number(form.amount) || 0) * 100) / 100 : 0;
  const ready = !!holderUnit && each > 0 && chosen.length > 0;

  function submit(e) {
    e.preventDefault();
    if (!ready) return;
    onCollect(chosen.map((u) => ({
      kind: 'advance', fromUnit: u.id, toUnit: holderUnit, toMember: form.holder,
      fromMember: u.memberIds.length === 1 ? u.memberIds[0] : u.id === myUnit ? myId : undefined,
      amount: each, note: form.note.trim().slice(0, 60) || undefined,
    })), e);
    setForm(null);
  }
  const toggle = (id) => setForm((f) => { const off = new Set(f.off); if (off.has(id)) off.delete(id); else off.add(id); return { ...f, off }; });
  const mayUndo = (a) => !closed && (isOwner || a.fromUnit === myUnit || a.toUnit === myUnit);

  if (!s.pools.length && !canRecord) return null;

  return (
    <div className="card" id="trip-pool">
      <div style={{ padding: '11px 14px', borderBottom: s.pools.length || form ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={label}><HandCoins size={12} /> {tr("Collected up front")}{s.collectedTotal > 0 && <> · {money(s.collectedTotal)}</>}</span>
        {canRecord && !form && (
          <button id="trip-pool-collect" type="button" onClick={() => start()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)' }}>
            <Plus size={12} /> {tr("Collect money")}
          </button>
        )}
      </div>

      {!s.pools.length && !form && (
        <div style={{ padding: '10px 14px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {tr("One person collects from everyone first — for food, fuel, rooms — and pays from that. Record it here; whatever is left is counted when you settle.")}
        </div>
      )}

      {s.pools.map((p, i) => {
        const over = p.left < -0.004;
        const pct = p.collected > 0 ? Math.min(100, Math.max(0, (p.spent / p.collected) * 100)) : 0;
        return (
          <div key={p.unitId} id={`trip-pool-${i}`} style={{ padding: '10px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {p.holderName} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{tr("holds the money")}</span>
                  {p.purpose && <span style={{ fontWeight: 600, color: 'var(--external)' }}> · {p.purpose}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {tr("collected")} {money(p.collected)} · {tr("spent on the others")} {money(p.spent)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: over ? 'var(--expense)' : 'var(--income)', flexShrink: 0, textAlign: 'right' }}>
                {over ? `${money(-p.left)} ${tr("over")}` : `${money(p.left)} ${tr("left")}`}
              </div>
            </div>
            <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--expense)' : 'var(--external)' }} />
            </div>
            <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {p.givers.map((g) => (
                <span key={g.unitId} style={{ padding: '3px 8px', fontSize: 11, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--text)' }}>{g.name}</strong> {money(g.given)}
                  <span style={{ color: g.left < -0.004 ? 'var(--expense)' : 'var(--text-muted)' }}> · {g.left < -0.004 ? `${money(-g.left)} ${tr("short")}` : `${money(g.left)} ${tr("left")}`}</span>
                </span>
              ))}
            </div>
            {over && (
              <div style={{ marginTop: 7, fontSize: 11, color: 'var(--expense)', fontWeight: 600 }}>
                {tr("The collected money is used up —")} {p.holderName} {tr("is paying from their own pocket.")}
              </div>
            )}
            {canRecord && !form && (
              <button type="button" onClick={() => start(p)} style={{ marginTop: 8, padding: '5px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: over ? 'var(--external)' : 'transparent', color: over ? '#fff' : 'var(--external)', border: over ? 'none' : '1px solid var(--external-border)' }}>
                {tr("Collect again")}
              </button>
            )}
          </div>
        );
      })}

      {form && (
        <form onSubmit={submit} id="trip-pool-form" style={{ padding: '12px 14px', borderTop: s.pools.length ? '1px solid var(--border)' : 'none', background: 'var(--external-bg)', display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: '1 1 120px' }}>
              {tr("Who holds the money")}
              <select id="trip-pool-holder" value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value, off: new Set() })} style={field}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: '0 1 110px' }}>
              {tr("From each")} ({currencySymbol(trip.currency)})
              <input id="trip-pool-amount" type="number" inputMode="decimal" min="0" step="any" autoFocus value={form.amount} placeholder="1000" onChange={(e) => setForm({ ...form, amount: e.target.value })} style={field} />
            </label>
            <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: '1 1 110px' }}>
              {tr("For (optional)")}
              <input id="trip-pool-note" type="text" maxLength={60} value={form.note} placeholder={tr("Food, rooms…")} onChange={(e) => setForm({ ...form, note: e.target.value })} style={field} />
            </label>
            <button type="button" onClick={() => setForm(null)} aria-label={tr("Cancel")} style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{tr("Who gave it — untick anyone who hasn’t yet")}</div>
            {fromUnits.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tr("Pick someone else as the holder — your own wallet can’t pay into itself.")}</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fromUnits.map((u) => {
                  const on = !form.off.has(u.id);
                  return (
                    <label key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', fontSize: 12, fontWeight: 650, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--external)' : 'var(--border)'}`, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(u.id)} style={{ width: 14, height: 14, accentColor: 'var(--external)' }} />
                      {u.name}
                    </label>
                  );
                })}
              </div>
            )}
            {!isOwner && holderUnit && holderUnit !== myUnit && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{tr("You can record what you gave; the holder or the trip’s creator records the rest.")}</div>
            )}
          </div>
          <button id="trip-pool-save" type="submit" disabled={!ready} style={{ justifySelf: 'start', padding: '8px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', border: 'none', cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, background: 'var(--external)', color: '#fff' }}>
            {ready ? `${tr("Record")} ${money(each * chosen.length)} ${tr("collected")}` : tr("Record")}
          </button>
        </form>
      )}

      {advances.length > 0 && (
        <details style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 10px' }}>
          <summary style={{ ...label, cursor: 'pointer' }}>{tr("Every handover ·")} {advances.length}</summary>
          <div style={{ marginTop: 4 }}>
            {advances.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {unitName[a.fromUnit] ?? '?'} → {memberName[a.toMember] ?? unitName[a.toUnit] ?? '?'} · {money(a.amount)}{a.note ? ` · ${a.note}` : ''}{a.date ? ` · ${formatDateShort(a.date)}` : ''}
                </span>
                {mayUndo(a) && <button type="button" onClick={() => onUndo(a.id)} aria-label={tr("Undo")} title={tr("Undo")} style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
