// ─── Settings → Reminders ────────────────────────────────────────
// Which reminders, when, and in what tone sync across devices; whether THIS
// device delivers them is a per-device switch. Everything is off by default.
import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, PenLine, CalendarClock, Target, BarChart3, Send, Power } from 'lucide-react';
import {
  normaliseReminders, buildSchedule, previewReminder, anyReminderOn, TONES, ALL_DAYS,
} from '../../utils/reminders';
import {
  deviceDelivery, notificationPermission, requestNotificationPermission, sendTest, DELIVERY_NOTE,
} from '../../native/reminders';
import { autostart, platform } from '../../native';

const TYPES = [
  { key: 'daily',     Icon: PenLine,       label: 'Daily nudge',        sub: 'Evening reminder to log the day — skipped if you already did' },
  { key: 'recurring', Icon: CalendarClock, label: 'Recurring due',      sub: 'The evening before rent, EMIs or subscriptions are due' },
  { key: 'budget',    Icon: Target,        label: 'Budget check',       sub: 'Once at 80 % of the month’s budget, once at 100 %' },
  { key: 'weekly',    Icon: BarChart3,     label: 'Weekly summary',     sub: 'One line on how the week went' },
];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const whenLabel = (ms) => {
  const d = new Date(ms), now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = d.toDateString() === now.toDateString() ? 'today' : d.toDateString() === tomorrow.toDateString() ? 'tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} at ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

export default function RemindersCard({ settings, onPatchSettings, transactions = [], income = [], recurringRules = [] }) {
  const cfg = useMemo(() => normaliseReminders(settings?.reminders), [settings?.reminders]);
  const data = useMemo(() => ({ transactions, income, recurring: recurringRules, budgets: settings?.budgets, categoryRules: settings?.categoryRules }),
    [transactions, income, recurringRules, settings?.budgets, settings?.categoryRules]);

  const [deviceOn, setDeviceOn] = useState(deviceDelivery.get);
  const [perm, setPerm] = useState('prompt');
  const [loginOn, setLoginOn] = useState(false);
  const [previewType, setPreviewType] = useState('daily');
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
    return true;
  }

  async function toggleType(type) {
    const turningOn = !cfg[type].enabled;
    // Turning on the first reminder also turns this device on (asks permission once)
    if (turningOn && !deviceOn && !(await turnDeviceOn(true))) return;
    setType(type, { enabled: turningOn });
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

      {(note || blocked) && (
        <div role="status" style={{ margin: '10px 16px 0', padding: '9px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, background: 'var(--surface2)', border: '1px solid var(--border)', color: blocked && !note ? 'var(--expense)' : 'var(--text-secondary)' }}>
          {note ?? 'Notifications are blocked for this app — allow them in your system or browser settings.'}
        </div>
      )}

      {/* Types */}
      {TYPES.map(({ key, Icon, label, sub }) => {
        const t = cfg[key];
        return (
          <div key={key} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon size={16} style={{ color: t.enabled ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.45 }}>{sub}</div>
              </div>
              <button id={`reminder-${key}`} className={`toggle-track ${t.enabled ? 'on' : ''}`} aria-label={label} aria-pressed={t.enabled} onClick={() => toggleType(key)}>
                <span className="toggle-thumb" />
              </button>
            </div>
            {t.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingLeft: 28 }}>
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
                {key === 'budget' && !(Number(settings?.budgets?.total) > 0) && (
                  <span style={{ fontSize: 11, color: 'var(--lent)' }}>Set a monthly budget in Plan for this to work.</span>
                )}
              </div>
            )}
          </div>
        );
      })}

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
