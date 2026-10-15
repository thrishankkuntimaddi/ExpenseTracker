// ─── Settings building blocks ────────────────────────────────────
// A titled section card, and the settings inside it.
//
// Inside Profile (SettingsNav present) every Group is a row — icon, title,
// one-line summary, chevron — and its content opens as a panel: beside the
// list on wide screens, in place of the list on phones (Back returns).
// The content is rendered through a portal into the panel, so it stays one
// component tree: its state, dialogs and file pickers keep working.
// Without SettingsNav a Group is the old collapsible accordion.
import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { SettingsNav } from './settingsNav';

/* A titled card holding several settings groups, iOS-style. */
export function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <p className="section-label" style={{ padding: '0 6px' }}>{title}</p>
      <div className="card settings-section">{children}</div>
    </section>
  );
}

function RowHeader({ title, Icon, summary, color, chevron = true, rotate = false }) {
  return (
    <>
      <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color: '#fff' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {summary != null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>}
      </div>
      {chevron && <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: rotate ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />}
    </>
  );
}

const rowStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };

/* One setting. `color` tints its icon tile. */
export function Group({ id, title, Icon, summary, color = 'var(--accent)', children }) {
  const nav = useContext(SettingsNav);
  if (nav) return <NavGroup nav={nav} id={id} title={title} Icon={Icon} summary={summary} color={color}>{children}</NavGroup>;
  return <Accordion id={id} title={title} Icon={Icon} summary={summary} color={color}>{children}</Accordion>;
}

function NavGroup({ nav, id, title, Icon, summary, color, children }) {
  const active = nav.active === id;
  const { announce } = nav;
  useEffect(() => { if (active) announce({ id, title, summary }); }, [active, id, title, summary, announce]);
  return (
    <div className={`settings-group${active ? ' is-active' : ''}`} id={`group-${id}`}>
      <button onClick={() => nav.open(id)} aria-current={active ? 'true' : undefined} className="settings-row-btn" style={rowStyle}>
        <RowHeader title={title} Icon={Icon} summary={summary} color={color} />
      </button>
      {active && nav.panelEl && createPortal(
        <div className="settings-panel" id={`panel-${id}`}>
          <div className="settings-panel-head">
            <div className="settings-icon" style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} style={{ color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
              {summary != null && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{summary}</div>}
            </div>
          </div>
          <div className="card settings-panel-body">{children}</div>
        </div>,
        nav.panelEl,
      )}
    </div>
  );
}

/* Collapses to one summary line; open/closed is remembered on this device. */
function Accordion({ id, title, Icon, summary, color, children }) {
  const key = `et_settings_open_${id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const toggle = () => setOpen((o) => { try { localStorage.setItem(key, o ? '0' : '1'); } catch { /* storage unavailable */ } return !o; });
  return (
    <div className="settings-group" id={`group-${id}`}>
      <button onClick={toggle} aria-expanded={open} style={rowStyle}>
        <RowHeader title={title} Icon={Icon} summary={open ? null : summary} color={color} rotate={open} />
      </button>
      {open && <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

/* A standalone settings card — or, `bare`, just its padded content (inside a panel). */
export function CardFrame({ bare, id, title, children }) {
  if (bare) return <div style={{ padding: '14px 16px' }}>{children}</div>;
  return (
    <section id={id} style={{ marginBottom: 18, scrollMarginTop: 12 }}>
      <p className="section-label" style={{ padding: '0 6px' }}>{title}</p>
      <div className="card" style={{ padding: '14px 16px' }}>{children}</div>
    </section>
  );
}
