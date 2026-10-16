// ─── Security banners (on every page of an unlocked device) ──────
//   • another of your devices is asking to be unlocked → Approve / Deny
//   • someone typed wrong PINs on one of your devices, turned app lock off,
//     or signed in on a new device → Lock it / Sign it out / It was me —
//     also shown once as a system notification where possible.
// An alert is answered once for the whole account: whichever device
// answers it, it's gone everywhere (and doesn't come back on new sign-ins).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert, Smartphone, Lock, LogOut, Check, X } from 'lucide-react';
import { dismissSecurityEvent, isEventHandled } from '../services/firestore';
import { background } from '../services/sync';
import { eventText } from './events';
import { notifyNow } from '../native/reminders';
import { play } from '../sound/sound';

const ALERT_TYPES = ['wrong_pins', 'locked_out', 'lock_off', 'new_device'];
const NOTIFIED_KEY = 'et_alerts_notified';   // system notifications already shown on this device
const readNotified = () => { try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')); } catch { return new Set(); } };
const REQUEST_TTL = 2 * 60 * 1000;

export default function SecurityBanners({ uid, devices, events }) {
  const thisId = devices?.thisId;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  // Unlock requests from your other devices (fresh, unanswered)
  const requests = useMemo(() => (devices?.devices ?? []).filter((d) =>
    d.id !== thisId && d.unlockRequest?.nonce && now - d.unlockRequest.at < REQUEST_TTL && d.unlockApproval?.nonce !== d.unlockRequest.nonce), [devices?.devices, thisId, now]);

  // Unanswered alerts from another device, from the last day
  const alerts = useMemo(() => events.filter((e) => ALERT_TYPES.includes(e.type) && e.deviceId !== thisId && !isEventHandled(e) && now - e.at < 86400e3), [events, thisId, now]);
  // A system notification once per alert per device — not again on every launch
  const notified = useRef(null);
  useEffect(() => {
    if (!notified.current) notified.current = readNotified();
    const fresh = alerts.filter((e) => !notified.current.has(e.id));
    if (!fresh.length) return;
    play('banner');
    fresh.forEach((e) => {
      notified.current.add(e.id);
      const t = eventText(e);
      notifyNow({ id: e.id, title: `Expense Tracker: ${t.title}`, body: `${t.sub}. Open the app to lock or sign out that device.` });
    });
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified.current].slice(-60))); } catch { /* storage unavailable */ }
  }, [alerts]);

  if (!requests.length && !alerts.length) return null;
  const seen = (e) => background(dismissSecurityEvent(uid, e.id, devices?.devices?.find((d) => d.id === thisId)?.name));
  const source = (e) => (devices?.devices ?? []).find((d) => d.id === e.deviceId);

  return (
    <div className="security-banners" style={{ position: 'fixed', left: 12, right: 12, top: 'calc(10px + env(safe-area-inset-top, 0px))', zIndex: 1200, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {requests.map((d) => (
        <div key={d.id} id={`unlock-request-${d.id}`} role="alertdialog" className="card" style={banner}>
          <Smartphone size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>Unlock {d.unlockRequest.name || d.name}?</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>It’s asking to open now. Only approve if it’s you.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button id={`unlock-approve-${d.id}`} onClick={() => devices.answerUnlock(d.id, d.unlockRequest.nonce, true)} style={btn('income')}><Check size={13} /> Approve</button>
              <button id={`unlock-deny-${d.id}`} onClick={() => devices.answerUnlock(d.id, d.unlockRequest.nonce, false)} style={btn(null)}><X size={13} /> Deny</button>
            </div>
          </div>
        </div>
      ))}
      {alerts.slice(0, 2).map((e) => {
        const t = eventText(e);
        const dev = source(e);
        return (
          <div key={e.id} id={`security-alert-${e.id}`} role="alert" className="card" style={{ ...banner, borderColor: 'var(--expense-border, var(--border))' }}>
            <ShieldAlert size={18} style={{ color: 'var(--expense)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{t.sub} · {new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Not you?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {dev && !['lock_off', 'new_device'].includes(e.type) && <button onClick={() => { devices.command(dev.id, 'lock'); seen(e); }} style={btn('accent')}><Lock size={13} /> Lock it</button>}
                {dev && <button onClick={() => { devices.command(dev.id, 'signout'); seen(e); }} style={btn('expense')}><LogOut size={13} /> Sign it out</button>}
                <button onClick={() => seen(e)} style={btn(null)}>It was me</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const banner = { display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 16, boxShadow: '0 12px 32px -12px rgba(0,0,0,.45)', border: '1px solid var(--border)', animation: 'toastIn .22s cubic-bezier(0.16,1,0.3,1)' };
const btn = (tone) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer',
  border: tone ? 'none' : '1.5px solid var(--border)', background: tone ? `var(--${tone})` : 'transparent', color: tone ? 'var(--on-accent, #fff)' : 'var(--text-secondary)',
});
