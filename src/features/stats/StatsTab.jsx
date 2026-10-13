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
import { categoryTotals, EMPTY_RULES } from '../../utils/categories';
import { latestReportDay, getReportSettings, windowLabel, reportWindow } from '../../utils/report';
import { toKey, fromKey } from '../../utils/recurring';
import { useStats } from '../../hooks/useStats';
import { useViewMonth, monthName } from '../../app/month';
import CategoryBreakdown from './components/CategoryBreakdown';
import SpendingCalendar from './components/SpendingCalendar';
import ReportCard from './components/ReportCard';
import { PageHeader } from '../../components/Page';

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
  const hasPieData = pieData.length > 0;

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
              <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>{formatAmount(stats.balance)}</p>
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
            <Section title="Spending by category">
              <div style={{ marginTop: 8 }}>
                {catTotals.length > 0
                  ? <CategoryBreakdown totals={catTotals} theme={theme} />
                  : <div className="card" style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No spending in {monthName(month, { month: 'long' })}{hasData ? '' : ' yet'}.</div>}
              </div>
            </Section>

            <Section title="Where the money went">
              {hasPieData ? (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, padding: 14 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={55} dataKey="value" paddingAngle={3}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatAmount(d.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginTop: 8, padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Nothing went out in {monthName(month, { month: 'long' })}.</div>
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

