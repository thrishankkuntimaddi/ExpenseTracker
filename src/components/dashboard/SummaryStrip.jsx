// ─── Desktop dashboard: top KPI strip ───
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Users, Flame } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import { SummaryTile } from './ui';

export default function SummaryStrip({ stats, positive }) {
  return (
    <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
      {/* Remaining Balance */}
      <div
        style={{
          background: positive
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : 'linear-gradient(135deg, #F43F5E, #E11D48)',
          borderRadius: 16,
          padding: '15px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: positive ? '0 6px 18px rgba(16, 185, 129, 0.22)' : '0 6px 18px rgba(244, 63, 94, 0.22)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)' }}>
            Remaining
          </span>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={12} color="#fff" />
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {formatAmount(stats.balance)}
        </div>
      </div>

      <SummaryTile label="Income" value={stats.totalIncome} color="var(--income)" bg="var(--income-bg)" gradient="linear-gradient(135deg, #10B981, #0D9488)" Icon={TrendingUp} />
      <SummaryTile label="Expense" value={stats.totalExpense} color="var(--expense)" bg="var(--expense-bg)" gradient="linear-gradient(135deg, #F43F5E, #E11D48)" Icon={TrendingDown} />
      <SummaryTile label="Savings" value={stats.totalSavings} color="var(--savings)" bg="var(--savings-bg)" gradient="linear-gradient(135deg, #3B82F6, #6366F1)" Icon={PiggyBank} />
      <SummaryTile
        label="You Owe (Debt)"
        value={stats.allTimeNetOwed}
        color="var(--borrowed)"
        bg="var(--borrowed-bg)"
        gradient="linear-gradient(135deg, #EF4444, #DC2626)"
        Icon={Users}
      />
      <SummaryTile
        label="Owes You (Lent)"
        value={stats.allTimeNetLent}
        color="var(--lent)"
        bg="var(--lent-bg)"
        gradient="linear-gradient(135deg, #F59E0B, #D97706)"
        Icon={Users}
      />

      {/* Waste Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '15px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(135deg, #FF5722, #EA580C)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            Wastage
          </span>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--waste-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={13} style={{ color: 'var(--waste)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--waste)', letterSpacing: '-0.02em' }}>{stats.wastePercent}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>({formatAmount(stats.totalWaste)})</div>
        </div>
      </div>
    </div>
  );
}
