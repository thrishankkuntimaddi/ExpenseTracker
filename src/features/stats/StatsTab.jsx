// ─── Stats ───────────────────────────────────────────────────────
// The month the app is on (switch it here or in the calendar — every page
// follows): balance and breakdown, the spending calendar, categories, the
// distribution, and the monthly report on the day you choose.
import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, PiggyBank,
  Scale, Flame, CalendarDays,
  ChevronDown, ChevronUp,
  ArrowDownLeft, ArrowUpRight, FileText, ChevronRight,
} from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatAmount } from '../../utils/dateHelpers';
import { categoryTotals, categoryColor, EMPTY_RULES } from '../../utils/categories';
import RollingNumber from '../../motion/RollingNumber';
import { latestReportDay, getReportSettings, windowLabel, reportWindow } from '../../utils/report';
import { toKey, fromKey } from '../../utils/recurring';
import { useStats } from '../../hooks/useStats';
import { useViewMonth, monthName } from '../../app/month';
import SpendingCalendar from './components/SpendingCalendar';
import ReportCard from './components/ReportCard';
import { PageHeader } from '../../components/Page';
import { formatMoneyCompact } from '../../utils/money';

/* ── Custom Tooltip ── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      borderRadius: 10, padding: '8px 12px',
      boxShadow: 'var(--shadow)', fontSize: 12,
    }}>
      {label && <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill || 'var(--expense)', fontWeight: 700, margin: 0 }}>
          {p.name}: {formatAmount(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ── Collapsible Section ── */
