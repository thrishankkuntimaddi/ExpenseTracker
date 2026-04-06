import { useMemo } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Users, Scale, Flame, CalendarDays } from 'lucide-react';
import { formatAmount } from '../utils/dateHelpers';

function MetricCard({ label, value, color, bg, border, Icon, large }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: bg, border: `1.5px solid ${border}`, boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div className={`font-bold ${large ? 'text-2xl' : 'text-xl'}`} style={{ color }}>
        {formatAmount(value)}
      </div>
    </div>
  );
}

function AverageCard({ label, value, Icon }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="text-base font-bold" style={{ color: 'var(--text)' }}>{formatAmount(value)}</div>
    </div>
  );
}

export default function StatsTab({ transactions, income }) {
  const stats = useMemo(() => {
    const totalIncome   = income.reduce((s, i) => s + i.amount, 0);
    const totalExpense  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavings  = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const totalPerson   = transactions.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
    const totalWaste    = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.wasteAmount || 0), 0);
    const balance       = totalIncome - totalExpense - totalSavings - totalPerson;

    const allItems = [...transactions, ...income];
    const now = new Date();
    const firstDate = allItems.reduce((min, t) => {
      const d = new Date(t.date); return d < min ? d : min;
    }, now);

    const daysDiff   = Math.max(1, Math.ceil((now - firstDate) / 86400000) + 1);
    const weeksDiff  = Math.max(1, daysDiff / 7);
    const monthsDiff = Math.max(1, daysDiff / 30);

    const totalSpend = totalExpense + totalPerson;
    const wastePercent = totalExpense > 0 ? ((totalWaste / totalExpense) * 100).toFixed(1) : '0.0';

    return {
      totalIncome, totalExpense, totalSavings, totalPerson, totalWaste, balance,
      avgDay:   totalSpend / daysDiff,
      avgWeek:  totalSpend / weeksDiff,
      avgMonth: totalSpend / monthsDiff,
      wastePercent,
    };
  }, [transactions, income]);

  const isPositive = stats.balance >= 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Stats</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your complete financial overview</p>
      </div>

      <div className="px-5 pb-6 flex flex-col gap-4">

        {/* Balance Hero */}
        <div className="rounded-2xl p-5" style={{
          background: isPositive ? 'var(--income)' : 'var(--expense)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Remaining Balance
          </p>
          <p className="text-4xl font-bold text-white mb-1">{formatAmount(stats.balance)}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Income − Expense − Savings − Given</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Income"   value={stats.totalIncome}  color="var(--income)"  bg="var(--income-bg)"  border="var(--income-border)"  Icon={TrendingUp}   />
          <MetricCard label="Total Expense"  value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={TrendingDown}  />
          <MetricCard label="Savings"        value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank}     />
          <MetricCard label="Given to People" value={stats.totalPerson} color="var(--person)"  bg="var(--person-bg)"  border="var(--person-border)"  Icon={Users}         />
        </div>

        {/* Wastage Card */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--expense-bg)', border: '1.5px solid var(--expense-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Flame size={14} style={{ color: 'var(--expense)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--expense)' }}>Total Wastage</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--expense)' }}>{formatAmount(stats.totalWaste)}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: 'var(--expense)' }}>{stats.wastePercent}%</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>of expenses</div>
            </div>
          </div>
        </div>

        {/* Averages */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Spending Averages</p>
          <div className="grid grid-cols-3 gap-2">
            <AverageCard label="Per Day"   value={stats.avgDay}   Icon={CalendarDays} />
            <AverageCard label="Per Week"  value={stats.avgWeek}  Icon={CalendarDays} />
            <AverageCard label="Per Month" value={stats.avgMonth} Icon={Scale} />
          </div>
        </div>
      </div>
    </div>
  );
}
