// ─── ConfirmDeleteModal ──────────────────────────────────────────
// Generic confirmation dialog for destructive actions.

import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmDeleteModal({
  title = 'Delete this item?',
  message = 'This action cannot be undone.',
  details = null,          // optional extra detail lines (array of strings or JSX)
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 20, padding: '24px 24px 20px', maxWidth: 380, width: '100%',
        boxShadow: 'var(--shadow-md)',
        animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'var(--expense-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} style={{ color: 'var(--expense)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              {message}
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'var(--surface2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Optional detail bullets */}
        {details && details.length > 0 && (
          <div style={{
            background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px',
            marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {details.map((d, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--expense)', fontWeight: 700, flexShrink: 0 }}>—</span>
                {d}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--expense)', color: '#fff',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Trash2 size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.93) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
