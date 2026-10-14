// ─── Trips overview (active, history, archived) — mirrors Billings' SessionsList ──
import { ChevronDown, ChevronRight, Clock, Archive, Share2, Map, Trash2, Pencil } from 'lucide-react';
import { formatAmount, formatDateShort } from '../../../utils/dateHelpers';
import { computeTripSummary } from '../../../utils/split';
import TripHistoryCard from './TripHistoryCard';
import Sign from '../../../motion/Sign';

const smallBtn = (bg, border, color) => ({
  width: 30, height: 30, borderRadius: 7, background: bg, border: border ? `1px solid ${border}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color, cursor: 'pointer', flexShrink: 0,
});

export default function TripsList({
  activeTrips, closedTrips, archivedTrips,
  showHistory, setShowHistory, showArchived, setShowArchived,
  onOpen, onShare, onEdit, onDelete, onArchive, onUnarchive, onNew,
}) {
  const nothing = activeTrips.length + closedTrips.length + archivedTrips.length === 0;
  if (nothing) {
    return (
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sign kind="plane" size={30} style={{ color: 'var(--external)' }} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No trips yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 320 }}>
          Road trip, weekend away, a shared dinner. Fill in who paid for what and get a fair "who pays whom" plan — couples can pay as one wallet.
        </div>
        <button onClick={onNew} style={{ marginTop: 4, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Start a trip</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Active trips */}
      {activeTrips.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span className="section-label" style={{ margin: 0 }}>Active trips · {activeTrips.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTrips.map((t) => {
              const s = computeTripSummary(t);
              return (
                <div key={t.id} className="trip-card" onClick={() => onOpen(t.id)} style={{ padding: '14px 16px 10px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.startDate ? `${formatDateShort(t.startDate)} · ` : ''}{(t.members ?? []).length} people
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>Spent</div>
                      <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>{formatAmount(s.total, t.currency)}</div>
                    </div>
                    {s.count > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{s.isSettled ? 'Status' : 'To settle'}</div>
                        <div style={{ fontSize: 14, fontWeight: 750, color: s.isSettled ? 'var(--income)' : 'var(--expense)' }}>{s.isSettled ? 'Settled' : formatAmount(s.outstanding, t.currency)}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <button onClick={(e) => { e.stopPropagation(); onShare(t); }} aria-label="Share summary" title="Share summary" style={smallBtn('var(--accent-bg)', null, 'var(--accent)')}><Share2 size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} aria-label="Edit trip" title="Edit trip" style={smallBtn('var(--surface2)', null, 'var(--text-secondary)')}><Pencil size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onArchive(t); }} aria-label="Archive" title="Archive" style={smallBtn('var(--surface2)', null, 'var(--text-secondary)')}><Archive size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} aria-label="Delete" title="Delete" style={smallBtn('var(--surface2)', null, 'var(--expense)')}><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trip history (closed) */}
      <div>
        <button onClick={() => setShowHistory((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 12, background: showHistory ? 'var(--surface2)' : 'transparent', border: '1px dashed var(--border)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: showHistory ? 10 : 0, transition: 'all 0.15s' }}>
          <Clock size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Trip History ({closedTrips.length})</span>
          <span style={{ marginLeft: 'auto' }}>{showHistory ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}</span>
        </button>
        {showHistory && (closedTrips.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', gap: 10, textAlign: 'center' }}>
            <Map size={26} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No closed trips yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {closedTrips.map((t) => <TripHistoryCard key={t.id} trip={t} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} onShare={onShare} />)}
          </div>
        ))}
      </div>

      {/* Archived */}
      {archivedTrips.length > 0 && (
        <div>
          <button onClick={() => setShowArchived((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 12, background: showArchived ? 'var(--surface2)' : 'transparent', border: '1px dashed var(--border)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: showArchived ? 10 : 0, transition: 'all 0.15s' }}>
            <Archive size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Archived ({archivedTrips.length})</span>
            <span style={{ marginLeft: 'auto' }}>{showArchived ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}</span>
          </button>
          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {archivedTrips.map((t) => <TripHistoryCard key={t.id} trip={t} onOpen={onOpen} onDelete={onDelete} onUnarchive={onUnarchive} onShare={onShare} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
