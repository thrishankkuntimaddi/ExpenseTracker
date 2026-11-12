// ─── Festival & event budgets ────────────────────────────────────
// A limit for a stretch of days — Diwali, a wedding, Sankranti — counting the
// spending in those days except everyday essentials (utils/events.js).
import { useMemo, useState } from 'react';
import { PartyPopper, Plus, Trash2 } from 'lucide-react';
import { eventProgress, presetEvent, EVENT_PRESETS } from '../../utils/events';
import { formatMoneyCompact, currencySymbol } from '../../utils/money';
import { generateId } from '../../utils/storage';
import { toKey, fromKey } from '../../utils/recurring';
import { fieldStyle } from '../../components/formTokens';

import { t as tr } from '../../i18n';
const money = (n) => formatMoneyCompact(n);
const recentCutoff = (k) => { const d = fromKey(k); d.setDate(d.getDate() - 45); return toKey(d); };
const day = (k) => fromKey(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function EventsCard({ transactions, rules, settings, onPatchSettings }) {
  const todayKey = toKey(new Date());
  const events = useMemo(() => settings?.events ?? [], [settings?.events]);
  const [draft, setDraft] = useState(null);
  const rows = useMemo(() => events.map((ev) => ({ ev, p: eventProgress(ev, transactions, rules, todayKey) }))
    .filter(({ p, ev }) => p.state !== 'done' || ev.end >= recentCutoff(todayKey))
    .sort((a, b) => ({ on: 0, upcoming: 1, done: 2 }[a.p.state] - { on: 0, upcoming: 1, done: 2 }[b.p.state]) || a.ev.start.localeCompare(b.ev.start)),
  [events, transactions, rules, todayKey]);
  const save = (list) => onPatchSettings?.({ events: list });
  const ok = draft && draft.name.trim() && draft.start && draft.end && draft.end >= draft.start && Number(draft.limit) > 0;

  return (
    <div className="card" id="budget-events" style={{ padding: '14px 16px' }}>
      {rows.length === 0 && !draft && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
          {tr("A separate limit for a festival or an occasion — gifts, clothes, sweets, travel in those days — so one big week doesn’t blur the month.")}
        </div>
      )}
      {rows.map(({ ev, p }) => {
        const over = p.limit && p.spent > p.limit;
        return (
          <div key={ev.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PartyPopper size={14} style={{ color: 'var(--external)' }} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ev.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {day(ev.start)}{ev.end !== ev.start ? ` – ${day(ev.end)}` : ''} · {p.state === 'upcoming' ? `in ${p.daysToGo} day${p.daysToGo === 1 ? '' : 's'}` : p.state === 'on' ? 'on now' : 'done'}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: over ? 'var(--expense)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {money(p.spent)}<span style={{ fontWeight: 600, color: 'var(--text-muted)' }}> / {money(p.limit)}</span>
              </span>
              <button aria-label={`Remove ${ev.name}`} onClick={() => save(events.filter((x) => x.id !== ev.id))} style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', margin: '7px 0 0 40px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, p.pct)}%`, background: over ? 'var(--expense)' : p.pct >= 85 ? 'var(--lent)' : 'var(--external)' }} />
            </div>
            {p.state !== 'upcoming' && <div style={{ fontSize: 11, color: over ? 'var(--expense)' : 'var(--text-muted)', margin: '4px 0 0 40px' }}>{over ? `${money(p.spent - p.limit)} over` : `${money(p.left)} left`} · {p.items.length} {tr("spend")}{p.items.length === 1 ? '' : 's'}</div>}
          </div>
        );
      })}

      {draft ? (
        <div id="event-form" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <input id="event-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={tr("Diwali, a wedding …")} style={fieldStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            <input aria-label={tr("From")} type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} style={{ ...fieldStyle, minWidth: 0 }} />
            <input aria-label={tr("To")} type="date" value={draft.end} min={draft.start} onChange={(e) => setDraft({ ...draft, end: e.target.value })} style={{ ...fieldStyle, minWidth: 0 }} />
          </div>
          <input id="event-limit" aria-label={tr("Limit")} value={draft.limit} inputMode="decimal" placeholder={`${currencySymbol()} limit for these days`} onChange={(e) => { const t = e.target.value; if (t === '' || /^\d*\.?\d*$/.test(t)) setDraft({ ...draft, limit: t }); }} style={fieldStyle} />
          <div style={{ display: 'flex', gap: 14 }}>
            <button id="event-save" disabled={!ok} onClick={() => { save([...events, { ...draft, name: draft.name.trim(), limit: Number(draft.limit) }]); setDraft(null); }} style={{ ...link, opacity: ok ? 1 : 0.5 }}>{tr("Save")}</button>
            <button onClick={() => setDraft(null)} style={{ ...link, color: 'var(--text-muted)' }}>{tr("Cancel")}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: rows.length ? 10 : 0 }}>
          {EVENT_PRESETS.slice(0, 6).map((p) => (
            <button key={p.name} id={`event-preset-${p.name.split(' ')[0].toLowerCase()}`} onClick={() => setDraft({ ...presetEvent(p, todayKey, generateId()), limit: String(p.limit) })}
              style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>{p.name}</button>
          ))}
          <button id="event-custom" onClick={() => setDraft({ id: generateId(), name: '', start: todayKey, end: todayKey, limit: '' })} style={{ ...link, padding: '5px 4px' }}><Plus size={13} /> {tr("Other")}</button>
        </div>
      )}
    </div>
  );
}

const link = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
