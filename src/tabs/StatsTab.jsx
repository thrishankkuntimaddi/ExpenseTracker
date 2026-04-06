import { useMemo } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Users, Scale, Flame, CalendarDays } from 'lucide-react';
import { formatAmount } from '../utils/dateHelpers';

function MetricCard({ label, value, color, bg, border, Icon }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 18, padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{formatAmount(value)}</div>
    </div>
  );
}

function AvgCard({ label, value, Icon }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(value)}</div>
    </div>
  );
}

export default function StatsTab({ transactions, income }) {
  const stats = useMemo(() => {
    const totalIncome  = income.reduce((s, i) => s + i.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavings = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const totalPerson  = transactions.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
    const totalWaste   = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0);
    const balance      = totalIncome - totalExpense - totalSavings - totalPerson;

    const all = [...transactions, ...income];
    const now = new Date();
    const firstDate = all.reduce((m, t) => { const d = new Date(t.date); return d < m ? d : m; }, now);
    const days   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
    const weeks  = Math.max(1, days / 7);
    const months = Math.max(1, days / 30);
    const spend  = totalExpense + totalPerson;

    return {
      totalIncome, totalExpense, totalSavings, totalPerson, totalWaste, balance,
      avgDay: spend / days, avgWeek: spend / weeks, avgMonth: spend / months,
      wastePercent: totalExpense > 0 ? ((totalWaste / totalExpense) * 100).toFixed(1) : '0.0',
    };
  }, [transactions, income]);

  const positive = stats.balance >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Stats</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Your complete financial overview</p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>

        {/* Desktop layout wrapper */}
        <div className="stats-layout">

          {/* LEFT: Balance hero + averages */}
          <div className="stats-left">
            {/* Balance Hero */}
            <div style={{
              borderRadius: 20, padding: '22px 24px', marginBottom: 16,
              background: positive ? 'var(--income)' : 'var(--expense)',
              boxShadow: 'var(--shadow-md)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                Remaining Balance
              </p>
              <p style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>
                {formatAmount(stats.balance)}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Income − Expense − Savings − Given</p>
            </div>

            {/* Wastage */}
            <div style={{ borderRadius: 18, padding: 16, background: 'var(--expense-bg)', border: '1.5px solid var(--expense-border)', boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Flame size={14} style={{ color: 'var(--expense)' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--expense)' }}>Total Wastage</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--expense)' }}>{formatAmount(stats.totalWaste)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--expense)' }}>{stats.wastePercent}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>of expenses</div>
                </div>
              </div>
            </div>

            {/* Averages */}
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Spending Averages
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <AvgCard label="Per Day"   value={stats.avgDay}   Icon={CalendarDays} />
              <AvgCard label="Per Week"  value={stats.avgWeek}  Icon={CalendarDays} />
              <AvgCard label="Per Month" value={stats.avgMonth} Icon={Scale}        />
            </div>
          </div>

          {/* RIGHT: Metric cards */}
          <div className="stats-right">
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Breakdown
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <MetricCard label="Total Income"    value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}  />
              <MetricCard label="Total Expense"   value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown} />
              <MetricCard label="Savings"         value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />
              <MetricCard label="Given to People" value={stats.totalPerson}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}        />
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .stats-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
          .stats-left   {}
          .stats-right  {}
        }
        @media (max-width: 1023px) {
          .stats-layout { display: flex; flex-direction: column; gap: 16px; }
          .stats-right  { padding-bottom: 0; }
        }
      `}</style>
    </div>
  );
}
