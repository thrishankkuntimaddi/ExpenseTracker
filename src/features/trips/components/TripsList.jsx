// ─── Trips overview (summary, active, history, archived) ──────────
import { ChevronDown, ChevronRight, Clock, Archive, Share2, Map, Trash2, Pencil, Users, LogIn, Plus } from 'lucide-react';
import { formatAmount, formatDateShort } from '../../../utils/dateHelpers';
import { computeTripSummary } from '../../../utils/split';
import TripHistoryCard from './TripHistoryCard';
import Sign from '../../../motion/Sign';

const smallBtn = (bg, border, color) => ({
  width: 30, height: 30, borderRadius: 7, background: bg, border: border ? `1px solid ${border}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color, cursor: 'pointer', flexShrink: 0,
});
const sharedBadge = { fontSize: 9.5, fontWeight: 750, padding: '2px 7px', borderRadius: 99, background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3 };

/** Totals over every trip: what's running, what you've spent, what's still open for you. */
function Overview({ trips, activeTrips, closedTrips }) {
  const last = [...trips].filter((t) => t.status !== 'archived').sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
  const lastSum = last ? computeTripSummary(last) : null;
  // What's still open for you on running trips, per currency (usually one)
  const mine = {};
  activeTrips.forEach((t) => {
    const s = computeTripSummary(t);
    if (!s.meUnit) return;
    const u = s.units.find((x) => x.id === s.meUnit);
    if (u) mine[t.currency ?? ''] = (mine[t.currency ?? ''] ?? 0) + u.remaining;
  });
  const [cur, bal] = Object.entries(mine)[0] ?? [];
  const people = new Set();
  trips.forEach((t) => (t.members ?? []).forEach((m) => { if (m.id !== t.meMemberId) people.add(m.name.trim().toLowerCase()); }));
  const sharedCount = trips.filter((t) => t.shared).length;

  return (
    <div className="overview-stats">
      <div className="overview-stat"><div className="k">Running</div><div className="v">{activeTrips.length}</div><div className="s">{closedTrips.length} in history</div></div>
      <div className="overview-stat">
        <div className="k">{bal == null ? 'Your balance' : bal > 0.004 ? 'You get back' : bal < -0.004 ? 'You owe' : 'Your balance'}</div>
        <div className="v" style={{ color: bal > 0.004 ? 'var(--income)' : bal < -0.004 ? 'var(--expense)' : 'var(--text)' }}>{bal == null ? '—' : Math.abs(bal) < 0.005 ? 'Square' : formatAmount(Math.abs(bal), cur || undefined)}</div>
        <div className="s">on running trips</div>
      </div>
      <div className="overview-stat"><div className="k">Last trip</div><div className="v">{lastSum ? formatAmount(lastSum.total, last.currency) : '—'}</div><div className="s">{last ? last.name : 'none yet'}</div></div>
      <div className="overview-stat"><div className="k">Travelled with</div><div className="v">{people.size}</div><div className="s">{sharedCount ? `${sharedCount} shared trip${sharedCount === 1 ? '' : 's'}` : 'people'}</div></div>
    </div>
  );
}

export default function TripsList({
  trips = [], activeTrips, closedTrips, archivedTrips,
  showHistory, setShowHistory, showArchived, setShowArchived, canManage = () => true,
  onOpen, onShare, onEdit, onDelete, onArchive, onUnarchive, onNew, onJoin,
}) {
  const nothing = activeTrips.length + closedTrips.length + archivedTrips.length === 0;
  if (nothing) {
    return (
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sign kind="plane" size={30} style={{ color: 'var(--external)' }} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No trips yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 340 }}>
          Road trip, weekend away, a shared dinner. Fill in who paid for what and get a fair “who pays whom” plan — or invite your friends so everyone adds their own spending.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onNew} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Start a trip</button>
          {onJoin && <button onClick={onJoin} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Join with a link</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Overview trips={trips} activeTrips={activeTrips} closedTrips={closedTrips} />

      {/* Active trips */}
      {activeTrips.length > 0 ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span className="section-label" style={{ margin: 0 }}>Active trips · {activeTrips.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTrips.map((t) => {
              const s = computeTripSummary(t);
              const manage = canManage(t);
              const mine = s.meUnit ? s.units.find((u) => u.id === s.meUnit) : null;
              return (
                <div key={t.id} className="trip-card" onClick={() => onOpen(t.id)} style={{ padding: '14px 16px 10px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        {t.shared && <span style={sharedBadge}><Users size={10} /> {t.isOwner ? 'Shared' : `by ${t.ownerName ?? 'a friend'}`}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.startDate ? `${formatDateShort(t.startDate)}${t.endDate ? ` – ${formatDateShort(t.endDate)}` : ''} · ` : ''}{(t.members ?? []).length} people · {s.count} expense{s.count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
                    <Stat label="Spent" value={formatAmount(s.total, t.currency)} />
                    {s.count > 0 && <Stat label={s.isSettled ? 'Status' : 'To settle'} value={s.isSettled ? 'Settled' : formatAmount(s.outstanding, t.currency)} tone={s.isSettled ? 'income' : 'expense'} />}
                    {mine && s.count > 0 && <Stat label="You" value={mine.remaining > 0.004 ? `get ${formatAmount(mine.remaining, t.currency)}` : mine.remaining < -0.004 ? `owe ${formatAmount(-mine.remaining, t.currency)}` : 'square'} tone={mine.remaining > 0.004 ? 'income' : mine.remaining < -0.004 ? 'expense' : 'text'} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <button onClick={(e) => { e.stopPropagation(); onShare(t); }} aria-label="Share summary" title="Share summary" style={smallBtn('var(--accent-bg)', null, 'var(--accent)')}><Share2 size={13} /></button>
                    {manage && <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} aria-label="Edit trip" title="Edit trip" style={smallBtn('var(--surface2)', null, 'var(--text-secondary)')}><Pencil size={13} /></button>}
                    {manage && <button onClick={(e) => { e.stopPropagation(); onArchive(t); }} aria-label="Archive" title="Archive" style={smallBtn('var(--surface2)', null, 'var(--text-secondary)')}><Archive size={13} /></button>}
                    {manage && <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} aria-label="Delete" title="Delete" style={smallBtn('var(--surface2)', null, 'var(--expense)')}><Trash2 size={13} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sign kind="plane" size={24} style={{ color: 'var(--external)' }} /></div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>No trip running right now</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>Start one before you leave and invite the gang — or open a past trip below.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onNew} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Start a trip</button>
            {onJoin && <button onClick={onJoin} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}><LogIn size={13} /> Join</button>}
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
            {closedTrips.map((t) => {
              const manage = canManage(t);
              return <TripHistoryCard key={t.id} trip={t} onOpen={onOpen} onEdit={manage ? onEdit : null} onDelete={manage ? onDelete : null} onArchive={manage ? onArchive : null} onShare={onShare} />;
            })}
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
              {archivedTrips.map((t) => {
                const manage = canManage(t);
                return <TripHistoryCard key={t.id} trip={t} onOpen={onOpen} onDelete={manage ? onDelete : null} onUnarchive={manage ? onUnarchive : null} onShare={onShare} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'text' }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 750, color: `var(--${tone})` }}>{value}</div>
    </div>
  );
}
