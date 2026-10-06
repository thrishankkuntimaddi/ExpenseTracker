// ─── Trip history card (closed / archived) — mirrors Billings' HistoryCard ──
import { useState } from 'react';
import { Trash2, ChevronDown, ChevronRight, Pencil, Archive, ArchiveRestore, Share2, ArrowRight } from 'lucide-react';
import { formatAmount, formatDateShort } from '../../../utils/dateHelpers';
import { computeTripSummary } from '../../../utils/split';

const iconBtn = (bg, border, color) => ({
  width: 30, height: 30, borderRadius: 7, background: bg, border: border ? `1px solid ${border}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color, cursor: 'pointer', flexShrink: 0,
});

export default function TripHistoryCard({ trip, onOpen, onEdit, onDelete, onArchive, onUnarchive, onShare }) {
  const [open, setOpen] = useState(false);
  const s = computeTripSummary(trip);
  const isArchived = trip.status === 'archived';
  const nameOf = (id) => (trip.members ?? []).find((m) => m.id === id)?.name ?? '?';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', opacity: isArchived ? 0.75 : 1 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', gap: 8, textAlign: 'left', borderRadius: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {isArchived && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)', letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>Archived</span>}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.name}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {trip.startDate ? formatDateShort(trip.startDate) : '—'} · {(trip.members ?? []).length} people · {s.isSettled ? 'settled' : `${formatAmount(s.outstanding)} unsettled`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(s.total)}</span>
          {onShare && <span role="button" tabIndex={0} title="Share summary" onClick={(e) => { e.stopPropagation(); onShare(trip); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onShare(trip))} style={iconBtn('var(--accent-bg)', 'var(--accent-border)', 'var(--accent)')}><Share2 size={12} /></span>}
          {onEdit && !isArchived && <span role="button" tabIndex={0} title="Edit trip" onClick={(e) => { e.stopPropagation(); onEdit(trip); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onEdit(trip))} style={iconBtn('var(--surface2)', 'var(--border)', 'var(--text-secondary)')}><Pencil size={12} /></span>}
          {onUnarchive && isArchived && <span role="button" tabIndex={0} title="Unarchive" onClick={(e) => { e.stopPropagation(); onUnarchive(trip); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onUnarchive(trip))} style={iconBtn('var(--surface2)', 'var(--border)', 'var(--text-muted)')}><ArchiveRestore size={12} /></span>}
          {onArchive && !isArchived && <span role="button" tabIndex={0} title="Archive — hide from main list" onClick={(e) => { e.stopPropagation(); onArchive(trip); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onArchive(trip))} style={iconBtn('transparent', null, 'var(--text-muted)')}><Archive size={12} /></span>}
          {onDelete && <span role="button" tabIndex={0} title="Delete permanently" onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onDelete(trip.id))} style={iconBtn('transparent', null, 'var(--text-muted)')}><Trash2 size={12} /></span>}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Who paid what</p>
              {(trip.expenses ?? []).filter((e) => e.paidBy && Number(e.amount) > 0).map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><strong>{nameOf(e.paidBy)}</strong> · {e.title}</span>
                  <span style={{ color: 'var(--expense)', fontWeight: 700, flexShrink: 0 }}>{formatAmount(e.amount)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total · {formatAmount(s.perHead)} per head</span>
                <span style={{ color: 'var(--expense)' }}>{formatAmount(s.total)}</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Who pays whom</p>
              {s.transfers.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--income)', fontWeight: 600, padding: '5px 0' }}>All settled ✓</div>
              ) : s.transfers.map((t) => (
                <div key={`${t.from}-${t.to}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.fromName} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} /> {t.toName}</span>
                  <span style={{ color: 'var(--expense)', fontWeight: 700, flexShrink: 0 }}>{formatAmount(t.amount)}</span>
                </div>
              ))}
              {s.settledTotal > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Settled so far: {formatAmount(s.settledTotal)}</div>}
            </div>
          </div>
          <button onClick={() => onOpen(trip.id)} style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Open trip →
          </button>
        </div>
      )}
    </div>
  );
}
