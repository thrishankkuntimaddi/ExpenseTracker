// ─── DueRecurringCard ─────────────────────────────────────────────
// Recurring entries waiting for a one-tap "Log" or "Skip". Shown on the
// Expenses tab, the desktop dashboard and the Plan tab whenever there is
// something due. Auto-post rules never appear here.
import { useState } from 'react';
import { CalendarClock, Check, SkipForward, ChevronDown, ChevronUp } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import { fromKey } from '../../../utils/recurring';
import { CategoryBadge } from '../../../components/CategoryPicker';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

const KIND_COLOR = { expense: 'var(--expense)', savings: 'var(--savings)', income: 'var(--income)' };

export default function DueRecurringCard({ due = [], onPost, onSkip, onSkipAll, compact = false }) {
  const [busy, setBusy] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [confirmSkipAll, setConfirmSkipAll] = useState(false);
  if (!due.length) return null;

  const visible = showAll || due.length <= 4 ? due : due.slice(-3);
  const hidden = due.length - visible.length;
  const total = due.reduce((s, d) => s + (d.rule.kind === 'income' ? 0 : Number(d.rule.amount) || 0), 0);

  async function run(key, fn) {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); } finally { setBusy((b) => { const n = { ...b }; delete n[key]; return n; }); }
  }

  const dueRules = [...new Set(due.map((d) => d.rule))];
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent-border)' }}>
      {confirmSkipAll && (
        <ConfirmDeleteModal title={`Skip all ${due.length} due entries?`}
          message="Nothing is logged for them; each rule moves on to its next date. Skipped entries can't be logged later from here."
          confirmLabel="Skip all" ConfirmIcon={SkipForward}
          onConfirm={() => { setConfirmSkipAll(false); run('skipall', () => Promise.all(dueRules.map((r) => onSkipAll(r)))); }}
          onCancel={() => setConfirmSkipAll(false)} />
      )}
      <div style={{ padding: compact ? '11px 14px 8px' : '13px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarClock size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {due.length} recurring entr{due.length === 1 ? 'y' : 'ies'} due
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {total > 0 ? `${formatAmount(total)} outgoing · ` : ''}log them with one tap
            </div>
          </div>
        </div>
        {due.length > 1 && (
          <button
            onClick={() => run('all', () => Promise.all(due.map((d) => onPost(d))))}
            disabled={!!busy.all}
            style={{ padding: '6px 11px', borderRadius: 9, fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            {busy.all ? 'Logging…' : 'Log all'}
          </button>
        )}
      </div>

      {hidden > 0 && (
        <button onClick={() => setShowAll(true)} style={{ width: '100%', padding: '6px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface2)', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ChevronDown size={11} /> {hidden} older occurrence{hidden === 1 ? '' : 's'} hidden — show
        </button>
      )}
      {showAll && due.length > 4 && (
        <button onClick={() => setShowAll(false)} style={{ width: '100%', padding: '6px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface2)', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ChevronUp size={11} /> show fewer
        </button>
      )}

      {visible.map(({ rule, dateKey }) => {
        const key = `${rule.id}|${dateKey}`;
        const d = fromKey(dateKey);
        const isToday = dateKey === new Date().toLocaleDateString('en-CA');
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '9px 14px' : '10px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</span>
                {rule.kind === 'expense' && rule.category && <CategoryBadge category={rule.category} compact />}
              </div>
              <div style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 500, marginTop: 1 }}>
                {isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                {rule.kind !== 'expense' && <span style={{ textTransform: 'capitalize' }}> · {rule.kind}</span>}
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: KIND_COLOR[rule.kind] ?? 'var(--text)', flexShrink: 0 }}>
              {rule.kind === 'income' ? '+' : ''}{formatAmount(rule.amount)}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => run(key, () => onPost({ rule, dateKey }))}
                disabled={!!busy[key]}
                title="Log this entry"
                style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--income)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => run(key, () => onSkip({ rule, dateKey }))}
                disabled={!!busy[key]}
                title="Skip this occurrence"
                style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <SkipForward size={13} />
              </button>
            </div>
          </div>
        );
      })}

      {onSkipAll && due.length > 1 && (
        <div style={{ padding: '6px 16px 10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setConfirmSkipAll(true)}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Skip everything that is due
          </button>
        </div>
      )}
    </div>
  );
}
