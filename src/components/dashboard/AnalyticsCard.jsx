// ─── Desktop dashboard: category donut, period ratios, 6-month cash-flow trend ───
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Flame } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import { getPeriodLabel } from '../../utils/periodHelpers';
import { DCard, CardHeader, ChartTooltip } from './ui';

export default function AnalyticsCard({ stats, pieData, areaData, C, selectedPeriod }) {
  return (
    <DCard style={{ height: '100%' }}>
      <CardHeader title="Analytics" sub={getPeriodLabel(selectedPeriod)} />
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Donut & Legend */}
        {pieData.length > 0 ? (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Category Breakdown
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={4}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 700 }}>{formatAmount(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No category data available</p>
          </div>
        )}

        {/* Financial Health Indicators */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Period Ratios &amp; Health
          </p>

          {(() => {
            const inc = stats.totalIncome || 0;
            const exp = stats.totalExpense || 0;
            const sav = stats.totalSavings || 0;
            const wst = stats.totalWaste || 0;

            const expRatio = inc > 0 ? Math.min(100, Math.round((exp / inc) * 100)) : 0;
            const savRatio = inc > 0 ? Math.min(100, Math.round((sav / inc) * 100)) : 0;
            const wstRatio = exp > 0 ? Math.min(100, Math.round((wst / exp) * 100)) : 0;

            return (
              <>
                {/* Savings Rate */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Savings Rate</span>
                    <span style={{ color: savRatio >= 20 ? 'var(--income)' : savRatio >= 10 ? 'var(--lent)' : 'var(--expense)' }}>
                      {savRatio}% {savRatio >= 20 ? '(Healthy)' : savRatio >= 10 ? '(Moderate)' : '(Low)'}
                    </span>
                  </div>
                  <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${savRatio}%`, borderRadius: 99, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Expense Ratio */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Expense Ratio</span>
                    <span style={{ color: expRatio > 80 ? 'var(--expense)' : expRatio > 60 ? 'var(--lent)' : 'var(--income)' }}>
                      {expRatio}% of Income
                    </span>
                  </div>
                  <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${expRatio}%`, borderRadius: 99, background: expRatio > 80 ? 'var(--expense)' : expRatio > 60 ? 'var(--lent)' : 'var(--income)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Wastage Impact */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={11} style={{ color: wst > 0 ? 'var(--expense)' : 'var(--text-muted)' }} /> Wastage Leakage
                    </span>
                    <span style={{ color: wst > 0 ? 'var(--expense)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {wstRatio}% of Expenses ({formatAmount(wst)})
                    </span>
                  </div>
                  <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${wstRatio}%`, borderRadius: 99, background: 'var(--expense)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Cash Flow Trend Graph */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Cash Flow Trend (6 Months)
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.income }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: C.income }} /> Income
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.expense }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: C.expense }} /> Expense
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.income} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.income} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.expense} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.expense} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Income" stroke={C.income} strokeWidth={2} fillOpacity={1} fill="url(#incGrad)" />
              <Area type="monotone" dataKey="Expense" stroke={C.expense} strokeWidth={2} fillOpacity={1} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DCard>
  );
}
