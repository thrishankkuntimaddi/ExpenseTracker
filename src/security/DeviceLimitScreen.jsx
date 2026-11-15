// ─── Too many devices ────────────────────────────────────────────
// An account works on at most 3 devices at once (hooks/useDevices). A 4th
// sees this instead of the app: sign one of the others out, or sign out here.
// Signing a device out takes it off the list at once, so this screen gives
// way to the app as soon as one is chosen.
import { useState } from 'react';
import { Laptop, Smartphone, Globe, LogOut, ShieldAlert } from 'lucide-react';
import { MAX_DEVICES, isLive } from '../hooks/useDevices';
import { timeAgo } from '../services/sync';
import { t as tr } from '../i18n';

const KIND_ICON = { android: Smartphone, ios: Smartphone, desktop: Laptop, web: Globe };

export default function DeviceLimitScreen({ devices, onSignOutHere }) {
  const [busy, setBusy] = useState(null);
  const others = (devices.devices ?? []).filter((d) => d.id !== devices.thisId)
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  const signOut = (d) => { setBusy(d.id); devices.command(d.id, 'signout'); };

  return (
    <div id="device-limit" role="alertdialog" aria-modal="true" aria-label={tr('Too many devices')}
      style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 22, borderRadius: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--lent-bg)', color: 'var(--lent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <ShieldAlert size={22} />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{tr(`Signed in on ${MAX_DEVICES} devices already`)}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '6px 0 16px' }}>
          {tr(`To keep your account safe, it works on up to ${MAX_DEVICES} devices at a time. Sign one of these out to use this one — its data stays safe in your account.`)}
        </p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {others.map((d, i) => {
            const Icon = KIND_ICON[d.platform] ?? Globe;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <Icon size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name || tr('Unknown device')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isLive(d) ? tr('On screen now') : d.lastSeen ? `${tr('Last seen')} ${timeAgo(d.lastSeen)}` : tr('Not seen yet')}</div>
                </div>
                <button type="button" id={`limit-signout-${d.id}`} disabled={!!busy} onClick={() => signOut(d)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 11px', borderRadius: 10, border: '1px solid var(--expense-border)', background: 'var(--expense-bg)', color: 'var(--expense)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== d.id ? 0.5 : 1 }}>
                  <LogOut size={12} /> {busy === d.id ? tr('Signing out…') : tr('Sign out')}
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" id="limit-signout-here" onClick={onSignOutHere}
          style={{ width: '100%', marginTop: 14, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          {tr('Sign out of this device instead')}
        </button>
      </div>
    </div>
  );
}
