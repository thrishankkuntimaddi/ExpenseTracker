import { useState } from 'react';
import {
  TrendingUp, TrendingDown, PiggyBank, Users,
  Scale, Flame, CalendarDays, ArrowDownToLine,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts';
import { formatAmount } from '../../utils/dateHelpers';
import PeriodSelector from '../../components/PeriodSelector';
import { useStats } from '../../hooks/useStats';



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
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
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

export default function StatsTab({ transactions, income, selectedPeriod, onPeriodChange, theme }) {
  const { stats, filtTxns, filtInc, pieData, barData, areaData, C } = useStats(transactions, income, selectedPeriod, theme);

  const positive  = stats.balance >= 0;
  const hasData   = filtTxns.length > 0 || filtInc.length > 0;
  const hasPieData = pieData.length > 0;

  return (
    <div className="tab-root">

      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              Stats
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Financial overview
            </p>
          </div>
        </div>
        <PeriodSelector
          period={selectedPeriod}
          onChange={onPeriodChange}
          transactions={transactions}
          income={income}
        />
      </div>

      {/* Content */}
      <div className="tab-body">

        {!hasData ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '60%', gap: 12,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>No data for this period</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add transactions to see stats</p>
          </div>
        ) : (
          <div className="stats-layout">

            {/* ── LEFT COLUMN ── */}
            <div className="stats-left">

              {/* Opening balance carry-forward */}
              {stats.openingBalance !== 0 && (
                <div style={{
                  borderRadius: 12, padding: '12px 16px', marginBottom: 14,
                  background: stats.openingBalance >= 0 ? 'var(--income-bg)' : 'var(--expense-bg)',
                  border: `1.5px solid ${stats.openingBalance >= 0 ? 'var(--income-border)' : 'var(--expense-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ArrowDownToLine size={14} style={{ color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)' }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Opening Balance
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        Carried forward from previous period
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                    {formatAmount(stats.openingBalance)}
                  </div>
                </div>
              )}

              {/* Balance Hero */}
              <div style={{
                borderRadius: 16, padding: '20px 22px', marginBottom: 14,
                background: positive ? 'var(--income)' : 'var(--expense)',
                boxShadow: 'var(--shadow-md)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  Remaining Balance
                </p>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>
                  {formatAmount(stats.balance)}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  {stats.openingBalance !== 0 ? 'Opening + Income − Expense − Savings − Given' : 'Income − Expense − Savings − Given'}
                </p>
              </div>

              {/* Waste block */}
              <div style={{
                borderRadius: 14, padding: 14,
                background: 'var(--expense-bg)',
                border: '1.5px solid var(--expense-border)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <Flame size={13} style={{ color: 'var(--expense)' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--expense)' }}>
                        Total Wastage
                      </span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--expense)' }}>
                      {formatAmount(stats.totalWaste)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--expense)' }}>
                      {stats.wastePercent}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>of expenses</div>
                  </div>
                </div>
                {/* Waste progress bar */}
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, parseFloat(stats.wastePercent))}%`,
                    background: 'linear-gradient(90deg, #F59E0B, var(--expense))',
                    borderRadius: 99,
                    transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              </div>

              {/* Spending Averages */}
              <Section title="Spending Averages">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                  <AvgCard label="Per Day"   value={stats.avgDay}   Icon={CalendarDays} />
                  <AvgCard label="Per Week"  value={stats.avgWeek}  Icon={CalendarDays} />
                  <AvgCard label="Per Month" value={stats.avgMonth} Icon={Scale}        />
                </div>
              </Section>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="stats-right">

              {/* Breakdown Metric Cards */}
              <Section title="Breakdown">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }}>
                  <MetricCard label="Total Income"   value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}   />
                  <MetricCard label="Total Expense"  value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown}  />
                  <MetricCard label="Savings"        value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />
                  <MetricCard label="Given to People" value={stats.totalPerson} color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}        />
                </div>
              </Section>

              {/* Donut Chart */}
              <Section title="Distribution (Donut)">
                {hasPieData ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginTop: 8,
                    background: 'var(--surface)', borderRadius: 14,
                    border: '1px solid var(--border)', padding: 14,
                  }}>
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={34} outerRadius={55}
                          dataKey="value" paddingAngle={3}
                        >
                          {pieData.map((e, i) => (
                            <Cell key={i} fill={
                              e.name === 'Expense' ? C.expense :
                              e.name === 'Savings' ? C.savings : C.person
                            } />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {pieData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: 3,
                            background: d.name === 'Expense' ? C.expense : d.name === 'Savings' ? C.savings : C.person,
                            flexShrink: 0,
                          }} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatAmount(d.value)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    No breakdown data
                  </div>
                )}
              </Section>

              {/* Daily Bar Chart */}
              <Section title="Last 14 Days — Daily Spending">
                <div style={{
                  background: 'var(--surface)', borderRadius: 14,
                  border: '1px solid var(--border)', padding: 14, marginTop: 8,
                }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface2)' }} />
                      <Bar dataKey="Expense" fill={C.expense} radius={[4, 4, 0, 0]} maxBarSize={20} />
                      <Bar dataKey="Savings" fill={C.savings} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              {/* Area Chart: Income vs Expense last 6 months */}
              <Section title="6-Month Trend — Income vs Expense">
                <div style={{
                  background: 'var(--surface)', borderRadius: 14,
                  border: '1px solid var(--border)', padding: 14, marginTop: 8,
                }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.income} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.income} stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.expense} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.expense} stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="Income"  stroke={C.income}  strokeWidth={2} fill="url(#incGrad)" dot={{ r: 3, fill: C.income }}  />
                      <Area type="monotone" dataKey="Expense" stroke={C.expense} strokeWidth={2} fill="url(#expGrad)" dot={{ r: 3, fill: C.expense }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                    <ChartLegend color={C.income}  label="Income"  />
                    <ChartLegend color={C.expense} label="Expense" />
                  </div>
                </div>
              </Section>

            </div>
          </div>
        )}
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

function ChartLegend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
