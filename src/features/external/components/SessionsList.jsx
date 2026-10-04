// ─── Billing sessions overview (active, drafts, history, archived) ──
import { ChevronDown, ChevronRight, Clock, ReceiptText, Archive, Share2 } from 'lucide-react';
import { formatAmount, formatDate } from '../../../utils/dateHelpers';
import HistoryCard from './HistoryCard';

export default function SessionsList({
  activeSessions, draftSessions, closedSessions, archivedSessions,
  showHistory, setShowHistory, showArchived, setShowArchived,
  setActiveSessionId, setSharingSession, setDeletingId,
  handleEditSession, archiveSession, unarchiveSession,
}) {
  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

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
