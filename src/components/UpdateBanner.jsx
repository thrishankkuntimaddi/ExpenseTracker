// A small, dismissible note about updates: "Updated to vX", "Update ready —
// Restart" (desktop), "Downloaded — applies next launch" (Android), or
// "Install the new app" when a bundle needs newer native code.
import { useEffect } from 'react';
import { Sparkles, Download, RotateCcw, X } from 'lucide-react';
import { useUpdateState, dismissUpdateNote, restartToUpdate, APK_URL } from '../native/updates';
import { platform } from '../native';

export default function UpdateBanner() {
  const u = useUpdateState();
  const show = ['updated', 'ready', 'native-needed'].includes(u.kind) && u.message;
  useEffect(() => {
    if (u.kind !== 'updated') return undefined;
    const t = setTimeout(dismissUpdateNote, 5000);
    return () => clearTimeout(t);
  }, [u.kind]);
  if (!show) return null;
  const action = u.kind === 'ready' && platform === 'desktop'
    ? { label: 'Restart', Icon: RotateCcw, onClick: restartToUpdate }
    : u.kind === 'native-needed'
      ? { label: 'Install', Icon: Download, onClick: () => window.open(APK_URL, '_blank') }
      : null;
  return (
    <div role="status" id="update-banner" style={{
      position: 'fixed', left: 16, right: 16, top: 'calc(10px + env(safe-area-inset-top, 0px))', zIndex: 1100,
      maxWidth: 460, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--accent-border)', boxShadow: 'var(--shadow-md)',
      fontSize: 12, color: 'var(--text)', animation: 'fadeIn .2s ease',
    }}>
      <Sparkles size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ flex: 1, lineHeight: 1.45 }}>{u.message}</span>
      {action && (
        <button onClick={action.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <action.Icon size={13} /> {action.label}
        </button>
      )}
      <button onClick={dismissUpdateNote} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  );
}
