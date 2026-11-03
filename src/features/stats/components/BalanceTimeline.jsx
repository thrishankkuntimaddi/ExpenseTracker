// ─── Remaining balance timeline ──────────────────────────────────
// The remaining balance — the same "Balance" as Home — day by day: each
// month starts with what came in (and last month's carry-forward, when on)
// and goes down as money goes out, so spent money never looks present.
// A big number (rupees large, paise small), against the same day last
// month, one smooth line you can scrub (the number follows), 1M · 3M · 6M ·
// 1Y · All, and this month's in / out, saved in total and what you owe.
import { useId, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, ReferenceDot } from 'recharts';
import { remainingTimeline, RANGES } from '../../../utils/timeline';
import { formatMoneyCompact } from '../../../utils/money';
import BigAmount from '../../../components/BigAmount';
import { toKey } from '../../../utils/recurring';

// The range you last picked (this device). Opens on 1M — one month — until you pick another.
const RANGE_KEY = 'et_timeline_range_v2';
const fmtDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BalanceTimeline({ transactions = [], incomeWithCarry = [], monthBalance = null, monthIn = 0, monthOut = 0, savedTotal = 0, youOwe = 0, dark = false }) {
  const gid = useId().replace(/:/g, '');
  const [range, setRange] = useState(() => { try { return localStorage.getItem(RANGE_KEY) || '1M'; } catch { return '1M'; } });
  const [hover, setHover] = useState(null);
  const todayKey = toKey(new Date());
  const tl = useMemo(() => remainingTimeline(transactions, incomeWithCarry, { range, todayKey }), [transactions, incomeWithCarry, range, todayKey]);

  const pick = (k) => { setRange(k); setHover(null); try { localStorage.setItem(RANGE_KEY, k); } catch { /* storage unavailable */ } };
  const point = hover != null ? tl.points[hover] : null;
  // Today: the app's own balance (several currencies are valued at today's rates there)
  const today = monthBalance ?? tl.end;   // another month on screen: still today's balance here
  const shown = point ? point.value : today;
  const change = !point && tl.lastMonth != null ? Math.round((today - tl.lastMonth) * 100) / 100 : null;
  const up = (change ?? 0) >= 0;
  // A blue line on the light hero card (lighter blue in the dark theme)
  const line = dark ? '#60A5FA' : '#2563EB';
  const last = tl.points[tl.points.length - 1];

  return (
    <section id="stats-timeline" className="home-hero tl-card tl-hero">
      <div className="tl-head">
        <div style={{ minWidth: 0 }}>
          <div className="tl-title">{point ? `Remaining balance · ${fmtDay(point.key)}` : 'Remaining balance · today'}</div>
          <BigAmount value={shown} />
          {point ? (
            <div className="tl-change" style={{ color: 'var(--hero-muted)' }}><span className="tl-change-sub" style={{ marginLeft: 0 }}>What was left that day, after everything spent so far that month</span></div>
          ) : change != null ? (
            <div className="tl-change" style={{ color: change === 0 ? 'var(--hero-muted)' : up ? 'var(--hero-up)' : 'var(--hero-down)' }}>
              {change !== 0 && (up ? <ArrowUp size={16} strokeWidth={3} /> : <ArrowDown size={16} strokeWidth={3} />)}
              <span>{formatMoneyCompact(Math.abs(change))}</span>
              <span className="tl-change-sub">{change === 0 ? 'same as' : up ? 'more than' : 'less than'} this day last month ({formatMoneyCompact(tl.lastMonth)})</span>
            </div>
          ) : null}
        </div>
      </div>

      {tl.points.length > 1 ? (
        <div className="tl-chart" onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tl.points} margin={{ top: 12, right: 8, bottom: 8, left: 8 }}
              onMouseMove={(s) => { const i = Number(s?.activeTooltipIndex); setHover(Number.isFinite(i) ? i : null); }}>
              <defs>
                <linearGradient id={`tl-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line} stopOpacity={dark ? 0.24 : 0.16} />
                  <stop offset="100%" stopColor={line} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`tls-${gid}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={dark ? '#93C5FD' : '#60A5FA'} />
                  <stop offset="100%" stopColor={line} />
                </linearGradient>
              </defs>
              <XAxis dataKey="key" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip content={() => null} cursor={{ stroke: 'var(--hero-muted)', strokeWidth: 1, strokeDasharray: '3 4' }} />
              <Area type="monotone" dataKey="value" stroke={`url(#tls-${gid})`} strokeWidth={3} className="tl-line" fill={`url(#tl-${gid})`} isAnimationActive={false}
                activeDot={{ r: 6, fill: line, stroke: 'var(--surface)', strokeWidth: 3 }} dot={false} />
              {hover == null && last && <ReferenceDot x={last.key} y={last.value} r={5} fill={line} stroke="var(--surface)" strokeWidth={3} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="tl-chart tl-empty">Your timeline starts with your first entry.</div>
      )}

      <div className="tl-ranges" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.key} id={`tl-range-${r.key}`} role="tab" aria-selected={range === r.key} className={range === r.key ? 'on' : ''} onClick={() => pick(r.key)}>{r.label}</button>
        ))}
      </div>

      <div className="tl-strip">
        <Fig label="In this month" value={monthIn} />
        <Fig label="Out this month" value={monthOut} />
        <span className="tl-divider" aria-hidden />
        <Fig label="Saved in total" value={savedTotal} />
        <Fig label="You owe" value={youOwe} />
      </div>
    </section>
  );
}

function Fig({ label, value, signed = false }) {
  const neg = value < 0;
  return (
    <div className="tl-fig">
      <div className="tl-fig-value" style={signed && neg ? { color: 'var(--hero-down)' } : undefined}>
        {signed && value > 0 ? '+' : ''}{formatMoneyCompact(value)}
      </div>
      <div className="tl-fig-label">{label}</div>
    </div>
  );
}
