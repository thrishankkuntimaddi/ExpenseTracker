// ─── Desktop dashboard: sticky header (logo, section tabs, period, balance, theme) ───
import { Moon, Sun, List, ReceiptText } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import PeriodSelector from '../PeriodSelector';

export default function DashboardHeader({
  activeSection, setActiveSection,
  selectedPeriod, onPeriodChange, transactions, income,
  stats, positive, isMonoflow, onThemeChange,
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '11px 28px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
      flexWrap: 'wrap', gap: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={import.meta.env.BASE_URL + 'Expense.png'}
          alt="Expense Tracker Logo"
          style={{
            width: 36, height: 36, borderRadius: 10,
            objectFit: 'cover',
          }}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            Expense Tracker
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            Financial Command Center
          </div>
        </div>
      </div>

      {/* Center: nav tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'history', label: 'History', icon: <List size={12} /> },
          { key: 'external', label: 'Billings', icon: <ReceiptText size={12} /> },
          { key: 'settings', label: 'Settings' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)',
              background: activeSection === tab.key ? 'var(--accent)' : 'transparent',
              color: activeSection === tab.key ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right: period + balance + theme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PeriodSelector
          period={selectedPeriod}
          onChange={onPeriodChange}
          transactions={transactions}
          income={income}
        />
        <div style={{
          padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12,
          background: positive ? 'var(--income-bg)' : 'var(--expense-bg)',
          color: positive ? 'var(--income)' : 'var(--expense)',
          border: `1.5px solid ${positive ? 'var(--income-border)' : 'var(--expense-border)'}`,
        }}>
          Balance: {formatAmount(stats.balance)}
        </div>
        {/* Theme toggle */}
        <button
          onClick={() => onThemeChange(isMonoflow ? 'light' : 'monoflow')}
          title={isMonoflow ? 'Switch to Light' : 'Switch to MonoFlow'}
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {isMonoflow ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </div>
  );
}
