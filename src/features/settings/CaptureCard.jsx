// ─── Profile → Auto-capture payments (Android, Play Store build) ──
// Payments seen on this phone wait on Home for one tap. One main switch,
// then two sources, each with its own Android permission:
//   • UPI apps' notifications (Google Pay, PhonePe…) — "Notification access"
//   • Bank SMS — the SMS permission (asked in a normal Android prompt)
import { useState } from 'react';
import { ScanLine, ShieldCheck, ExternalLink, Bell, MessageSquare, Check } from 'lucide-react';
import { captureSupported, captureUsable, setCaptureEnabled, setSmsCapture, openCaptureSettings, openAppSettings } from '../../native/paymentCapture';
import { useCaptureStatus } from './captureStatus';
import { CardFrame } from './SettingsGroup';
import { t as tr } from '../../i18n';

const pill = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };
const okText = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--income)', flexShrink: 0 };

function SourceRow({ id, Icon, title, sub, children }) {
  return (
    <div id={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' }}>
      <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function CaptureCard({ bare = false, status, onStatus }) {
  const [own, setOwn] = useCaptureStatus();
  const [smsDenied, setSmsDenied] = useState(false);
  const s = status ?? own;
  const setS = onStatus ?? setOwn;
  if (!captureSupported || !captureUsable(s)) return null;

  async function toggle() {
    let next = await setCaptureEnabled(!s.enabled);
    // Turning on: bank SMS first (a simple Android prompt), notification access is a button below
    if (next.enabled && next.smsAvailable && !next.sms) {
      next = await setSmsCapture(true);
      setSmsDenied(!!next.denied);
    }
    setS(next);
    if (next.enabled && !next.allowed && !next.smsAvailable) openCaptureSettings();
  }

  async function toggleSms() {
    const next = await setSmsCapture(!s.sms);
    setSmsDenied(!!next.denied);
    setS(next);
  }

  return (
    <CardFrame bare={bare} id="group-capture" title={tr('Auto-capture payments')}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ScanLine size={16} style={{ color: '#fff' }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tr('Catch UPI and bank payments')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.45 }}>{tr('Google Pay, PhonePe, Paytm, BHIM, CRED and bank SMS — each payment waits on Home for one tap.')}</div>
          </div>
          <button id="capture-toggle" className={`toggle-track ${s.enabled ? 'on' : ''}`} aria-label={tr('Catch UPI and bank payments')} aria-pressed={s.enabled} onClick={toggle} style={{ flexShrink: 0 }}>
            <span className="toggle-thumb" />
          </button>
        </div>

        {s.enabled && (
          <div style={{ display: 'grid', gap: 8 }}>
            <SourceRow id="capture-notifications" Icon={Bell} title={tr('UPI app notifications')} sub={tr('Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay')}>
              {s.allowed
                ? <span style={okText}><Check size={13} /> {tr('On')}</span>
                : <button onClick={openCaptureSettings} style={pill}><ExternalLink size={12} /> {tr('Allow')}</button>}
            </SourceRow>
            {s.smsAvailable && (
              <SourceRow id="capture-sms" Icon={MessageSquare} title={tr('Bank SMS')} sub={tr('Debit and credit messages from your banks — personal messages are never read')}>
                <button className={`toggle-track ${s.sms ? 'on' : ''}`} aria-label={tr('Bank SMS')} aria-pressed={!!s.sms} onClick={toggleSms} style={{ flexShrink: 0 }}>
                  <span className="toggle-thumb" />
                </button>
              </SourceRow>
            )}
            {smsDenied && !s.sms && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--expense-bg)', border: '1px solid var(--expense-border)', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, display: 'grid', gap: 8 }}>
                <span>{tr('SMS wasn’t allowed. To use bank SMS, allow SMS for Expense Tracker in Android settings → Permissions.')}</span>
                <button onClick={openAppSettings} style={{ ...pill, justifySelf: 'start' }}><ExternalLink size={12} /> {tr('Open settings')}</button>
              </div>
            )}
            {!s.allowed && !s.sms && (
              <div style={{ fontSize: 12, color: 'var(--lent)', fontWeight: 600 }}>{tr('Allow at least one of these to start catching payments.')}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{tr('Read on this phone only. Other apps’ notifications and messages from people are ignored, OTPs and requests are skipped, and nothing is saved to your account until you tap Add. Turning this off forgets everything it saw.')}</span>
        </div>
      </div>
    </CardFrame>
  );
}
