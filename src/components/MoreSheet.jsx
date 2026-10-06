// ─── MoreSheet ───────────────────────────────────────────────────
// Bottom sheet behind the "More" tab on mobile: the pages that don't earn
// a permanent slot in the five-icon bar.
import { useEffect } from 'react';
import { ChevronRight, MoveHorizontal, X } from 'lucide-react';

export default function MoreSheet({ pages, active, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      data-no-swipe
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.15s ease' }}
    >
      <div role="dialog" aria-label="More pages" style={{
        width: '100%', background: 'var(--surface)', borderRadius: '22px 22px 0 0',
        padding: '10px 16px calc(96px + env(safe-area-inset-bottom, 0px))',
        boxShadow: 'var(--shadow-md)', animation: 'sheetUp 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-dark)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>More</span>
          <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div className="card">
          {pages.map(({ key, label, description, Icon, color, badge }, i) => {
            const isActive = active === key;
            return (
              <button key={key} id={`more-${key}`} onClick={() => onSelect(key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', textAlign: 'left',
                background: isActive ? 'var(--surface2)' : 'transparent', border: 'none',
                borderBottom: i < pages.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontFamily: 'inherit', borderRadius: 0,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Icon size={17} style={{ color }} />
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 99, background: 'var(--expense)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? color : 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
          <MoveHorizontal size={14} />
          Tip: swipe left or right anywhere to move between pages.
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes sheetUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}
