// ─── BudgetStatusCard ─────────────────────────────────────────────
// Month budget vs spend with a pace marker (where you "should" be today).
// Reused on Stats, the desktop dashboard and the Plan tab.
import { Target, AlertTriangle, Pencil } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import { CategoryIcon } from '../../../components/CategoryPicker';
import { currentTheme } from '../../../utils/theme';
import { categoryColor } from '../../../utils/categories';

const STATUS_COLOR = {
  ok:   'var(--income)',
  pace: 'var(--lent)',
  warn: 'var(--waste)',
  over: 'var(--expense)',
  none: 'var(--text-muted)',
};
const STATUS_TEXT = {
  ok:   'On track',
  pace: 'Pace too fast',
  warn: 'Nearly spent',
  over: 'Over budget',
};

export function BudgetBar({ pct, pacePct, color, height = 8 }) {
  return (
    <div style={{ position: 'relative', height, background: 'var(--surface2)', borderRadius: 99, overflow: 'visible' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 99,
        background: color, transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
      }} />
      {pacePct != null && pacePct > 0 && pacePct < 100 && (
        <div title="Where the month is today" style={{
          position: 'absolute', top: -3, bottom: -3, left: `${pacePct}%`,
          width: 2, background: 'var(--text-muted)', borderRadius: 2, opacity: 0.8,
        }} />
      )}
    </div>
  );
}

export default function BudgetStatusCard({ status, onEdit, compact = false, title = 'Monthly Budget' }) {
  const theme = currentTheme();
  if (!status?.hasBudget) {
    return (
      <div className="card" style={{ padding: compact ? 14 : 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Target size={17} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>No budget set</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Set a monthly cap to see “safe to spend today” and pace alerts.</div>
        </div>
        {onEdit && (
          <button onClick={onEdit} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Set budget
          </button>
        )}
      </div>
    );
  }

  const t = status.total;
  const color = STATUS_COLOR[t.status] ?? STATUS_COLOR.none;

  return (
    <div className="card" style={{ padding: compact ? 14 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{title}</span>
          </div>
          {t.limit ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(t.spent)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>of {formatAmount(t.limit)}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Category budgets only</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {t.limit && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 7, background: color + '22', color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {(t.status === 'over' || t.status === 'warn') && <AlertTriangle size={10} />}
              {STATUS_TEXT[t.status] ?? ''}
            </span>
          )}
          {onEdit && (
            <button onClick={onEdit} aria-label="Edit budget" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>

      {t.limit && (
        <>
          <BudgetBar pct={t.pct} pacePct={status.isCurrent ? status.pacePct : null} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{Math.round(t.pct)}% used · {Math.round(status.pacePct)}% of month gone</span>
            <span style={{ fontWeight: 700, color: t.remaining >= 0 ? 'var(--text-secondary)' : 'var(--expense)' }}>
              {t.remaining >= 0 ? `${formatAmount(t.remaining)} left` : `${formatAmount(-t.remaining)} over`}
            </span>
          </div>
          {status.isCurrent && t.safeToday != null && (
            <div style={{
              marginTop: 10, padding: '9px 12px', borderRadius: 10,
              background: t.status === 'over' ? 'var(--expense-bg)' : 'var(--income-bg)',
              border: `1px solid ${t.status === 'over' ? 'var(--expense-border)' : 'var(--income-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: t.status === 'over' ? 'var(--expense)' : 'var(--income)' }}>
                {t.status === 'over' ? 'Budget exhausted for this month' : 'Safe to spend today'}
              </span>
              {t.status !== 'over' && (
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--income)' }}>{formatAmount(t.safeToday)}</span>
              )}
            </div>
          )}
          {!compact && status.isCurrent && t.projected > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Projected month end: <strong style={{ color: t.projected > t.limit ? 'var(--expense)' : 'var(--text-secondary)' }}>{formatAmount(t.projected)}</strong>
              {' '}· {status.daysLeft} day{status.daysLeft === 1 ? '' : 's'} left
            </div>
          )}
        </>
      )}

      {status.categories.length > 0 && (
        <div style={{ marginTop: t.limit ? 14 : 4, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {status.categories.slice(0, compact ? 4 : 12).map((c) => {
            const cc = categoryColor(c.key, theme);
            const sc = STATUS_COLOR[c.status];
            return (
              <div key={c.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <CategoryIcon category={c.key} size={11} style={{ color: cc }} /> {c.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.status === 'ok' ? 'var(--text-secondary)' : sc }}>
                    {formatAmount(c.spent)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {formatAmount(c.limit)}</span>
                  </span>
                </div>
                <BudgetBar pct={c.pct} pacePct={status.isCurrent ? status.pacePct : null} color={c.status === 'ok' ? cc : sc} height={6} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
