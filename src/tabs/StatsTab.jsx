import { useMemo } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Users, Scale, Flame, CalendarDays, ArrowDownToLine } from 'lucide-react';
import { formatAmount } from '../utils/dateHelpers';
import { filterItemsByPeriod, getOpeningBalance } from '../utils/periodHelpers';
import PeriodSelector from '../components/PeriodSelector';

function MetricCard({ label, value, color, bg, border, Icon, sub }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 18, padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{formatAmount(value)}</div>
      {sub && <div style={{ fontSize: 11, color, opacity: 0.7, marginTop: 4 }}>{sub}</div>}
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

export default function StatsTab({ transactions, income, selectedPeriod, onPeriodChange }) {
  /* ─ Filter data to selected period ─ */
  const filtTxns = useMemo(() => filterItemsByPeriod(transactions, selectedPeriod), [transactions, selectedPeriod]);
  const filtInc  = useMemo(() => filterItemsByPeriod(income, selectedPeriod),       [income, selectedPeriod]);

  /* ─ Compute stats ─ */
  const stats = useMemo(() => {
    const openingBalance = getOpeningBalance(selectedPeriod, transactions, income);

    const totalIncome  = filtInc.reduce((s, i) => s + i.amount, 0);
    const totalExpense = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavings = filtTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const totalPerson  = filtTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
    const totalWaste   = filtTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0);

    const balance = openingBalance + totalIncome - totalExpense - totalSavings - totalPerson;

    const now  = new Date();
    const all  = [...filtTxns, ...filtInc];
    const firstDate = all.reduce((min, t) => { const d = new Date(t.date); return d < min ? d : min; }, now);
    const days   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
    const weeks  = Math.max(1, days / 7);
    const months = Math.max(1, days / 30);
    const spend  = totalExpense + totalPerson;

    return {
      openingBalance, totalIncome, totalExpense, totalSavings, totalPerson, totalWaste, balance,
      avgDay: spend / days, avgWeek: spend / weeks, avgMonth: spend / months,
      wastePercent: totalExpense > 0 ? ((totalWaste / totalExpense) * 100).toFixed(1) : '0.0',
    };
  }, [filtTxns, filtInc, selectedPeriod, transactions, income]);

  const positive = stats.balance >= 0;
  const hasData  = filtTxns.length > 0 || filtInc.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Stats</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Financial overview for selected period</p>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>

        {!hasData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>No data for this period</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add transactions to see your stats</p>
          </div>
        ) : (
          <div className="stats-layout">

            {/* LEFT: Balance hero + carry-forward + averages */}
            <div className="stats-left">

              {/* Opening Balance (carry-forward) */}
              {stats.openingBalance !== 0 && (
                <div style={{ borderRadius: 16, padding: '14px 18px', marginBottom: 14, background: stats.openingBalance >= 0 ? 'var(--income-bg)' : 'var(--expense-bg)', border: `1.5px solid ${stats.openingBalance >= 0 ? 'var(--income-border)' : 'var(--expense-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ArrowDownToLine size={15} style={{ color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)' }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening Balance</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Carried forward from previous period</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: stats.openingBalance >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                    {formatAmount(stats.openingBalance)}
                  </div>
                </div>
              )}

              {/* Remaining Balance Hero */}
              <div style={{ borderRadius: 20, padding: '22px 24px', marginBottom: 16, background: positive ? 'var(--income)' : 'var(--expense)', boxShadow: 'var(--shadow-md)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  Remaining Balance
                </p>
                <p style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>
                  {formatAmount(stats.balance)}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  {stats.openingBalance !== 0 ? 'Opening + Income − Expense − Savings − Given' : 'Income − Expense − Savings − Given'}
                </p>
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
                    <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--expense)' }}>{stats.wastePercent}%</div>
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
                <MetricCard label="Total Income"    value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}   />
                <MetricCard label="Total Expense"   value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown}  />
                <MetricCard label="Savings"         value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}    />
                <MetricCard label="Given to People" value={stats.totalPerson}  color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}        />
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .stats-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
        }
        @media (max-width: 1023px) {
          .stats-layout { display: flex; flex-direction: column; gap: 16px; }
        }
      `}</style>
    </div>
  );
}
