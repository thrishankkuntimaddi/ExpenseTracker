// ─── Settings → Reminders ────────────────────────────────────────
// Which reminders, when, and in what tone sync across devices; whether THIS
// device delivers them is a per-device switch. Everything is off by default.
// Shown as tiles: tap one to switch it on (or open its time / days).
import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, PenLine, CalendarClock, Target, BarChart3, Send, Power, FileText, Flag } from 'lucide-react';
import {
  normaliseReminders, buildSchedule, previewReminder, anyReminderOn, TONES, ALL_DAYS,
} from '../../utils/reminders';
import {
  deviceDelivery, notificationPermission, requestNotificationPermission, sendTest, DELIVERY_NOTE, reminderStyle, exactTiming,
} from '../../native/reminders';
import { pushSupported, registerPush } from '../../native/push';
import { getDeviceId } from '../../hooks/useDevices';
import { autostart, platform } from '../../native';
import { ordinal, getReportSettings } from '../../utils/report';

const TYPES = [
  { key: 'recurring', Icon: CalendarClock, tone: 'expense', label: 'Bills due',       sub: '“Have you paid rent?” on the day a bill is due' },
  { key: 'daily',     Icon: PenLine,       tone: 'accent',  label: 'Log the day',     sub: 'An evening nudge — skipped if you already logged' },
  { key: 'budget',    Icon: Target,        tone: 'lent',    label: 'Budget check',    sub: 'Once at 80 % of the month’s budget, once at 100 %' },
  { key: 'report',    Icon: FileText,      tone: 'savings', label: 'Monthly report',  sub: 'On your report day — what changed this month' },
  { key: 'goals',     Icon: Flag,          tone: 'income',  label: 'Goals',           sub: 'Each goal’s day: put this month’s share aside, or collect it' },
  { key: 'weekly',    Icon: BarChart3,     tone: 'given',   label: 'Weekly summary',  sub: 'One line on how the week went' },
];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const whenLabel = (ms) => {
  const d = new Date(ms), now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = d.toDateString() === now.toDateString() ? 'today' : d.toDateString() === tomorrow.toDateString() ? 'tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} at ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

export default function RemindersCard({ settings, onPatchSettings, transactions = [], income = [], recurringRules = [], uid }) {
  const cfg = useMemo(() => normaliseReminders(settings?.reminders), [settings?.reminders]);
  const data = useMemo(() => ({ transactions, income, recurring: recurringRules, budgets: settings?.budgets, categoryRules: settings?.categoryRules, goals: settings?.goals, report: settings?.report }),
    [transactions, income, recurringRules, settings?.budgets, settings?.categoryRules, settings?.goals, settings?.report]);

  const [deviceOn, setDeviceOn] = useState(deviceDelivery.get);
  const [style, setStyle] = useState(reminderStyle.get);
  const [exact, setExact] = useState(exactTiming.get);
  const [perm, setPerm] = useState('prompt');
  const [loginOn, setLoginOn] = useState(false);
  const [previewType, setPreviewType] = useState('recurring');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  useEffect(() => { notificationPermission().then(setPerm); if (autostart.available) autostart.get().then(setLoginOn); }, []);

  const save = (next) => onPatchSettings?.({ reminders: next });
  const setType = (type, patch) => save({ ...cfg, [type]: { ...cfg[type], ...patch } });

  async function turnDeviceOn(on) {
    setNote(null);
    if (on) {
      const p = perm === 'granted' ? 'granted' : await requestNotificationPermission();
      setPerm(p);
      if (p !== 'granted') {
        setNote(p === 'unsupported' ? 'This browser can’t show notifications.' : 'Notifications are blocked for this app. Allow them in your system or browser settings, then try again.');
        return false;
      }
    }
    deviceDelivery.set(on); setDeviceOn(on);
    // The website gets its reminders through the cloud while the page is closed
    if (uid) registerPush(uid, getDeviceId(), { reminders: on });
    return true;
  }

  async function toggleType(type) {
    const turningOn = !cfg[type].enabled;
    // Turning on the first reminder also turns this device on (asks permission once)
    if (turningOn && !deviceOn && !(await turnDeviceOn(true))) return;
    // On already (the Android app is on by default) but never allowed to notify: ask now
    if (turningOn && deviceOn && perm === 'prompt') setPerm(await requestNotificationPermission());
    setType(type, { enabled: turningOn });
    setSelected(turningOn ? type : null);
    setPreviewType(type);
  }
  // A tile: off → switch on; on → open its settings (again → close)
  function tapTile(type) {
    if (!cfg[type].enabled) return toggleType(type);
    setSelected((s) => (s === type ? null : type));
    setPreviewType(type);
  }

  const next = useMemo(() => (deviceOn ? buildSchedule(now, cfg, data)[0] : null), [deviceOn, cfg, data, now]);
  const preview = useMemo(() => previewReminder(previewType, cfg, data, now), [previewType, cfg, data, now]);

  async function test() {
    setNote(null);
    const ok = await sendTest(previewType, cfg, data);
    setNote(ok
      ? (platform === 'web' ? 'Sent — it appears in a moment (switch to another tab to see it if this one is focused).' : 'Sent — it appears in a moment.')
      : 'Couldn’t show a notification: allow notifications for this app first.');
  }

  const blocked = perm === 'denied';

  return (
    <div id="reminders-card">
      {/* This device */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: deviceOn ? 'var(--accent-bg)' : 'var(--surface2)' }}>
          {deviceOn ? <Bell size={16} style={{ color: 'var(--accent)' }} /> : <BellOff size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Reminders on this device</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{DELIVERY_NOTE}</div>
        </div>
        <button id="reminders-device" className={`toggle-track ${deviceOn ? 'on' : ''}`} aria-label="Reminders on this device" aria-pressed={deviceOn}
          onClick={() => turnDeviceOn(!deviceOn)}>
          <span className="toggle-thumb" />
        </button>
      </div>

      {deviceOn && (platform === 'android' || platform === 'web') && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          {platform === 'android' && (
            <>
              <OptionRow id="reminders-style" title="Pop up with a sound" sub={style === 'alert' ? 'Shows on top of other apps, like a message' : 'Arrives quietly in the notification shade'}
                on={style === 'alert'} onToggle={() => { const v = style === 'alert' ? 'quiet' : 'alert'; reminderStyle.set(v); setStyle(v); }} />
              <OptionRow id="reminders-exact" title="On the minute" sub={exact ? 'Arrives exactly at the time you set' : 'Android may hold it a few minutes to save battery'}
                on={exact} onToggle={async () => { const ok = await exactTiming.set(!exact); if (ok) setExact(!exact); else setNote('Allow “Alarms & reminders” for Expense Tracker in Android settings, then try again.'); }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, padding: '8px 16px 12px' }}>
                Not arriving on a vivo, iQOO, Oppo, Xiaomi or Samsung phone? In Android settings → Apps → Expense Tracker → Battery, choose <strong>Unrestricted</strong> (or allow “Auto-start”).
              </p>
            </>
          )}
          {platform === 'web' && (
            <p id="reminders-push-note" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, padding: '10px 16px 12px' }}>
              {pushSupported
                ? 'Reminders reach this browser through the cloud even when the page is closed (Chrome, Edge, Firefox; on iPhone, add the app to your Home Screen first).'
                : 'This browser only shows reminders while the page is open.'}
            </p>
          )}
        </div>
      )}

      {(note || blocked) && (
        <div role="status" style={{ margin: '10px 16px 0', padding: '9px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, background: 'var(--surface2)', border: '1px solid var(--border)', color: blocked && !note ? 'var(--expense)' : 'var(--text-secondary)' }}>
          {note ?? 'Notifications are blocked for this app — allow them in your system or browser settings.'}
        </div>
      )}
      {/* On, but never allowed to notify (Android 13+ asks once): nothing would arrive */}
      {!note && !blocked && deviceOn && perm === 'prompt' && anyReminderOn(cfg) && (
        <div role="status" style={{ margin: '10px 16px 0', padding: '9px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, background: 'var(--expense-bg)', border: '1px solid var(--expense-border)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>Reminders can’t arrive yet — allow notifications for this app.</span>
          <button onClick={async () => setPerm(await requestNotificationPermission())} style={{ border: 'none', borderRadius: 8, padding: '6px 10px', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>Allow</button>
        </div>
      )}

      {/* Types: tiles */}
      <div className="reminder-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, padding: '12px 16px' }}>
        {TYPES.map(({ key, Icon, label, tone }) => {
          const t = cfg[key];
          const on = t.enabled;
          const sel = selected === key;
          return (
            <button key={key} id={`reminder-${key}`} className="reminder-tile" aria-pressed={on} onClick={() => tapTile(key)}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '12px 12px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${sel ? `var(--${tone})` : on ? `var(--${tone}-border, var(--border))` : 'var(--border)'}`, background: on ? `var(--${tone}-bg)` : 'var(--surface2)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? `var(--${tone})` : 'var(--surface)', color: on ? '#fff' : 'var(--text-muted)' }}><Icon size={15} /></span>
              <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 650, color: on ? `var(--${tone})` : 'var(--text-muted)' }}>
                {on ? `On · ${t.time}${key === 'weekly' ? ` · ${DAY_NAMES[t.day ?? 0].slice(0, 3)}` : ''}` : 'Off — tap to turn on'}
              </span>
            </button>
          );
        })}
      </div>

      {selected && cfg[selected]?.enabled && (() => {
        const { key, label, sub } = TYPES.find((x) => x.key === selected);
        const t = cfg[key];
        return (
          <div id="reminder-detail" style={{ margin: '0 16px 12px', padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.45 }}>{sub}</div>
              </div>
              <button className="toggle-track on" aria-label={`Turn off ${label}`} aria-pressed onClick={() => toggleType(key)}><span className="toggle-thumb" /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <input type="time" value={t.time} aria-label={`${label} time`} onChange={(e) => e.target.value && setType(key, { time: e.target.value })}
                style={{ padding: '6px 8px', borderRadius: 9, fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }} />
              {key === 'daily' && ALL_DAYS.map((d) => {
                const on = (t.days ?? ALL_DAYS).includes(d);
                return (
                  <button key={d} aria-label={DAY_NAMES[d]} aria-pressed={on}
                    onClick={() => { const days = on ? (t.days ?? ALL_DAYS).filter((x) => x !== d) : [...(t.days ?? []), d].sort(); if (days.length) setType('daily', { days }); }}
                    style={{ width: 28, height: 28, borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {DAY_LETTERS[d]}
                  </button>
                );
              })}
              {key === 'weekly' && (
                <select value={t.day ?? 0} aria-label="Day of the week" onChange={(e) => setType('weekly', { day: Number(e.target.value) })}
                  style={{ padding: '6px 8px', borderRadius: 9, fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  {DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
                </select>
              )}
              {key === 'budget' && !(Number(settings?.budgets?.total) > 0) && <span style={{ fontSize: 11, color: 'var(--lent)' }}>Set a monthly budget on the Budget page for this to work.</span>}
              {key === 'report' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Report day: the {ordinal(getReportSettings(settings).day)} — change it in Stats → Monthly report.</span>}
              {key === 'goals' && !(settings?.goals ?? []).some((g) => !g.status || g.status === 'active') && <span style={{ fontSize: 11, color: 'var(--lent)' }}>Add a goal on the Savings page for this to work.</span>}
            </div>
          </div>
        );
      })()}

      {/* Tone + preview + test */}
      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Tone</div>
        <div role="radiogroup" aria-label="Reminder tone" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {TONES.map((t) => (
            <button key={t.key} role="radio" aria-checked={cfg.tone === t.key} onClick={() => save({ ...cfg, tone: t.key })}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${cfg.tone === t.key ? 'var(--accent)' : 'var(--border)'}`, background: cfg.tone === t.key ? 'var(--accent-bg)' : 'transparent', color: cfg.tone === t.key ? 'var(--accent)' : 'var(--text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setPreviewType(t.key)} aria-pressed={previewType === t.key}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: previewType === t.key ? 'var(--surface2)' : 'transparent', color: previewType === t.key ? 'var(--text)' : 'var(--text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div id="reminder-preview" style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={28} height={28} style={{ borderRadius: 7, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{preview.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{preview.body}</div>
            {preview.example && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Example — your real numbers will be used.</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <span id="reminder-next" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {!deviceOn ? 'Off on this device.' : !anyReminderOn(cfg) ? 'No reminders turned on.' : next ? `Next: ${TYPES.find((t) => t.key === next.type)?.label} · ${whenLabel(next.at)}` : 'Nothing due in the next two weeks.'}
          </span>
          <button id="btn-reminder-test" onClick={test}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent)' }}>
            <Send size={13} /> Send a test
          </button>
        </div>
      </div>

      {autostart.available && (
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)' }}>
          <Power size={16} style={{ color: loginOn ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Open at login</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Starts quietly in the menu bar / tray so reminders arrive after a restart</div>
          </div>
          <button id="autostart" className={`toggle-track ${loginOn ? 'on' : ''}`} aria-label="Open at login" aria-pressed={loginOn}
            onClick={async () => setLoginOn(await autostart.set(!loginOn))}>
            <span className="toggle-thumb" />
          </button>
        </div>
      )}
    </div>
  );
}

function OptionRow({ id, title, sub, on, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <button id={id} className={`toggle-track ${on ? 'on' : ''}`} aria-pressed={on} aria-label={title} onClick={onToggle}>
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