function Section({ id, title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} style={{ marginBottom: 16, scrollMarginTop: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '8px 2px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span className="section-label" style={{ margin: 0 }}>{title}</span>
        {open
          ? <ChevronUp   size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        }
      </button>
      {open && children}
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ label, value, color, bg, border, Icon, sub }) {
  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 14, padding: 14,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color,
        }}>
          {label}
        </span>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: color + '22', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{formatAmount(value)}</div>
      {sub && <div style={{ fontSize: 10, color, opacity: 0.7, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── Avg Card ── */
function AvgCard({ label, value, Icon }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12, padding: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Icon size={11} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(value)}</div>
    </div>
  );
}

const rupees = (n) => formatMoneyCompact(n);

export default function StatsTab({ transactions, income, selectedPeriod, theme, settings, recurring, onPatchSettings }) {
  const { month, setMonth, period } = useViewMonth(selectedPeriod);
  const { stats, filtTxns, filtInc, pieData } = useStats(transactions, income, period, theme, settings);
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const catTotals = useMemo(() => categoryTotals(filtTxns, categoryRules), [filtTxns, categoryRules]);

  // A fresh report (published in the last three days) gets a banner at the top
  const todayKey = toKey(new Date());
  const { day } = getReportSettings(settings);
  const latest = latestReportDay(day, todayKey);
  const fresh = (fromKey(todayKey) - fromKey(latest)) / 86400000 <= 3;
  const freshWin = fresh ? reportWindow(latest, income) : null;

  const positive  = stats.balance >= 0;
  const hasData   = filtTxns.length > 0 || filtInc.length > 0;
  // Where the money went: spending split by category (the biggest seven,
  // the rest together), then the other ways money left — savings, lent, gifts…
  const moneyOut = useMemo(() => {
    const shown = catTotals.length > 8 ? 7 : 8;   // never "1 more category" — just show it
    const cats = catTotals.slice(0, shown).map((c) => ({ key: c.key, name: c.label, value: c.amount, count: c.count, color: categoryColor(c.key, theme) }));
    const rest = catTotals.slice(shown);
    if (rest.length) cats.push({ key: 'other-cats', name: `${rest.length} more categories`, value: rest.reduce((t, c) => t + c.amount, 0), color: 'var(--text-muted)' });
    // Money that left but wasn't spending: neutral greys, so it never looks like a category
    const NOT_SPENDING = { Savings: 'var(--savings)', Lent: '#A8A29E', 'Debt Repaid': '#78716C', 'Given (Gift)': 'var(--text-secondary)' };
    const others = pieData.filter((d) => NOT_SPENDING[d.name] && d.value > 0)   // repayments received are money in, not out
      .map((d) => ({ key: d.name, name: d.name === 'Given (Gift)' ? 'Given to people' : d.name, value: d.value, color: NOT_SPENDING[d.name] }));
    return [...cats, ...others].filter((d) => d.value > 0);
  }, [catTotals, pieData, theme]);
  const outTotal = moneyOut.reduce((t, d) => t + d.value, 0);

  return (
    <div className="tab-root stats-page">
      <PageHeader title="Stats" subtitle={`${monthName(month, { month: 'long' })} · calendar, categories, report`} month />

      <div className="tab-body">
        {freshWin && (
          <button id="report-banner" className="card" onClick={() => document.getElementById('stats-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 14, border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={17} style={{ color: 'var(--accent)' }} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>Your monthly report is ready</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{windowLabel(freshWin.start, freshWin.last)} — what went up, down and what you missed</span>
            </span>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}

        <div className="stats-layout">
          {/* ── LEFT: balance, breakdown, calendar ── */}
          <div className="stats-left">
            <div className={`hero-card ${positive ? 'hero-income' : 'hero-expense'}`} style={{
              borderRadius: 16, padding: '20px 22px', marginBottom: 14,
              background: positive ? 'var(--income)' : 'var(--expense)', boxShadow: 'var(--shadow-md)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
                Remaining balance · {monthName(month, { month: 'short', year: 'numeric' })}
              </p>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}><RollingNumber value={stats.balance} /></p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Money in − spent − saved − given − lent</p>
            </div>

            <Section title="Breakdown">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }}>
                <MetricCard label="Income" value={stats.totalIncome} color="var(--income)" bg="var(--income-bg)" border="var(--income-border)" Icon={TrendingUp} sub={`Earned: ${formatAmount(stats.pureIncome)}`} />
                <MetricCard label="Spent" value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown} />
                <MetricCard label="Saved" value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank} />
                <MetricCard label="Wasted" value={stats.totalWaste} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={Flame} sub={`${stats.wastePercent}% of spending`} />
                <MetricCard label="You owe" value={stats.allTimeNetOwed} color="var(--borrowed)" bg="var(--borrowed-bg, var(--expense-bg))" border="var(--borrowed-border, var(--expense-border))" Icon={ArrowDownLeft} sub={stats.allTimeNetOwed > 0 ? 'All months, still open' : 'All clear ✓'} />
                <MetricCard label="Owed to you" value={stats.allTimeNetLent} color="var(--lent)" bg="var(--lent-bg, var(--savings-bg))" border="var(--lent-border, var(--savings-border))" Icon={ArrowUpRight} sub={stats.allTimeNetLent > 0 ? 'All months, still open' : 'All returned ✓'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                <AvgCard label="Per day"   value={stats.avgDay}   Icon={CalendarDays} />
                <AvgCard label="Per week"  value={stats.avgWeek}  Icon={CalendarDays} />
                <AvgCard label="Per month" value={stats.avgMonth} Icon={Scale}        />
              </div>
            </Section>

            <Section id="stats-calendar" title="Spending calendar">
              <div style={{ marginTop: 8 }}>
                <SpendingCalendar transactions={transactions} month={month} onMonthChange={setMonth} rules={categoryRules} theme={theme} />
              </div>
            </Section>
          </div>

          {/* ── RIGHT: categories, distribution, report ── */}
          <div className="stats-right">
            <Section title="Where the money went">
              {moneyOut.length > 0 ? (
                <div className="card money-went" id="money-went" style={{ marginTop: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0, margin: '0 auto' }}>
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={moneyOut} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2} stroke="none">
                          {moneyOut.map((e) => <Cell key={e.key} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Out</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rupees(outTotal)}</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 7 }}>
                    {moneyOut.map((d) => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}{d.count ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {d.count}</span> : null}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rupees(d.value)}</span>
                        <span style={{ width: 36, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.value / outTotal < 0.005 ? '<1' : Math.round((d.value / outTotal) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginTop: 8, padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Nothing went out in {monthName(month, { month: 'long' })}{hasData ? '' : ' yet'}.</div>
              )}
            </Section>

            <Section title="Monthly report">
              <div style={{ marginTop: 8 }}>
                <ReportCard transactions={transactions} income={income} settings={settings} recurringRules={recurring?.rules ?? []} onPatchSettings={onPatchSettings} />
              </div>
            </Section>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .stats-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
        }
        @media (max-width: 1023px) {
          .stats-layout { display: flex; flex-direction: column; gap: 0; }
        }
      `}</style>
    </div>
  );
}

