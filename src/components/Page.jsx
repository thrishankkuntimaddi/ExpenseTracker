// ─── Page building blocks ────────────────────────────────────────
// One header and one section style for every phone page, so the app reads
// as a single product: back arrow (pages opened from Home), title and
// subtitle, actions, then the profile avatar.
import BackButton from './BackButton';
import ProfileButton from './ProfileButton';

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="tab-header page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BackButton />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 750, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>}
        </div>
        {actions}
        <ProfileButton />
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/* A compact pill action for page headers ("+ Add", "Edit") */
export function HeaderAction({ id, Icon, label, onClick }) {
  return (
    <button id={id} onClick={onClick} className="header-action"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: 'none', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
      {Icon && <Icon size={14} />}{label}
    </button>
  );
}

export function SectionHeading({ id, title, hint, action }) {
  return (
    <div id={id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '20px 4px 8px', scrollMarginTop: 12 }}>
      <div style={{ minWidth: 0 }}>
        <span className="section-label" style={{ margin: 0 }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{hint}</span>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({ id, children, onClick }) {
  return (
    <button id={id} onClick={onClick}
      style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
      {children}
    </button>
  );
}

/* Empty state inside a card: icon, one line of value, one clear action */
export function EmptyState({ Icon, title, text, action, tone = 'accent' }) {
  return (
    <div className="card" style={{ padding: '22px 18px', textAlign: 'center' }}>
      <span style={{ width: 46, height: 46, borderRadius: 15, background: `var(--${tone}-bg)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} style={{ color: `var(--${tone})` }} />
      </span>
      <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', marginTop: 10 }}>{title}</div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '4px auto 0', maxWidth: 300 }}>{text}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function PrimaryPill({ id, Icon, children, onClick, tone = 'accent' }) {
  return (
    <button id={id} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: `var(--${tone})`, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}
