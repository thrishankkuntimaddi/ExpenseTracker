// ─── Settings building blocks ────────────────────────────────────
// A titled section card, and the collapsible groups inside it.
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/* A titled card holding several settings groups, iOS-style. */
export function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <p className="section-label" style={{ padding: '0 6px' }}>{title}</p>
      <div className="card settings-section">{children}</div>
    </section>
  );
}

/* A settings group that collapses to one summary line; open/closed is
   remembered on this device. `color` tints its icon tile. */
export function Group({ id, title, Icon, summary, color = 'var(--accent)', children }) {
  const key = `et_settings_open_${id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const toggle = () => setOpen((o) => { try { localStorage.setItem(key, o ? '0' : '1'); } catch { /* storage unavailable */ } return !o; });
  return (
    <div className="settings-group" id={`group-${id}`}>
      <button onClick={toggle} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          {!open && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>}
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}
