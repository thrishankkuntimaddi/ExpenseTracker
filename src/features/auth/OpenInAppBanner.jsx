// On the website, on an Android phone, with a trip invite: "Open in the app".
// The intent link opens the installed app; without the app, Android stays on
// (falls back to) this website — so it's always safe to tap.
import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { isAndroidBrowser, openInAppUrl } from '../../native/deepLinks';
import { t as tr } from '../../i18n';

export default function OpenInAppBanner({ tripId }) {
  const [hidden, setHidden] = useState(false);
  if (!tripId || hidden || !isAndroidBrowser()) return null;
  return (
    <div id="open-in-app" role="region" aria-label={tr('Open in the app')}
      style={{ position: 'fixed', left: 12, right: 12, top: 'calc(10px + env(safe-area-inset-top, 0px))', zIndex: 3000, maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
      <Smartphone size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 650, color: 'var(--text)', lineHeight: 1.35 }}>{tr('Have the Expense Tracker app? Open this invite there.')}</span>
      <a href={openInAppUrl(tripId)} style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 750, textDecoration: 'none', flexShrink: 0 }}>{tr('Open app')}</a>
      <button type="button" aria-label={tr('Close')} onClick={() => setHidden(true)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
    </div>
  );
}
