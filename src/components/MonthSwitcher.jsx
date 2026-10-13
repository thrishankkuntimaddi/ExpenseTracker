// ─── MonthSwitcher ───────────────────────────────────────────────
// The one month the whole app is looking at. Changing it here (or in the
// Stats calendar) moves Home, History, Income, Stats, Bills, Budget and
// Savings together; "Now" jumps back to the current month.
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useShell } from '../app/shellContext';
import { getCurrentMonthValue } from '../utils/periodHelpers';
import { shiftMonth } from '../utils/carryForward';
import { monthName } from '../app/month';

export default function MonthSwitcher({ month: monthProp, onChange: onChangeProp, compact = false, tone = 'default' }) {
  const shell = useShell();
  const month = monthProp ?? shell?.month ?? getCurrentMonthValue();
  const onChange = onChangeProp ?? shell?.setMonth;
  if (!onChange) return null;
  const now = getCurrentMonthValue();
  const isNow = month === now;
  const onHero = tone === 'hero';
  const btn = {
    width: compact ? 28 : 32, height: compact ? 28 : 32, border: 'none', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    background: onHero ? 'rgba(255,255,255,0.16)' : 'var(--surface2)', color: onHero ? '#fff' : 'var(--text-secondary)',
  };
  return (
    <div className="month-switcher" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <button type="button" aria-label="Previous month" id="month-prev" onClick={() => onChange(shiftMonth(month, -1))} style={btn}><ChevronLeft size={15} /></button>
      <span id="month-label" style={{ fontSize: compact ? 12 : 13, fontWeight: 750, color: onHero ? '#fff' : 'var(--text)', minWidth: compact ? 70 : 96, textAlign: 'center', whiteSpace: 'nowrap' }}>
        {monthName(month, compact ? { month: 'short', year: 'numeric' } : { month: 'long', year: 'numeric' })}
      </span>
      <button type="button" aria-label="Next month" id="month-next" onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= now}
        style={{ ...btn, opacity: month >= now ? 0.35 : 1, cursor: month >= now ? 'default' : 'pointer' }}><ChevronRight size={15} /></button>
      {!isNow && (
        <button type="button" id="month-now" onClick={() => onChange(now)} aria-label="Back to this month"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'inherit', background: onHero ? '#fff' : 'var(--accent)', color: onHero ? 'var(--accent)' : '#fff', flexShrink: 0 }}>
          <RotateCcw size={11} /> Now
        </button>
      )}
    </div>
  );
}
