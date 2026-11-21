// ─── Where the money sits, over time ─────────────────────────────
// One line per kind — Banks · Cash · Cards — or per account (SBI, HDFC,
// Cash …), each in its account colour, against the same 1M · 3M · 6M · 1Y ·
// All ranges as the balance timeline. Scrub to read every line on that day.
// A legend is always there (and doubles as the values while scrubbing), so
// colour never carries identity alone. Data: utils/accounts.accountTimeline.
import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { accountTimeline, colorOf, accountLabel, ACCOUNT_COLORS } from '../../../utils/accounts';
import { RANGES } from '../../../utils/timeline';
import { formatMoneyCompact } from '../../../utils/money';
import { toKey } from '../../../utils/recurring';
import { t as tr } from '../../../i18n';

const RANGE_KEY = 'et_acct_range';
const VIEW_KEY = 'et_acct_view';
const fmtDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

export default function AccountsTimeline({ transactions = [], income = [], settings, dark = false, onOpen }) {
  const [range, setRange] = useState(() => read(RANGE_KEY, '3M'));
  const [view, setView] = useState(() => read(VIEW_KEY, 'kind'));   // 'kind' | 'account'
  const [hover, setHover] = useState(null);
  const todayKey = toKey(new Date());
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const tl = useMemo(() => accountTimeline(transactions, income, settings, { days, todayKey }), [transactions, income, settings, days, todayKey]);

  const palette = ACCOUNT_COLORS[dark ? 'dark' : 'light'];
  const series = view === 'account'
    ? tl.accounts.map((a) => ({ key: a.id, label: accountLabel(a), color: colorOf(a, dark), card: a.kind === 'card' }))
    : tl.groups.map((g) => ({ key: `g_${g.key}`, label: tr(g.label), color: palette[g.color - 1], card: g.key === 'card' }));
  const ink = dark ? '#E5E5EA' : '#3A3A3C';
  const point = hover != null ? tl.points[hover] : tl.points[tl.points.length - 1];
  const persist = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

  if (tl.points.length < 2) return null;

  return (
    <section id="stats-accounts" className="card tl-card">
      <div className="tl-head">
        <div style={{ minWidth: 0 }}>
          <div className="tl-title">{hover != null ? `${tr('Accounts')} · ${fmtDay(point.key)}` : tr('Accounts · where your money sits')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatMoneyCompact(point?.total ?? 0)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tr('Total across every account (cards count as what you owe)')}</div>
          <div className="tl-ranges acct-view" role="tablist" aria-label={tr('Show lines for')}>
            {[['kind', 'By type'], ['account', 'Each']].map(([k, l]) => (
              <button key={k} id={`acct-view-${k}`} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => { setView(k); persist(VIEW_KEY, k); }}>{tr(l)}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="tl-chart" onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)} style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tl.points} margin={{ top: 10, right: 10, bottom: 6, left: 10 }}
            onMouseMove={(s) => { const i = Number(s?.activeTooltipIndex); setHover(Number.isFinite(i) ? i : null); }}>
            <XAxis dataKey="key" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="2 4" />
            <Tooltip content={() => null} cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 4' }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false}
                strokeDasharray={s.card ? '5 4' : undefined}
                activeDot={{ r: 5, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }} />
            ))}
            <Line type="monotone" dataKey="total" stroke={ink} strokeWidth={2} strokeOpacity={0.35} dot={false} isAnimationActive={false} activeDot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="tl-ranges" role="tablist" aria-label={tr('Time range')}>
        {RANGES.map((r) => (
          <button key={r.key} id={`acct-range-${r.key}`} role="tab" aria-selected={range === r.key} className={range === r.key ? 'on' : ''} onClick={() => { setRange(r.key); setHover(null); persist(RANGE_KEY, r.key); }}>{r.label}</button>
        ))}
      </div>

      {/* Legend = the values on the day you're on */}
      <div className="acct-legend" role="list">
        {series.map((s) => (
          <button key={s.key} type="button" role="listitem" className="acct-legend-item" onClick={onOpen}>
            <span aria-hidden className="acct-legend-swatch" style={{ background: s.card ? `repeating-linear-gradient(90deg, ${s.color} 0 5px, transparent 5px 8px)` : s.color }} />
            <span className="acct-legend-label">{s.label}</span>
            <span className="acct-legend-value">{s.card ? `${formatMoneyCompact(Math.max(0, -(point?.[s.key] ?? 0)))} ${tr('due')}` : formatMoneyCompact(point?.[s.key] ?? 0)}</span>
          </button>
        ))}
        <span className="acct-legend-item" role="listitem" style={{ cursor: 'default' }}>
          <span aria-hidden className="acct-legend-swatch" style={{ background: ink, opacity: 0.35 }} />
          <span className="acct-legend-label">{tr('Total')}</span>
          <span className="acct-legend-value">{formatMoneyCompact(point?.total ?? 0)}</span>
        </span>
      </div>
    </section>
  );
}
