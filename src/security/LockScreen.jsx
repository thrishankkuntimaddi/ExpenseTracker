// ─── Lock screen ─────────────────────────────────────────────────
// Shown instead of the app while it's locked — none of your data is on
// screen or loading behind it. Ways in:
//   PIN (the account's; the keypad or the keyboard)
//   fingerprint / face / passkey, if set up on this device
//   "Unlock from another device" — an open, unlocked phone or computer of
//      yours approves it
//   "Forgot PIN?" — sign in again (Google or password), then set a new PIN
import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Smartphone, KeyRound, LogOut, Delete, Loader2, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { biometricEnrolled, biometricStatus } from './biometric';
import { pinProblem, PIN_MAX, PIN_MIN, waitLabel, ALERT_AT } from './pin';
import { reauthMethods, reauthWithGoogle, reauthWithPassword } from './reauth';
import { markAppReady } from '../app/ready';

import { t as tr } from '../i18n';
export default function LockScreen({ lock, user, onSignOut }) {
  const [chosen, setMode] = useState('pin');   // pin | forgot | newpin
  useEffect(() => { markAppReady(); }, []);
  // Signed in again → new PIN; too many tries → only "sign in again" is offered
  const mode = lock.reason === 'reset' ? 'newpin' : lock.needsSignIn && chosen === 'pin' ? 'forgot' : chosen;

  return (
    <div className="lock-root" role="dialog" aria-label={tr("Expense Tracker is locked")}
      style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))' }}>
      <div className="card" style={{ width: '100%', maxWidth: 360, padding: '24px 20px 18px', textAlign: 'center' }}>
        <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={48} height={48} style={{ borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }} />
        {mode === 'pin' && <PinEntry lock={lock} user={user} onForgot={() => setMode('forgot')} />}
        {mode === 'forgot' && <Forgot lock={lock} user={user} onBack={lock.needsSignIn ? null : () => setMode('pin')} onDone={() => { lock.afterReauth(); setMode('newpin'); }} />}
        {mode === 'newpin' && <NewPin lock={lock} />}
        <button id="lock-signout" onClick={() => onSignOut?.()} style={{ ...linkBtn, marginTop: 16, color: 'var(--text-muted)' }}>
          <LogOut size={13} /> {tr("Sign out instead")}
        </button>
      </div>
    </div>
  );
}

/* ── PIN pad ── */
function PinEntry({ lock, user, onForgot }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [bio, setBio] = useState(null);
  const length = lock.cfg?.length || PIN_MIN;
  const waiting = lock.wait > 0;
  const tried = useRef(false);

  const tryBio = useCallback(async () => {
    try { await lock.unlockWithBiometric(); } catch (err) { setMsg(err?.message || 'Fingerprint didn’t work — use your PIN.'); }
  }, [lock]);
  // Offer the fingerprint straight away when it's set up here
  useEffect(() => {
    if (!biometricEnrolled()) return;
    biometricStatus().then((s) => { setBio(s); if (s.available && !tried.current && lock.reason !== 'remote') { tried.current = true; tryBio(); } });
  }, [tryBio, lock.reason]);

  const submit = useCallback(async (value) => {
    setBusy(true);
    const r = await lock.unlockWithPin(value);
    setBusy(false);
    if (r.ok) return;
    setPin('');
    setShake(true); setTimeout(() => setShake(false), 400);
    if (r.needsSignIn) return;
    setMsg(r.fails >= ALERT_AT ? `Wrong PIN. ${r.fails} wrong tries — your other devices have been told.` : 'Wrong PIN.');
  }, [lock]);

  const press = useCallback((d) => {
    if (busy || waiting) return;
    setMsg(null);
    setPin((p) => {
      const next = (p + d).slice(0, PIN_MAX);
      // Auto-submit at the PIN's length (known from the account)
      if (next.length === length) setTimeout(() => submit(next), 60);
      return next;
    });
  }, [busy, waiting, length, submit]);
  const back = () => setPin((p) => p.slice(0, -1));

  // Hardware keyboards
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter' && pin.length >= PIN_MIN) submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, pin, submit]);

  return (
    <>
      <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '14px 0 2px' }}>
        {lock.reason === 'remote' ? tr("Locked from another device") : tr("Enter your PIN")}
      </h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{user?.email}</p>

      <div aria-live="polite" className={shake ? 'lock-shake' : undefined} style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '20px 0 10px' }}>
        {Array.from({ length: Math.max(length, pin.length) }, (_, i) => (
          <span key={i} style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--accent)', background: i < pin.length ? 'var(--accent)' : 'transparent', transition: 'background .12s' }} />
        ))}
      </div>
      <div id="lock-msg" role="alert" style={{ minHeight: 34, fontSize: 12, lineHeight: 1.4, color: waiting || msg ? 'var(--expense)' : 'var(--text-muted)' }}>
        {waiting ? <><ShieldAlert size={12} style={{ verticalAlign: -2 }} /> {tr("Too many wrong PINs. Try again in")} {waitLabel(lock.wait)}.</> : busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : msg}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 260, margin: '0 auto' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} id={`lock-key-${d}`} onClick={() => press(d)} disabled={waiting}>{d}</Key>)}
        {bio?.available ? <Key id="lock-bio" onClick={tryBio} label={bio.label}><Fingerprint size={22} /></Key> : <span />}
        <Key id="lock-key-0" onClick={() => press('0')} disabled={waiting}>0</Key>
        <Key id="lock-back" onClick={back} label={tr("Delete")}><Delete size={20} /></Key>
      </div>

      <RemoteUnlock lock={lock} />
      <div><button id="lock-forgot" onClick={onForgot} style={{ ...linkBtn, marginTop: 12 }}><KeyRound size={13} /> {tr("Forgot PIN?")}</button></div>
    </>
  );
}

