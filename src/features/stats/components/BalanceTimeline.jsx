// ─── Balance timeline ────────────────────────────────────────────
// The money in your hand over time: a big number (the rupees large, the
// paise small), how it moved over the range, one smooth line you can scrub
// — the number follows your finger — and 1M · 3M · 6M · 1Y · All below.
// Under it, the four figures that matter: this month, this year, in hand,
// saved.
import { useId, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, ReferenceDot } from 'recharts';
import { balanceTimeline, netBetween, RANGES } from '../../../utils/timeline';
import { currencySymbol, formatMoneyCompact } from '../../../utils/money';
import { toKey } from '../../../utils/recurring';

const RANGE_KEY = 'et_timeline_range';
const fmtDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const spanLabel = (r) => ({ '1M': 'Last 30 days', '3M': 'Last 3 months', '6M': 'Last 6 months', '1Y': 'Last 12 months', ALL: 'Since you started' }[r]);

/** ₹5,809.74 → big "5,809" + small ".74" */
function BigMoney({ value }) {
  const neg = value < 0;
  const abs = Math.abs(value);
  const whole = Math.floor(abs).toLocaleString('en-IN');
  const paise = String(Math.round((abs % 1) * 100)).padStart(2, '0');
  return (
    <span className="tl-big" aria-label={`${neg ? 'minus ' : ''}${currencySymbol()}${whole}.${paise}`}>
      {neg && <span className="tl-minus">−</span>}
      <span className="tl-sym">{currencySymbol()}</span>
      <span>{whole}</span>
      <span className="tl-paise">.{paise}</span>
    </span>
  );
}

export default function BalanceTimeline({ transactions = [], income = [], monthBalance = 0, dark = false }) {
  const gid = useId().replace(/:/g, '');
  const [range, setRange] = useState(() => { try { return localStorage.getItem(RANGE_KEY) || '3M'; } catch { return '3M'; } });
  const [withSavings, setWithSavings] = useState(false);
  const [hover, setHover] = useState(null);
  const todayKey = toKey(new Date());
  const tl = useMemo(() => balanceTimeline(transactions, income, { range, withSavings, todayKey }), [transactions, income, range, withSavings, todayKey]);
  const strip = useMemo(() => {
    const inHand = balanceTimeline(transactions, income, { range: '1M', todayKey }).end;
    const withSaved = balanceTimeline(transactions, income, { range: '1M', withSavings: true, todayKey }).end;
    return { inHand, saved: withSaved - inHand, year: netBetween(transactions, income, `${todayKey.slice(0, 4)}-01-01`, todayKey) };
  }, [transactions, income, todayKey]);

  const pick = (k) => { setRange(k); setHover(null); try { localStorage.setItem(RANGE_KEY, k); } catch { /* storage unavailable */ } };
  const point = hover != null ? tl.points[hover] : null;
  const shown = point ? point.value : tl.end;
  const change = point ? Math.round((point.value - tl.start) * 100) / 100 : tl.change;
  const pct = Math.abs(tl.start) >= 1 ? Math.round((change / Math.abs(tl.start)) * 1000) / 10 : null;
  const up = change >= 0;
  const line = dark ? '#A5B4FC' : '#1E2A5A';
  const last = tl.points[tl.points.length - 1];

  return (
    <section id="stats-timeline" className="card tl-card">
      <div className="tl-head">
        <div style={{ minWidth: 0 }}>
          <div className="tl-label">
            <button type="button" className={!withSavings ? 'on' : ''} onClick={() => setWithSavings(false)} aria-pressed={!withSavings}>In hand</button>
            <button type="button" className={withSavings ? 'on' : ''} onClick={() => setWithSavings(true)} aria-pressed={withSavings}>With savings</button>
          </div>
          <BigMoney value={shown} />
          <div className="tl-change" style={{ color: change === 0 ? 'var(--text-muted)' : up ? 'var(--income)' : 'var(--expense)' }}>
            {change !== 0 && (up ? <ArrowUp size={16} strokeWidth={3} /> : <ArrowDown size={16} strokeWidth={3} />)}
            <span>{pct != null ? `${Math.abs(pct)}%` : formatMoneyCompact(Math.abs(change))}</span>
            <span className="tl-change-sub">{pct != null && `${up ? '+' : '−'}${formatMoneyCompact(Math.abs(change))} · `}{point ? fmtDay(point.key) : spanLabel(range)}</span>
          </div>
        </div>
      </div>

      {tl.points.length > 1 ? (
        <div className="tl-chart" onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tl.points} margin={{ top: 12, right: 8, bottom: 8, left: 8 }}
              onMouseMove={(s) => { const i = Number(s?.activeTooltipIndex); setHover(Number.isFinite(i) ? i : null); }}>
              <defs>
                <linearGradient id={`tl-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line} stopOpacity={dark ? 0.32 : 0.16} />
                  <stop offset="100%" stopColor={line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="key" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip content={() => null} cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 4' }} />
              <Area type="monotone" dataKey="value" stroke={line} strokeWidth={2.75} fill={`url(#tl-${gid})`} isAnimationActive={false}
                activeDot={{ r: 5, fill: line, stroke: 'var(--surface)', strokeWidth: 2 }} dot={false} />
              {hover == null && last && <ReferenceDot x={last.key} y={last.value} r={5} fill={line} stroke="var(--surface)" strokeWidth={2} />}
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
        <Fig label="Left this month" value={monthBalance} signed />
        <Fig label="This year" value={strip.year} signed />
        <span className="tl-divider" aria-hidden />
        <Fig label="In hand" value={strip.inHand} />
        <Fig label="Saved" value={strip.saved} />
      </div>
    </section>
  );
}

function Fig({ label, value, signed = false }) {
  const neg = value < 0;
  return (
    <div className="tl-fig">
      <div className="tl-fig-value" style={{ color: signed && neg ? 'var(--expense)' : 'var(--text)' }}>
        {signed && value > 0 ? '+' : ''}{formatMoneyCompact(value)}
      </div>
      <div className="tl-fig-label">{label}</div>
    </div>
  );
}
