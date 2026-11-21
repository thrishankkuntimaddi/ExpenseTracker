// ─── "New looks" note on Home ────────────────────────────────────
// Tells people about Unslop and Unsloped (Profile → Appearance → Look).
// People told us a note that comes back on every open is a nuisance, so
// this one is shown on ONE app open per account — counted in the synced
// settings (settings.looksIntro), so a second phone doesn't start over, and
// marked on the device too — and never again once they try a look, open
// Appearance from it, close it, or are already on one.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLook, setLook } from '../utils/unslop';
import { useShell } from '../app/shellContext';
import { t as tr } from '../i18n';
import { looksIntroDue } from '../utils/looksIntro';

const SESSION_KEY = 'et_looks_intro_open';   // this app open: 'seen' (counted) or 'closed'

const sessionGet = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } };
const sessionSet = (v) => { try { sessionStorage.setItem(SESSION_KEY, v); } catch { /* storage unavailable */ } };
const DEVICE_KEY = 'et_looks_intro_done';    // shown on this device once: never again here
const deviceDone = () => { try { return localStorage.getItem(DEVICE_KEY) === '1'; } catch { return false; } };
const markDevice = () => { try { localStorage.setItem(DEVICE_KEY, '1'); } catch { /* storage unavailable */ } };

export default function LooksIntro({ user, settings, onPatchSettings }) {
  const look = useLook();
  const shell = useShell();
  const record = settings?.looksIntro;
  const ready = !!settings && !!user && !user.isDemo && !!onPatchSettings;
  const [closed, setClosed] = useState(() => sessionGet() === 'closed');

  // Already on Unslop / Unsloped: they've found it — never show the note
  useEffect(() => {
    if (ready && look !== 'glass' && !record?.done) onPatchSettings((cur) => ({ looksIntro: { ...cur?.looksIntro, done: true } }));
  }, [ready, look]); // eslint-disable-line react-hooks/exhaustive-deps

  const [shownBefore] = useState(deviceDone);   // read once: this open still shows it after marking
  const due = ready && !shownBefore && looksIntroDue(record, look);
  // Count this app open once, the first time the note is actually shown
  // (the session mark also keeps React's double-run in dev from counting twice)
  useEffect(() => {
    if (!due || sessionGet()) return;
    sessionSet('seen');
    markDevice();
    onPatchSettings((cur) => ({ looksIntro: { ...cur?.looksIntro, seen: (Number(cur?.looksIntro?.seen) || 0) + 1, at: Date.now() } }));
  }, [due]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once counted the synced `seen` is at the limit: `shownBefore` (read when Home
  // opened) keeps it up for this view only — the next time Home opens it's gone
  const visible = ready && !closed && !shownBefore && look === 'glass' && !record?.done && (due || sessionGet() === 'seen');
  if (!visible) return null;

  const finish = () => onPatchSettings((cur) => ({ looksIntro: { ...cur?.looksIntro, done: true } }));
  const tryIt = () => { finish(); setLook('unsloped'); };
  const seeLooks = () => { finish(); shell?.goTo?.('profile', { openGroup: 'appearance' }); };
  const close = () => { sessionSet('closed'); setClosed(true); finish(); };

  return (
    <div className="card looks-intro" id="looks-intro" role="status" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 12px 14px 14px', marginBottom: 14 }}>
      {/* a little khata cover: what Unsloped looks like */}
      <span aria-hidden className="looks-intro-book" style={{
        width: 40, height: 52, flexShrink: 0, borderRadius: '3px 7px 7px 3px', position: 'relative',
        background: 'linear-gradient(155deg, #8A2523, #651719)', boxShadow: '0 6px 14px -8px rgba(20,10,5,.6)',
      }}>
        <span style={{ position: 'absolute', inset: '5px 5px 5px 9px', border: '2px double rgba(221,184,102,.75)', borderRadius: 3 }} />
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'rgba(0,0,0,.25)', borderRadius: '3px 0 0 3px' }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tr('Two new looks for your money diary')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
          {tr('Unslop and Unsloped turn the app into a hisaab notebook — paper, ink and a red khata cover. Switch back any time in Profile → Appearance.')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button id="looks-intro-try" onClick={tryIt}
            style={{ padding: '7px 13px', border: 'none', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            {tr('Try Unsloped')}
          </button>
          <button id="looks-intro-see" onClick={seeLooks}
            style={{ padding: '7px 13px', border: 'none', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            {tr('See all looks')}
          </button>
        </div>
      </div>
      <button id="looks-intro-close" onClick={close} aria-label={tr('Close')} className="lg-close"
        style={{ alignSelf: 'flex-start', width: 28, height: 28, flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <X size={15} />
      </button>
    </div>
  );
}
