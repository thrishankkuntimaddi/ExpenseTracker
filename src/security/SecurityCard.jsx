// ─── Profile → Security ──────────────────────────────────────────
// App lock (one PIN for all your devices, fingerprint/passkey per device,
// when to lock), every device signed in to the account — which are Live on
// screen right now, which are locked — with Lock / Sign out for each, and
// the recent security alerts.
import { useEffect, useState } from 'react';
import { Lock, LockOpen, Fingerprint, Laptop, Smartphone, Globe, LogOut, X, ShieldCheck, ShieldAlert, Timer, KeyRound, Bell } from 'lucide-react';
import { useAppLockContext } from './useAppLock';
import { LOCK_AFTER, DEFAULT_LOCK_AFTER, pinProblem, PIN_MIN, PIN_MAX } from './pin';
import { biometricStatus, biometricEnrolled, enrollBiometric, forgetBiometric } from './biometric';
import { PinInput } from './LockScreen';
import { isLive } from '../hooks/useDevices';
import { timeAgo } from '../services/sync';
import { Section, Group } from '../features/settings/SettingsGroup';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { eventText } from './events';

export default function SecurityCard({ user, devices, events = [] }) {
  const lock = useAppLockContext();
  if (!lock) return null;
  const list = devices?.devices ?? [];
  const live = list.filter((d) => d.id !== devices.thisId && isLive(d)).length;
  return (
    <Section title="Security">
      <Group id="app-lock" title="App lock" Icon={lock.enabled ? Lock : LockOpen} color={lock.enabled ? 'var(--income)' : 'var(--text-muted)'}
        summary={lock.enabled ? `On · PIN on all devices · ${LOCK_AFTER.find((o) => o.key === (lock.cfg.lockAfter ?? DEFAULT_LOCK_AFTER))?.label.toLowerCase()}` : 'Off — anyone holding this device can open the app'}>
        <AppLockSettings lock={lock} user={user} />
      </Group>
      <Group id="devices" title="Your devices" Icon={Laptop} color="var(--savings)"
        summary={`${list.length} signed in${live ? ` · ${live} live now` : ''}`}>
        <DeviceList devices={devices} lockOn={lock.enabled} />
      </Group>
      <Group id="security-alerts" title="Security alerts" Icon={Bell} color="var(--lent)"
        summary={events.length ? `${eventText(events[0]).title} · ${timeAgo(events[0].at)}` : 'Nothing unusual'}>
        <EventList events={events} />
      </Group>
    </Section>
  );
}

