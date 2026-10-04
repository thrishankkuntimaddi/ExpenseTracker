import { useState } from 'react';
import {
  Trash2, ChevronDown, ChevronRight, Pencil, Archive, ArchiveRestore, Share2,
} from 'lucide-react';
import { formatAmount, formatDate } from '../../../utils/dateHelpers';

/* ─── Session History Card ────────────────────────────────────── */
export default function HistoryCard({ session, onEdit, onDelete, onArchive, onUnarchive, onShare }) {
  const [open, setOpen] = useState(false);
  const net       = session.net_balance ?? 0;
  const isProfit  = net > 0;
  const isLoss    = net < 0;
  const isArchived = session.status === 'archived';
  const persons   = (session.received ?? []).filter(r => r.person?.trim() && r.amount > 0).map(r => r.person).join(', ') || 'Unknown';

  return (
    <div style={{
      border: `1px solid ${isArchived ? 'var(--border)' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden', background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
      opacity: isArchived ? 0.75 : 1,
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', gap: 8, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isArchived && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  background: 'var(--surface2)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>Archived</span>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.name || persons}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {session.date ? formatDate(session.date) : '—'} · {session.status?.toUpperCase() ?? 'CLOSED'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--text-muted)',
          }}>
            {net >= 0 ? '+' : ''}{formatAmount(net)}
          </span>
          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(session); }}
              title="Share session summary & receipt"
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              <Share2 size={12} />
            </button>
          )}
          {onEdit && !isArchived && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(session.id); }}
              title="Edit session"
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--external)'; e.currentTarget.style.background = 'var(--external-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface2)'; }}
            >
              <Pencil size={12} />
            </button>
          )}
          {onUnarchive && isArchived && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnarchive(session.id); }}
              title="Unarchive — restore to history"
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--savings)'; e.currentTarget.style.background = 'var(--savings-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface2)'; }}
            >
              <ArchiveRestore size={12} />
            </button>
          )}
          {onArchive && !isArchived && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(session.id); }}
              title="Archive — hide from main list"
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Archive size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              title="Delete permanently"
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {/* Items */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Items Purchased
              </p>
              {(session.items ?? []).filter(i => i.name?.trim() && parseFloat(i.amount) > 0).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ color: 'var(--expense)', fontWeight: 700 }}>{formatAmount(parseFloat(item.amount))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Spent</span>
                <span style={{ color: 'var(--expense)' }}>{formatAmount(session.total_spent ?? 0)}</span>
              </div>
            </div>
            {/* Received */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Money Received
              </p>
              {(session.received ?? []).filter(r => r.person?.trim() && parseFloat(r.amount) > 0).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.person}</span>
                  <span style={{ color: 'var(--income)', fontWeight: 700 }}>{formatAmount(parseFloat(r.amount))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Received</span>
                <span style={{ color: 'var(--income)' }}>{formatAmount(session.total_received ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
