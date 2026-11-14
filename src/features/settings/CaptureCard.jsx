// ─── Profile → Auto-capture payments (Android, Play Store build) ──
// Payments seen on this phone wait on Home for one tap. One main switch,
// then two sources, each with its own Android permission:
//   • UPI apps' notifications (Google Pay, PhonePe…) — "Notification access"
//   • Bank SMS — the SMS permission (asked in a normal Android prompt)
import { useState } from 'react';
import { ScanLine, ShieldCheck, ExternalLink, Bell, MessageSquare, Check, Smartphone, EyeOff, Trash2 } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
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


/* Prominent disclosure (Google Play: SMS / notification access). Shown every
   time, right before Android's SMS prompt or the Notification access screen —
   never after — so the person knows exactly what is read and why. */
const DISCLOSE = {
  sms: {
    title: 'Allow reading bank SMS?',
    what: 'Expense Tracker reads incoming SMS from banks and card companies to find debit and credit messages — the amount, the merchant or person, and the last digits of the account.',
  },
  notif: {
    title: 'Allow reading payment notifications?',
    what: 'Expense Tracker reads notifications from payment and banking apps only (Google Pay, PhonePe, Paytm, BHIM, CRED, MobiKwik and bank apps) to find payments — the amount and who it was paid to or received from.',
  },
};
function CaptureConsent({ kind, onAgree, onCancel }) {
  const d = DISCLOSE[kind];
  const point = (Icon, text) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-secondary)' }} /><span>{tr(text)}</span>
    </div>
  );
  return (
    <ModalShell title={d.title} subtitle="Auto-capture payments" onClose={onCancel} maxWidth={440}
      footer={<><GhostButton onClick={onCancel}>Not now</GhostButton><PrimaryButton onClick={onAgree}>Agree and continue</PrimaryButton></>}>
      <div id={`capture-consent-${kind}`} style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>{tr(d.what)}</p>
        {point(Smartphone, 'It is read on this phone only, to show each payment on Home as “Add this payment?”. Nothing is uploaded, saved to your account or shared with anyone unless you tap Add.')}
        {point(EyeOff, 'Messages from people, chats, OTPs and other apps are ignored and never stored.')}
        {point(Trash2, 'Turn it off at any time in Profile → Auto-capture payments; everything it saw is forgotten.')}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tr('Next, Android will ask for permission. See the privacy policy for details.')}</p>
      </div>
    </ModalShell>
  );
}

export default function CaptureCard({ bare = false, status, onStatus }) {
  const [own, setOwn] = useCaptureStatus();
  const [smsDenied, setSmsDenied] = useState(false);
  const [asking, setAsking] = useState(null);     // { kind: 'sms' | 'notif', then }
  const s = status ?? own;
  const setS = onStatus ?? setOwn;
  if (!captureSupported || !captureUsable(s)) return null;

  const disclose = (kind, then) => setAsking({ kind, then });

  async function turnOn() {
    let next = await setCaptureEnabled(true);
    // Turning on: bank SMS first (a simple Android prompt), notification access is a button below
    if (next.smsAvailable && !next.sms) {
      next = await setSmsCapture(true);
      setSmsDenied(!!next.denied);
    }
    setS(next);
    if (!next.allowed && !next.smsAvailable) openCaptureSettings();
  }

  async function toggle() {
    if (s.enabled) { setS(await setCaptureEnabled(false)); return; }
    // The disclosure always comes before the permission it explains
    disclose(s.smsAvailable && !s.sms ? 'sms' : 'notif', turnOn);
  }

  async function smsOn() {
    const next = await setSmsCapture(true);
    setSmsDenied(!!next.denied);
    setS(next);
  }

  async function toggleSms() {
    if (s.sms) { const next = await setSmsCapture(false); setSmsDenied(false); setS(next); return; }
    disclose('sms', smsOn);
  }

  const allowNotifications = () => disclose('notif', openCaptureSettings);

  return (
    <CardFrame bare={bare} id="group-capture" title={tr('Auto-capture payments')}>
      {asking && (
        <CaptureConsent kind={asking.kind}
          onCancel={() => setAsking(null)}
          onAgree={() => { const then = asking.then; setAsking(null); then(); }} />
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ScanLine size={16} style={{ color: '#fff' }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tr('Catch UPI and bank payments')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.45 }}>{tr('Payment and bank app notifications and bank SMS — each payment waits on Home for one tap.')}</div>
          </div>
          <button id="capture-toggle" className={`toggle-track ${s.enabled ? 'on' : ''}`} aria-label={tr('Catch UPI and bank payments')} aria-pressed={s.enabled} onClick={toggle} style={{ flexShrink: 0 }}>
            <span className="toggle-thumb" />
          </button>
        </div>

        {s.enabled && (
          <div style={{ display: 'grid', gap: 8 }}>
            <SourceRow id="capture-notifications" Icon={Bell} title={tr('UPI app notifications')} sub={tr('Google Pay, PhonePe, Paytm, BHIM, CRED, MobiKwik and bank apps')}>
              {s.allowed
                ? <span style={okText}><Check size={13} /> {tr('On')}</span>
                : <button id="capture-allow-notifications" onClick={allowNotifications} style={pill}><ExternalLink size={12} /> {tr('Allow')}</button>}
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