/* ── App lock settings ── */
function AppLockSettings({ lock, user }) {
  const [step, setStep] = useState(null);   // null | 'set' | 'change' | 'off'
  const [cur, setCur] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(null);
  const [bioOn, setBioOn] = useState(biometricEnrolled);
  useEffect(() => { biometricStatus().then(setBio); }, []);
  const reset = () => { setStep(null); setCur(''); setA(''); setB(''); setErr(null); setBusy(false); };

  async function saveNew() {
    if (step === 'change' && !(await lock.checkPin(cur))) { setErr('Your current PIN is not right.'); return; }
    const p = pinProblem(a);
    if (p) { setErr(p); return; }
    if (a !== b) { setErr('The two PINs don’t match.'); return; }
    setBusy(true);
    try { await lock.setPin(a); reset(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function turnOff() {
    if (!(await lock.checkPin(cur))) { setErr('That PIN is not right.'); return; }
    setBusy(true);
    try { await lock.turnOff(); forgetBiometric(); setBioOn(false); reset(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function toggleBio() {
    setErr(null);
    if (bioOn) { forgetBiometric(); setBioOn(false); return; }
    try { if (await enrollBiometric({ email: user?.email })) setBioOn(true); } catch (e) { setErr(e?.message || 'Could not set it up on this device.'); }
  }

  const pad = { padding: '12px 16px 14px' };
  if (step) {
    return (
      <div style={pad}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {step === 'set' ? 'Choose a PIN for all your devices' : step === 'change' ? 'Change your PIN' : 'Turn off app lock'}
        </div>
        {(step === 'change' || step === 'off') && <PinInput id="lock-cur-pin" value={cur} onChange={setCur} placeholder="Current PIN" autoFocus />}
        {step !== 'off' && (
          <>
            <PinInput id="lock-set-pin" value={a} onChange={setA} placeholder={`New PIN (${PIN_MIN}–${PIN_MAX} digits)`} autoFocus={step === 'set'} />
            <PinInput id="lock-set-pin2" value={b} onChange={setB} placeholder="Type it again" />
          </>
        )}
        {err && <div role="alert" style={{ fontSize: 12, color: 'var(--expense)', margin: '2px 0 8px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="lock-set-save" disabled={busy} onClick={step === 'off' ? turnOff : saveNew} style={btn(step === 'off' ? 'expense' : 'accent')}>
            {step === 'off' ? 'Turn off' : step === 'set' ? 'Turn on app lock' : 'Save new PIN'}
          </button>
          <button onClick={reset} style={btn(null)}>Cancel</button>
        </div>
        {step === 'set' && <p style={note}>You’ll use this PIN on your phone, computer and the website. If you forget it, sign in again with your account to set a new one — nothing is erased.</p>}
      </div>
    );
  }
  if (!lock.enabled) {
    return (
      <div style={pad}>
        <p style={{ ...note, marginTop: 0 }}>Ask for a PIN — or your fingerprint — whenever the app opens. One PIN works on every device you’re signed in on. Wrong guesses lock the app for longer each time, and you’re alerted.</p>
        <button id="lock-enable" onClick={() => setStep('set')} style={btn('accent')}><Lock size={13} /> Set up app lock</button>
      </div>
    );
  }
  return (
    <div>
      <Row Icon={Timer} title="Lock after" sub="Time away from the app (computers also lock after 5 minutes untouched)">
        <select id="lock-after" value={lock.cfg.lockAfter ?? DEFAULT_LOCK_AFTER} onChange={(e) => lock.setLockAfter(Number(e.target.value))}
          style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', borderRadius: 8 }}>
          {LOCK_AFTER.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Row>
      <Row Icon={Fingerprint} title={bio?.label ?? 'Fingerprint'} sub={bio?.available ? 'Unlock with it on this device' : bio?.reason === 'none-enrolled' ? 'Add a fingerprint or face in your phone’s settings first' : 'Not available on this device — use your PIN'}>
        <button id="lock-bio-toggle" className={`toggle-track ${bioOn ? 'on' : ''}`} aria-pressed={bioOn} aria-label="Unlock with fingerprint on this device"
          disabled={!bio?.available && !bioOn} style={!bio?.available && !bioOn ? { opacity: 0.4 } : undefined} onClick={toggleBio}>
          <span className="toggle-thumb" />
        </button>
      </Row>
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--expense)', padding: '0 16px 8px' }}>{err}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px 14px' }}>
        <button id="lock-now" onClick={() => lock.lock('manual')} style={btn('accent')}><Lock size={13} /> Lock now</button>
        <button id="lock-change" onClick={() => setStep('change')} style={btn(null)}><KeyRound size={13} /> Change PIN</button>
        <button id="lock-disable" onClick={() => setStep('off')} style={btn(null)}>Turn off</button>
      </div>
    </div>
  );
}

/* ── Devices: live / locked, lock or sign out each ── */
const KIND_ICON = { android: Smartphone, ios: Smartphone, desktop: Laptop, web: Globe };
function DeviceList({ devices, lockOn }) {
  const [confirm, setConfirm] = useState(null);   // { device, type }
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now());
  const list = (devices?.devices ?? []).slice()
    .sort((x, y) => (y.id === devices.thisId) - (x.id === devices.thisId) || isLive(y, now) - isLive(x, now) || (y.lastSeen ?? 0) - (x.lastSeen ?? 0));
  const others = list.filter((d) => d.id !== devices.thisId);
  const shown = all ? list : list.slice(0, 6);
  const doIt = () => {
    const { device, type } = confirm;
    if (device === 'all') others.forEach((d) => devices.command(d.id, type));
    else devices.command(device.id, type);
    setConfirm(null);
  };
  return (
    <div>
      {confirm && (
        <ConfirmDeleteModal
          title={confirm.type === 'signout' ? `Sign out ${confirm.device === 'all' ? 'every other device' : confirm.device.name}?` : `Lock ${confirm.device === 'all' ? 'every other device' : confirm.device.name}?`}
          message={confirm.type === 'signout'
            ? 'It signs out and clears its copy of your data the moment it is online. Your data stays safe in your account.'
            : 'It needs your PIN (or an approval from here) to open again.'}
          confirmLabel={confirm.type === 'signout' ? 'Sign out' : 'Lock'} ConfirmIcon={confirm.type === 'signout' ? LogOut : Lock}
          onConfirm={doIt} onCancel={() => setConfirm(null)} />
      )}
      {shown.map((d, i) => {
        const isThis = d.id === devices.thisId;
        const liveNow = isThis || (!d.locked && isLive(d, now));
        const Icon = KIND_ICON[d.platform] ?? (/Android|iPhone/.test(d.name ?? '') ? Smartphone : /Desktop/.test(d.name ?? '') ? Laptop : Globe);
        return (
          <div key={d.id} className="device-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || 'Unknown device'}</span>
                {liveNow && !d.locked && <span className="live-tag" id={isThis ? undefined : `live-${d.id}`}><span className="live-dot" />Live</span>}
                {d.locked && !isThis && <span className="locked-tag"><Lock size={9} /> Locked</span>}
                {isThis && <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 700 }}>this device</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {d.locked && !isThis ? 'Needs the PIN to open' : liveNow ? 'On screen now' : d.lastSeen ? `Last seen ${timeAgo(d.lastSeen)}` : 'Not seen yet'}{d.kind ? ` · ${d.kind}` : ''}
                {d.unlockRequest && now - d.unlockRequest.at < 120000 && ' · asking to unlock'}
              </div>
            </div>
            {!isThis && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {lockOn && !d.locked && <IconBtn id={`device-lock-${d.id}`} label={`Lock ${d.name}`} onClick={() => setConfirm({ device: d, type: 'lock' })}><Lock size={13} /></IconBtn>}
                <IconBtn id={`device-signout-${d.id}`} label={`Sign out ${d.name}`} onClick={() => setConfirm({ device: d, type: 'signout' })}><LogOut size={13} /></IconBtn>
                {!liveNow && <IconBtn label={`Remove ${d.name} from this list`} onClick={() => devices.remove(d.id)}><X size={13} /></IconBtn>}
              </div>
            )}
          </div>
        );
      })}
      {!all && list.length > 6 && <button onClick={() => setAll(true)} style={{ ...linkRow }}>+{list.length - 6} more</button>}
      {others.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px 14px', borderTop: '1px solid var(--border)' }}>
          {lockOn && <button id="lock-all-others" onClick={() => setConfirm({ device: 'all', type: 'lock' })} style={btn(null)}><Lock size={13} /> Lock all other devices</button>}
          <button id="signout-all-others" onClick={() => setConfirm({ device: 'all', type: 'signout' })} style={btn(null)}><LogOut size={13} /> Sign out all others</button>
        </div>
      )}
      {!lockOn && others.length > 0 && <p style={{ ...note, padding: '0 16px 12px', margin: 0 }}>Turn on app lock to lock other devices from here.</p>}
    </div>
  );
}

/* ── Security alerts ── */
function EventList({ events }) {
  if (!events.length) return <p style={{ ...note, padding: '12px 16px', margin: 0 }}><ShieldCheck size={12} style={{ verticalAlign: -2, color: 'var(--income)' }} /> No security alerts. Wrong-PIN attempts and lock changes show up here and on your other devices.</p>;
  return (
    <div>
      {events.slice(0, 8).map((e, i) => {
        const t = eventText(e);
        return (
          <div key={e.id} style={{ display: 'flex', gap: 10, padding: '9px 16px', borderTop: i ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
            {t.bad ? <ShieldAlert size={14} style={{ color: 'var(--expense)', marginTop: 2 }} /> : <ShieldCheck size={14} style={{ color: 'var(--income)', marginTop: 2 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>{t.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.sub} · {timeAgo(e.at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ Icon, title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
      <Icon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}
function IconBtn({ id, label, onClick, children }) {
  return (
    <button id={id} onClick={onClick} aria-label={label} title={label}
      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}
const note = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 10 };
const linkRow = { width: '100%', padding: '9px 16px', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' };
const btn = (tone) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer',
  border: tone ? 'none' : '1.5px solid var(--border)', background: tone ? `var(--${tone})` : 'transparent', color: tone ? 'var(--on-accent, #fff)' : 'var(--text-secondary)',
});
