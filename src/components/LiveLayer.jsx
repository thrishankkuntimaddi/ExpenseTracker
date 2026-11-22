// ─── What the owner says to every app (services/liveConfig) ──────
// <LiveBanners/> — notes on Home (info / heads-up / new), each dismissed for
// good on this device. <LiveGate/> — a full screen while the app is under
// maintenance, or when this version is older than the minimum: everything
// else waits behind it. The owner is never locked out.
import { useEffect, useState } from 'react';
import { Info, AlertTriangle, Sparkles, X, Wrench, Download, RotateCcw } from 'lucide-react';
import { subscribeLive, liveBanners, liveGate } from '../services/liveConfig';
import { platform } from '../native';
import { THIS_VERSION, checkForUpdates, restartToUpdate, APK_URL } from '../native/updates';
import { t as tr } from '../i18n';

const KEY = 'et_live_dismissed';
const readDismissed = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

/** The live config, shared: one listener for the banners and the gate. */
let shared = null; const subs = new Set(); let stop = null;
function useLive(enabled) {
  const [cfg, setCfg] = useState(shared);
  useEffect(() => {
    if (!enabled) return undefined;
    subs.add(setCfg);
    if (!stop) stop = subscribeLive((c) => { shared = c; subs.forEach((f) => f(c)); });
    return () => { subs.delete(setCfg); if (!subs.size && stop) { stop(); stop = null; } };
  }, [enabled]);
  return cfg;
}

const TONES = {
  info: { Icon: Info, color: 'var(--accent)', bg: 'var(--accent-bg)' },
  warn: { Icon: AlertTriangle, color: 'var(--lent)', bg: 'var(--lent-bg)' },
  new:  { Icon: Sparkles, color: 'var(--income)', bg: 'var(--income-bg)' },
};

export function LiveBanners({ enabled = true }) {
  const cfg = useLive(enabled);
  const [dismissed, setDismissed] = useState(readDismissed);
  const list = liveBanners(cfg, { platform, dismissed });
  if (!list.length) return null;
  const dismiss = (id) => {
    const next = [...new Set([...dismissed, id])].slice(-40);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    setDismissed(next);
  };
  return (
    <div id="live-banners" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
      {list.map((b) => {
        const t = TONES[b.tone] ?? TONES.info;
        return (
          <div key={b.id} id={`live-banner-${b.id}`} role="note" className="card live-banner"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', borderLeft: `3px solid ${t.color}` }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><t.Icon size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {b.text}
              {b.link && /^https?:\/\//.test(b.link) && <> <a href={b.link} target="_blank" rel="noreferrer" style={{ color: t.color, fontWeight: 700 }}>{b.linkLabel || tr('Open')}</a></>}
            </span>
            {b.dismissible !== false && (
              <button type="button" aria-label={tr('Dismiss')} onClick={() => dismiss(b.id)} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}><X size={15} /></button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LiveGate({ enabled = true, admin = false, children }) {
  const cfg = useLive(enabled);
  const gate = liveGate(cfg, { version: THIS_VERSION, admin });
  const [busy, setBusy] = useState(false);
  if (!gate) return children ?? null;
  const update = async () => {
    setBusy(true);
    try {
      if (platform === 'web') { window.location.reload(); return; }
      const s = await checkForUpdates();
      if (s?.kind === 'ready') await restartToUpdate();
      else if (s?.installUrl || platform === 'android') window.open(s?.installUrl ?? APK_URL, '_blank');
    } finally { setBusy(false); }
  };
  const m = cfg.maintenance ?? {};
  return (
    <div id={`live-gate-${gate}`} role="alertdialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg, var(--surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', padding: 24, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', background: gate === 'update' ? 'var(--accent-bg)' : 'var(--lent-bg)', color: gate === 'update' ? 'var(--accent)' : 'var(--lent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {gate === 'update' ? <Download size={24} /> : <Wrench size={24} />}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{gate === 'update' ? tr('Please update the app') : tr('Back in a little while')}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '8px 0 16px', whiteSpace: 'pre-wrap' }}>
          {gate === 'update'
            ? (cfg.minMessage || `${tr('This version')} (${THIS_VERSION}) ${tr('is too old to keep your data safe. Update to')} ${cfg.minVersion} ${tr('or newer — your entries are waiting.')}`)
            : (m.message || tr('Expense Tracker is being improved right now. Your data is safe — try again in a few minutes.'))}
          {gate === 'maintenance' && m.until ? `\n${tr('Expected back by')} ${new Date(m.until).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}.` : ''}
        </p>
        <button type="button" id="live-gate-action" onClick={gate === 'update' ? update : () => window.location.reload()} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 20px', border: 'none', borderRadius: 99, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer' }}>
          {gate === 'update' ? <><Download size={15} /> {busy ? tr('Updating…') : tr('Update now')}</> : <><RotateCcw size={15} /> {tr('Try again')}</>}
        </button>
      </div>
    </div>
  );
}
