// ─── Trip insights: budget, the trip's story, settle-up nudge ────
//   Budget   — set once (creator); a bar that fills as you spend, what's left
//              per day for the days to go, and a heads-up when the pace runs
//              over. Shared trips share the budget.
//   Story    — spend per day as small bars, the biggest moment, the priciest
//              day, who paid most, per person per day.
//   Nudge    — one tap sends "who pays whom" to the group chat.
import { useState } from 'react';
import { Target, Pencil, Check, Sparkles, Send, Copy, CalendarClock } from 'lucide-react';
import { budgetPace, tripStory, tripTiming, settleUpMessage } from '../../utils/tripInsights';
import { formatDateShort } from '../../utils/dateHelpers';
import { t as tr } from '../../i18n';

const label = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 };
const TONE = { ok: 'income', tight: 'lent', over: 'expense' };

export default function TripInsights({ trip, summary, money, canEdit, onSetBudget }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(trip.budget ? String(trip.budget) : '');
  const [sent, setSent] = useState('');
  const pace = budgetPace(trip, summary.total);
  const story = tripStory(trip, summary);
  const timing = tripTiming(trip);
  const closed = trip.status === 'closed' || trip.status === 'archived';

  const save = () => { const n = Number(value); onSetBudget(n > 0 ? Math.round(n) : undefined); setEditing(false); };
  const nudge = async () => {
    const text = settleUpMessage(trip, summary, money);
    if (navigator.share) { try { await navigator.share({ title: trip.name, text }); setSent('shared'); return; } catch { /* cancelled */ return; } }
    try { await navigator.clipboard.writeText(text); setSent('copied'); setTimeout(() => setSent(''), 1800); } catch { /* blocked */ }
  };
  const maxDay = Math.max(1, ...(story?.days ?? []).map((d) => d.amount));

  return (
    <div className="card" id="trip-insights" style={{ padding: 14, display: 'grid', gap: 14 }}>
      {/* When */}
      {timing.phase === 'upcoming' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--external)' }}>
          <CalendarClock size={14} /> {timing.inDays === 1 ? tr('Starts tomorrow') : `${tr('Starts in')} ${timing.inDays} ${tr('days')}`} · {timing.length} {timing.length === 1 ? tr('day') : tr('days')}
        </div>
      )}
      {timing.phase === 'on' && !closed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--external)' }}>
          <CalendarClock size={14} /> {tr('Day')} {timing.day} {tr('of')} {timing.length}{timing.daysLeft ? ` · ${timing.daysLeft} ${tr('to go')}` : ` · ${tr('last day')}`}
        </div>
      )}

      {/* Budget */}
      <div>
        <div style={{ ...label, justifyContent: 'space-between' }}>
          <span style={label}><Target size={12} /> {tr('Budget')}</span>
          {canEdit && !closed && !editing && (
            <button type="button" id="trip-budget-edit" onClick={() => setEditing(true)} style={{ border: 'none', background: 'transparent', color: 'var(--external)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0 }}>
              <Pencil size={11} /> {pace ? tr('Change') : tr('Set a budget')}
            </button>
          )}
        </div>
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input id="trip-budget-input" autoFocus inputMode="decimal" value={value} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setValue(v); }} placeholder={tr('For the whole trip')}
              style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <button type="submit" aria-label={tr('Save')} style={{ width: 38, borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={15} /></button>
          </form>
        )}
        {!editing && !pace && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{canEdit && !closed ? tr('Set one and see what’s left per day as you go.') : tr('No budget for this trip.')}</div>}
        {!editing && pace && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: `var(--${TONE[pace.tone]})`, fontVariantNumeric: 'tabular-nums' }}>
                {pace.left >= 0 ? `${money(pace.left)} ${tr('left')}` : `${money(-pace.left)} ${tr('over')}`}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{money(pace.spent)} {tr('of')} {money(pace.budget)}</span>
            </div>
            <div style={{ marginTop: 6, height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, pace.used * 100)}%`, height: '100%', borderRadius: 99, background: `var(--${TONE[pace.tone]})`, transition: 'width .5s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            {pace.perDayLeft != null && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                {money(pace.perDayLeft)}{tr('/day for the rest of the trip')} · {tr('so far')} {money(pace.perDaySoFar)}{tr('/day')}
                {pace.projected > pace.budget && <span style={{ color: 'var(--lent)', fontWeight: 700 }}> · {tr('at this pace')} {money(pace.projected)}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Story */}
      {story && (
        <div>
          <div style={label}><Sparkles size={12} /> {tr('The trip so far')}</div>
          {story.days.length > 1 && (
            <div aria-label={tr('Spend per day')} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 54, marginTop: 10 }}>
              {story.days.map((d) => (
                <div key={d.date} title={`${formatDateShort(d.date)} · ${money(d.amount)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                  <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(6, (d.amount / maxDay) * 40)}px`, borderRadius: 6, background: d.date === story.priciestDay?.date ? 'var(--external)' : 'var(--external-border)' }} />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(`${d.date}T00:00:00`).getDate()}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <Fact k={tr('Biggest')} v={money(story.biggest.amount)} s={`${story.biggest.title}${story.biggest.by ? ` · ${story.biggest.by}` : ''}`} />
            {story.topPayer && <Fact k={tr('Paid most')} v={story.topPayer.name} s={`${money(story.topPayer.paid)} · ${Math.round(story.topPayer.share * 100)}%`} />}
            {story.priciestDay && story.days.length > 1 && <Fact k={tr('Priciest day')} v={formatDateShort(story.priciestDay.date)} s={money(story.priciestDay.amount)} />}
            <Fact k={tr('Per person per day')} v={money(story.perPersonPerDay)} s={`${story.count} ${story.count === 1 ? tr('expense') : tr('expenses')}`} />
          </div>
        </div>
      )}

      {/* Settle-up nudge */}
      {summary.count > 0 && (trip.members ?? []).length > 1 && (
        <button type="button" id="trip-nudge" onClick={nudge}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--external-border)', background: 'var(--external-bg)', color: 'var(--external)', fontSize: 12.5, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer' }}>
          {sent === 'copied' ? <Copy size={14} /> : <Send size={14} />}
          {sent === 'copied' ? tr('Copied — paste it in your group chat') : summary.isSettled ? tr('Tell the group it’s all settled') : tr('Send “who pays whom” to the group')}
        </button>
      )}
    </div>
  );
}

function Fact({ k, v, s }) {
  return (
    <div style={{ padding: '9px 10px', borderRadius: 12, background: 'var(--surface2)', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
    </div>
  );
}
