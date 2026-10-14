// ─── Billing sessions overview (active, drafts, history, archived) ──
import { ChevronDown, ChevronRight, Clock, ReceiptText, Archive, Share2, Plus } from 'lucide-react';
import { formatAmount, formatDate } from '../../../utils/dateHelpers';
import HistoryCard from './HistoryCard';

/* What Billings adds up to: open now, spent for others, got back, still out */
function Overview({ sessions }) {
  const live = sessions.filter(s => s.status !== 'archived');
  const spent = live.reduce((t, s) => t + (Number(s.total_spent) || 0), 0);
  const back = live.reduce((t, s) => t + (Number(s.total_received) || 0), 0);
  const out = live.filter(s => s.status === 'closed').reduce((t, s) => t + Math.max(0, -(Number(s.net_balance) || 0)), 0);
  const open = live.filter(s => s.status === 'open' || s.status === 'draft').length;
  const closed = live.filter(s => s.status === 'closed').length;
  return (
    <div className="overview-stats">
      <div className="overview-stat"><div className="k">Open</div><div className="v">{open}</div><div className="s">{closed} closed</div></div>
      <div className="overview-stat"><div className="k">Spent for others</div><div className="v" style={{ color: 'var(--expense)' }}>{formatAmount(spent)}</div><div className="s">all billings</div></div>
      <div className="overview-stat"><div className="k">Got back</div><div className="v" style={{ color: 'var(--income)' }}>{formatAmount(back)}</div><div className="s">{spent ? `${Math.round(Math.min(1, back / spent) * 100)}% recovered` : '—'}</div></div>
      <div className="overview-stat"><div className="k">Not recovered</div><div className="v" style={{ color: out > 0 ? 'var(--expense)' : 'var(--text)' }}>{out > 0 ? formatAmount(out) : '—'}</div><div className="s">on closed billings</div></div>
    </div>
  );
}

export default function SessionsList({
  activeSessions, draftSessions, closedSessions, archivedSessions,
  showHistory, setShowHistory, showArchived, setShowArchived,
  setActiveSessionId, setSharingSession, setDeletingId,
  handleEditSession, archiveSession, unarchiveSession,
  allSessions = [], onNew,
}) {
  if (!allSessions.length) {
    return (
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ReceiptText size={26} style={{ color: 'var(--accent)' }} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No billings yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 340 }}>
          Buying things for someone else — materials for a relative, a group order? List what you bought and what they paid back; the difference is tracked for you.
        </div>
        {onNew && <button onClick={onNew} style={{ marginTop: 4, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Start a billing</button>}
      </div>
    );
  }
  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Overview sessions={allSessions} />

        {activeSessions.length + draftSessions.length === 0 && (
          <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ReceiptText size={22} style={{ color: 'var(--accent)' }} /></div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>No billing open right now</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>Start one when you buy for someone — or open a past billing below to share or edit it.</div>
            </div>
            {onNew && <button onClick={onNew} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Start a billing</button>}
          </div>
        )}

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
                Active Sessions ({activeSessions.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeSessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  style={{
                    padding: '16px 18px', borderRadius: 16, background: 'var(--surface)',
                    border: '1.5px solid var(--accent-border)', boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Started {formatDate(s.date)} · Spend: {formatAmount(s.total_spent ?? 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSharingSession(s); }}
                      title="Share session summary & receipt"
                      style={{
                        padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
                        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Share2 size={13} /> Share
                    </button>
                    <button style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Open Workspace →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drafts */}
        {draftSessions.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Drafts ({draftSessions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {draftSessions.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '14px 16px', borderRadius: 14, background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div onClick={() => setActiveSessionId(s.id)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDate(s.date)} · Saved as draft
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      onClick={() => setActiveSessionId(s.id)}
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >Resume →</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSharingSession(s); }}
                      title="Share draft session"
                      style={{
                        width: 26, height: 26, borderRadius: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)', cursor: 'pointer',
                      }}
                    >
                      <Share2 size={12} />
                    </button>
                    <button
                      onClick={() => archiveSession(s.id)}
                      title="Archive this draft"
                      style={{
                        width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Closed Session History */}
        <div>
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 14px', borderRadius: 12,
              background: showHistory ? 'var(--surface2)' : 'transparent',
              border: '1px dashed var(--border)',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: showHistory ? 10 : 0,
              transition: 'all 0.15s',
            }}
          >
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Session History ({closedSessions.length})
            </span>
            <span style={{ marginLeft: 'auto' }}>
              {showHistory
                ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              }
            </span>
          </button>

          {showHistory && (
            closedSessions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12, textAlign: 'center' }}>
                <ReceiptText size={28} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No closed sessions yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {closedSessions.map(s => (
                  <HistoryCard
                    key={s.id}
                    session={s}
                    onEdit={handleEditSession}
                    onDelete={setDeletingId}
                    onArchive={archiveSession}
                    onShare={setSharingSession}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* ─── Archived Sessions ─── */}
        {archivedSessions.length > 0 && (
          <div>
            {/* Toggle header */}
            <button
              onClick={() => setShowArchived(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', borderRadius: 12,
                background: showArchived ? 'var(--surface2)' : 'transparent',
                border: '1px dashed var(--border)',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: showArchived ? 10 : 0,
                transition: 'all 0.15s',
              }}
            >
              <Archive size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Archived ({archivedSessions.length})
              </span>
              <span style={{ marginLeft: 'auto' }}>
                {showArchived
                  ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                }
              </span>
            </button>

            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archivedSessions.map(s => (
                  <HistoryCard
                    key={s.id}
                    session={s}
                    onDelete={setDeletingId}
                    onUnarchive={unarchiveSession}
                    onShare={setSharingSession}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
  );
}
