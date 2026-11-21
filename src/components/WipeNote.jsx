// ─── "Some settings were reset" — shown once (utils/wipeNote.js) ──
import { useState } from 'react';
import { X } from 'lucide-react';
import { useShell } from '../app/shellContext';
import { wipeNoteDue } from '../utils/wipeNote';
import { toKey } from '../utils/recurring';
import { t as tr } from '../i18n';

const DEVICE_KEY = 'et_wipe_note_done';
const deviceDone = () => { try { return localStorage.getItem(DEVICE_KEY) === '1'; } catch { return false; } };

export default function WipeNote({ settings, entryCount, onPatchSettings }) {
  const shell = useShell();
  const [gone, setGone] = useState(deviceDone);
  if (gone || !shell?.settingsLoaded || !onPatchSettings || shell?.user?.isDemo) return null;
  if (!wipeNoteDue(settings, entryCount, toKey(new Date()))) return null;

  const done = (go) => {
    try { localStorage.setItem(DEVICE_KEY, '1'); } catch { /* storage unavailable */ }
    setGone(true);
    onPatchSettings({ wipeNote: { done: true, at: Date.now() } });
    if (go) shell?.goTo?.(go);
  };
  const pill = (primary) => ({ padding: '7px 13px', border: 'none', borderRadius: 10, background: primary ? 'var(--accent)' : 'var(--surface2)', color: primary ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });

  return (
    <div className="card wipe-note" id="wipe-note" role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 12px 14px 16px', marginBottom: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tr('Some of your settings were reset')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
          {tr('A bug on 21 Nov could reset settings when the app opened — it’s fixed. Your entries are safe. Please check your budget, goals, accounts and layout, and set anything that’s missing again.')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button id="wipe-note-accounts" onClick={() => done('accounts')} style={pill(true)}>{tr('Accounts')}</button>
          <button id="wipe-note-budget" onClick={() => done('budget')} style={pill(false)}>{tr('Budget')}</button>
          <button id="wipe-note-ok" onClick={() => done(null)} style={pill(false)}>{tr('Got it')}</button>
        </div>
      </div>
      <button id="wipe-note-close" onClick={() => done(null)} aria-label={tr('Close')} className="lg-close"
        style={{ width: 28, height: 28, flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <X size={15} />
      </button>
    </div>
  );
}