function Key({ id, onClick, disabled, label, children }) {
  return (
    <button id={id} type="button" onClick={onClick} disabled={disabled} aria-label={label}
      style={{ height: 56, borderRadius: 18, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 22, fontWeight: 650, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}

/* ── Unlock from another device ── */
function RemoteUnlock({ lock }) {
  const r = lock.request;
  if (!r) {
    return (
      <button id="lock-remote" onClick={lock.requestUnlock} style={{ ...linkBtn, marginTop: 16 }}>
        <Smartphone size={13} /> {tr("Unlock from another device")}
      </button>
    );
  }
  return (
    <div id="lock-remote-status" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      {r.status === 'waiting' && <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite', verticalAlign: -2 }} /> {tr("Open Expense Tracker on your phone or computer and tap")} <strong>{tr("Approve")}</strong>.</>}
      {r.status === 'denied' && tr("The request was declined on your other device.")}
      {r.status === 'expired' && tr("No answer — make sure the app is open and unlocked on your other device.")}
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 14 }}>
        {r.status !== 'waiting' && <button onClick={lock.requestUnlock} style={linkBtn}>{tr("Ask again")}</button>}
        <button onClick={lock.cancelRequest} style={{ ...linkBtn, color: 'var(--text-muted)' }}>{tr("Cancel")}</button>
      </div>
    </div>
  );
}

/* ── Forgot PIN: sign in again ── */
function Forgot({ lock, user, onBack, onDone }) {
  const methods = reauthMethods(user);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setErr(null); setBusy(true);
    try { if (await fn()) onDone(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ textAlign: 'left' }}>
      {onBack && <button onClick={onBack} style={{ ...linkBtn, marginTop: 12 }}><ArrowLeft size={13} /> {tr("Back")}</button>}
      <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '12px 0 4px', textAlign: 'center' }}>
        {lock.needsSignIn ? tr("Sign in again to unlock") : tr("Forgot your PIN?")}
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.55, textAlign: 'center' }}>
        {lock.needsSignIn ? tr("Too many wrong PINs. ") : ''}{tr("Prove it’s you with your account, then choose a new PIN. Your data stays exactly as it is.")}
      </p>
      {err && <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, marginBottom: 10, background: 'var(--expense-bg)', color: 'var(--expense)', fontSize: 12 }}>{err}</div>}
      {methods.google && (
        <button id="lock-reauth-google" disabled={busy} onClick={() => run(reauthWithGoogle)} style={btn(true)}>{tr("Continue with Google")}</button>
      )}
      {methods.password && (
        <form onSubmit={(e) => { e.preventDefault(); if (password) run(() => reauthWithPassword(password)); }} style={{ marginTop: methods.google ? 12 : 0 }}>
          <input id="lock-reauth-password" type="password" autoComplete="current-password" placeholder={`Password for ${user?.email}`} value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
          <button type="submit" disabled={busy || !password} style={btn(!methods.google)}>{tr("Verify password")}</button>
        </form>
      )}
      {busy && <div style={{ textAlign: 'center', marginTop: 10 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>}
    </div>
  );
}

/* ── Choose a new PIN (after signing in again) ── */
function NewPin({ lock }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const p = pinProblem(a);
    if (p) { setErr(p); return; }
    if (a !== b) { setErr('The two PINs don’t match.'); return; }
    setBusy(true);
    try { await lock.setPin(a); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <form onSubmit={save} style={{ textAlign: 'left' }}>
      <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '14px 0 4px', textAlign: 'center' }}><CheckCircle2 size={17} style={{ color: 'var(--income)', verticalAlign: -2 }} /> {tr("It’s you")}</h1>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', textAlign: 'center' }}>{tr("Choose a new PIN. It works on all your devices.")}</p>
      <PinInput id="lock-new-pin" value={a} onChange={setA} placeholder={`New PIN (${PIN_MIN}–${PIN_MAX} digits)`} autoFocus />
      <PinInput id="lock-new-pin2" value={b} onChange={setB} placeholder={tr("Type it again")} />
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--expense)', margin: '2px 0 8px' }}>{err}</div>}
      <button id="lock-new-save" type="submit" disabled={busy || !a || !b} style={btn(true)}>{tr("Save PIN and unlock")}</button>
    </form>
  );
}

export function PinInput({ id, value, onChange, placeholder, autoFocus }) {
  return (
    <input id={id} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" maxLength={PIN_MAX} placeholder={placeholder} autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
      style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 18, letterSpacing: '0.3em', fontFamily: 'inherit', outline: 'none', marginBottom: 8, textAlign: 'center' }} />
  );
}

const linkBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const btn = (primary) => ({
  width: '100%', padding: '12px 14px', borderRadius: 12, border: primary ? 'none' : '1.5px solid var(--border)', fontSize: 14, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer',
  background: primary ? 'var(--accent)' : 'var(--surface2)', color: primary ? 'var(--on-accent, #fff)' : 'var(--text)',
});
