// ─── CategoryBreakdown ────────────────────────────────────────────
// Expense share per category for the selected period, as ranked bars.
import { PieChart as PieIcon } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import { categoryColor } from '../../../utils/categories';
import { CategoryIcon } from '../../../components/CategoryPicker';

export default function CategoryBreakdown({ totals = [], theme, compact = false, onSelect, selected, max = 8 }) {
  if (!totals.length) return null;
  const top = totals[0]?.amount || 1;
  const shown = totals.slice(0, max);
  const rest = totals.slice(max);
  const restAmt = rest.reduce((s, c) => s + c.amount, 0);
  const sum = totals.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="card" style={{ padding: compact ? '12px 14px' : '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PieIcon size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>By Category</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatAmount(sum)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 7 : 9 }}>
        {shown.map((c) => {
          const color = categoryColor(c.key, theme);
          const active = selected === c.key;
          return (
            <button key={c.key} type="button" onClick={onSelect ? () => onSelect(active ? null : c.key) : undefined} style={{
              display: 'block', width: '100%', textAlign: 'left', background: active ? color + '14' : 'transparent',
              border: 'none', padding: active ? '4px 6px' : '0', margin: active ? '-4px -6px' : 0, borderRadius: 8,
              cursor: onSelect ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <CategoryIcon category={c.key} size={11} style={{ color }} />
                  {c.label}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {c.count}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                  {formatAmount(c.amount)} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{Math.round(c.share)}%</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.amount / top) * 100}%`, background: color, borderRadius: 99, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
              </div>
            </button>
          );
        })}
        {rest.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>+{rest.length} more · {formatAmount(restAmt)}</div>
        )}
      </div>
    </div>
  );
}
