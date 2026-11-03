// ─── Trip plan: estimate before you go ──────────────────────────
// A checklist with a cost estimate per line — travel (bike: petrol,
// service; or tickets), food, stay, things to do — ticked off as it's
// booked or bought, and the estimate against what the trip has really cost.
// Your own plan: kept in settings.tripPlans[tripId] (never on a shared trip).
import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Plus, Trash2, Check, Bike, Car, TrainFront, Plane } from 'lucide-react';
import { generateId } from '../../utils/storage';

const PLAN_GROUPS = [
  { key: 'travel', label: 'Travel' },
  { key: 'food',   label: 'Food' },
  { key: 'stay',   label: 'Stay' },
  { key: 'do',     label: 'Things to do' },
  { key: 'other',  label: 'Other' },
];
const MODES = [
  { key: 'bike',   label: 'Bike',   Icon: Bike,       items: ['Petrol', 'Bike service before', 'Tolls & parking'] },
  { key: 'car',    label: 'Car',    Icon: Car,        items: ['Fuel', 'Tolls & parking', 'Car service before'] },
  { key: 'train',  label: 'Train / bus', Icon: TrainFront, items: ['Tickets there', 'Tickets back', 'Local travel'] },
  { key: 'flight', label: 'Flight', Icon: Plane,      items: ['Flights', 'Airport cab', 'Local travel'] },
];
const BASICS = [['food', 'Meals'], ['stay', 'Hotel / stay'], ['do', 'Entry tickets & activities']];
const line = (group, name = '') => ({ id: generateId(), group, name, estimate: '', done: false });
const num = (v) => Number(v) || 0;

export default function TripPlan({ tripId, plan, spent = 0, money, onSave, readOnly = false }) {
  const [items, setItems] = useState(() => plan?.items ?? []);
  const timer = useRef(null);
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);
  // Save a moment after the last change, and when leaving the trip
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); onSave?.(tripId, { items: latest.current.filter((i) => i.name.trim() || num(i.estimate)) }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function change(next) {
    setItems(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; onSave?.(tripId, { items: next.filter((i) => i.name.trim() || num(i.estimate)) }); }, 700);
  }
  const patch = (id, p) => change(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const startWith = (mode) => change([...mode.items.map((n) => line('travel', n)), ...BASICS.map(([g, n]) => line(g, n))]);

  const estimate = items.reduce((s, i) => s + num(i.estimate), 0);
  const doneCount = items.filter((i) => i.done).length;
  const over = estimate > 0 && spent > estimate;

  return (
    <div className="card trip-plan" id="trip-plan">
      <div style={{ ...label, padding: '11px 14px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={12} /> Plan & estimate</span>
        {items.length > 0 && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{doneCount}/{items.length} ready</span>}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Plan the costs before you go. How are you travelling?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {MODES.map((m) => (
              <button key={m.key} id={`trip-plan-${m.key}`} disabled={readOnly} onClick={() => startWith(m)} style={chipBtn}>
                <m.Icon size={13} /> {m.label}
              </button>
            ))}
            <button id="trip-plan-blank" disabled={readOnly} onClick={() => change([line('travel')])} style={chipBtn}><Plus size={13} /> Blank</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <Fig label="Estimated" value={money(estimate)} />
            <Fig label="Spent so far" value={money(spent)} color={over ? 'var(--expense)' : undefined} />
            <Fig label={over ? 'Over plan' : 'Left in plan'} value={money(Math.abs(estimate - spent))} color={over ? 'var(--expense)' : 'var(--income)'} />
          </div>
          {PLAN_GROUPS.map((g) => {
            const rows = items.filter((i) => (i.group ?? 'other') === g.key);
            if (!rows.length) return null;
            const sub = rows.reduce((s, i) => s + num(i.estimate), 0);
            return (
              <div key={g.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px 2px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>{g.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(sub)}</span>
                </div>
                {rows.map((i) => (
                  <div key={i.id} className="trip-plan-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 12px' }}>
                    <button aria-label={i.done ? `${i.name || 'Item'}: ready` : `Mark ${i.name || 'item'} ready`} aria-pressed={i.done} disabled={readOnly} onClick={() => patch(i.id, { done: !i.done })}
                      style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `1.5px solid ${i.done ? 'var(--income)' : 'var(--border)'}`, background: i.done ? 'var(--income)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                      {i.done && <Check size={13} />}
                    </button>
                    <input value={i.name} disabled={readOnly} onChange={(e) => patch(i.id, { name: e.target.value })} placeholder="What" aria-label="What"
                      style={{ ...cell, flex: 1, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--text-muted)' : 'var(--text)' }} />
                    <input value={i.estimate} disabled={readOnly} inputMode="decimal" placeholder="0" aria-label={`Estimate for ${i.name || 'item'}`}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) patch(i.id, { estimate: v }); }}
                      style={{ ...cell, width: 84, textAlign: 'right', fontWeight: 700 }} />
                    {!readOnly && <button aria-label="Remove line" onClick={() => change(items.filter((x) => x.id !== i.id))} style={iconBtn}><Trash2 size={12} /></button>}
                  </div>
                ))}
              </div>
            );
          })}
          {!readOnly && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px 12px' }}>
              {PLAN_GROUPS.map((g) => (
                <button key={g.key} onClick={() => change([...items, line(g.key)])} style={{ ...chipBtn, padding: '5px 10px', fontSize: 11 }}><Plus size={11} /> {g.label}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Fig({ label: l, value, color = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 750, color, marginTop: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

const label = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 };
const chipBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--external-border)', background: 'var(--external-bg)', color: 'var(--external)', borderRadius: 10 };
const cell = { minWidth: 0, padding: '7px 8px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', borderRadius: 8, fontFamily: 'inherit', outline: 'none' };
const iconBtn = { width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
