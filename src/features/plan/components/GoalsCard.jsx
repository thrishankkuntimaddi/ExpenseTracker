// ─── GoalsCard ────────────────────────────────────────────────────
// Savings goals with progress, pace and ETA. Reused on Plan and Stats.
import { Flag, Plus, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import { computeGoalProgress } from '../../../utils/goals';
import { getSavingsType } from '../../../utils/typeConfig';

export default function GoalsCard({ goals = [], transactions = [], onAdd, onEdit, compact = false, emptyHint = true }) {
  if (!goals.length) {
    if (!emptyHint) return null;
    return (
      <div className="card" style={{ padding: compact ? 14 : 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Flag size={17} style={{ color: 'var(--savings)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>No savings goals yet</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Emergency fund, a trip, a laptop — track progress from your savings entries.</div>
        </div>
        {onAdd && (
          <button onClick={onAdd} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700, background: 'var(--savings)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> Goal
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ padding: compact ? '11px 14px' : '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flag size={13} style={{ color: 'var(--savings)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Savings Goals</span>
        </div>
        {onAdd && (
          <button onClick={onAdd} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--savings-bg)', color: 'var(--savings)', border: '1px solid var(--savings-border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={11} /> New
          </button>
        )}
      </div>
      {goals.map((g, i) => {
        const p = computeGoalProgress(g, transactions);
        const color = g.color || (p.done ? 'var(--income)' : p.overdue ? 'var(--expense)' : 'var(--savings)');
        const st = g.savingsType ? getSavingsType(g.savingsType) : null;
        return (
          <div key={g.id} style={{ padding: compact ? '11px 14px' : '13px 16px', borderBottom: i < goals.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.done && <CheckCircle2 size={14} style={{ color: 'var(--income)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {st ? st.label : 'All savings'}{g.keyword ? ` · “${g.keyword}”` : ''}
                  {g.deadline ? ` · by ${new Date(g.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color }}>{Math.round(p.pct)}%</span>
                {onEdit && (
                  <button onClick={() => onEdit(g)} aria-label="Edit goal" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil size={10} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p.pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--text-secondary)' }}>{formatAmount(p.saved)}</strong> of {formatAmount(p.target)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {p.done ? 'Goal reached 🎉'
                  : p.overdue ? <><AlertTriangle size={10} style={{ color: 'var(--expense)' }} /> Deadline passed · {formatAmount(p.remaining)} short</>
                  : p.neededPerMonth != null ? `${formatAmount(p.neededPerMonth)}/mo needed${p.onTrack === false ? ' · behind pace' : p.onTrack ? ' · on track' : ''}`
                  : p.eta ? `ETA ${p.eta.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} at current pace`
                  : `${formatAmount(p.remaining)} to go`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
