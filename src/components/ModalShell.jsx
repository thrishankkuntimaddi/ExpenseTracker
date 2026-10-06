// ─── ModalShell ───────────────────────────────────────────────────
// Shared overlay + panel used by the Plan modals (budget, recurring, goal).
// Matches EditTransactionModal's look so dialogs feel like one family.
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function ModalShell({ title, subtitle, onClose, children, footer, maxWidth = 460, zIndex = 1500 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        style={{
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 22, padding: '22px 22px 18px', maxWidth, width: '100%',
          boxShadow: 'var(--shadow-md)', animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
          maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
          }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        {footer && <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{footer}</div>}
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalPop { from { opacity: 0; transform: scale(0.93) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

/* Small shared form bits for the Plan modals (fieldStyle lives in ./formTokens.js) */
export function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export function PrimaryButton({ children, onClick, disabled, color = 'var(--accent)', style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
      background: disabled ? 'var(--surface2)' : color, color: disabled ? 'var(--text-muted)' : '#fff',
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...style,
    }}>{children}</button>
  );
}

export function GhostButton({ children, onClick, danger, style }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
      background: danger ? 'var(--expense-bg)' : 'var(--surface2)',
      color: danger ? 'var(--expense)' : 'var(--text-secondary)',
      border: `1px solid ${danger ? 'var(--expense-border)' : 'var(--border)'}`,
      cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, ...style,
    }}>{children}</button>
  );
}
