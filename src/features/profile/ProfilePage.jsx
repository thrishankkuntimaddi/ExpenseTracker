// ─── Profile (phone) ─────────────────────────────────────────────
// Opened from the avatar (phone) or the sidebar (desktop): who is signed
// in, the theme in one row, reminders as tiles, how the layout is arranged,
// then every other setting grouped into a few sections.
import { useMemo } from 'react';
import { ArrowLeft, Sun, Moon, Monitor, LayoutGrid, Home as HomeIcon, Rocket, ChevronUp, ChevronDown, RotateCcw, ShieldCheck, Plus } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { displayNameOf } from '../../app/shellContext';
import { PAGE_META } from '../../app/pages';
import { PAGE_KEYS, SLOT_KEYS, HOME_SECTIONS, normaliseUi, serialiseUi, move, setTabAt } from '../../utils/uiPrefs';
import { Section, Group } from '../settings/SettingsGroup';
import SettingsTab from '../settings/SettingsTab';
import RemindersCard from '../settings/RemindersCard';
import { useShell } from '../../app/shellContext';

export default function ProfilePage(props) {
  const { user, transactions = [], income = [], devices, settings, themePref = 'system', theme, onThemePrefChange, onPatchSettings, onBack, recurring } = props;
  const desktop = useShell()?.desktop;
  const ui = useMemo(() => normaliseUi(settings?.ui), [settings?.ui]);
  const save = (patch) => onPatchSettings?.({ ui: serialiseUi({ ...ui, ...patch }) });

  const months = useMemo(() => new Set([...transactions, ...income].map((t) => t.month).filter(Boolean)).size, [transactions, income]);
  const since = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
  const providers = user?.providerData?.map((p) => p.providerId) ?? [];
  const deviceCount = devices?.devices?.length ?? 0;

  return (
    <div className="tab-root profile-page">
      <div className="tab-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button id="btn-profile-back" onClick={onBack} aria-label="Back"
            style={{ width: 34, height: 34, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={17} />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Profile</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Account, look & layout, settings</p>
        </div>
      </div>

      <div className="tab-body">
        {/* ── Who's signed in ── */}
        <div className="card profile-hero" style={{ padding: '18px 16px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar user={user} size={58} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayNameOf(user)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {providers.includes('google.com') && <Pill>Google</Pill>}
                {providers.includes('password') && <Pill>Email</Pill>}
                {(user?.emailVerified || providers.includes('google.com')) && <Pill tone="income"><ShieldCheck size={10} /> Verified</Pill>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <Stat value={(transactions.length + income.length).toLocaleString('en-IN')} label="Entries" />
            <Stat value={months} label={months === 1 ? 'Month' : 'Months'} />
            <Stat value={deviceCount} label={deviceCount === 1 ? 'Device' : 'Devices'} />
          </div>
          {since && !Number.isNaN(since.getTime()) && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
              Member since {since.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* ── Theme: one row ── */}
        <div className="card theme-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Theme</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{themePref === 'system' ? `Follows this device · ${theme === 'monoflow' ? 'dark' : 'light'} now` : 'This device only'}</div>
          </div>
          <div role="radiogroup" aria-label="Theme" className="segmented" style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface2)', flexShrink: 0 }}>
            {[{ key: 'light', label: 'Light', Icon: Sun }, { key: 'dark', label: 'Dark', Icon: Moon }, { key: 'system', label: 'Auto', Icon: Monitor }].map(({ key, label, Icon }) => {
              const on = themePref === key;
              return (
                <button key={key} id={`theme-${key}`} role="radio" aria-checked={on} onClick={() => onThemePrefChange?.(key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: on ? 'var(--shadow-sm)' : 'none' }}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Reminders: tiles ── */}
        <section id="group-reminders" style={{ marginBottom: 18, scrollMarginTop: 12 }}>
          <p className="section-label" style={{ padding: '0 6px' }}>Reminders</p>
          <div className="card settings-section">
            <RemindersCard settings={settings} onPatchSettings={onPatchSettings} transactions={transactions} income={income} recurringRules={recurring?.rules ?? []} />
          </div>
        </section>

        {/* ── Customize ── */}
        <Section title="Customize">
          {!desktop && (
            <Group id="custom-bar" title="Bottom bar" Icon={LayoutGrid} color="var(--savings)"
              summary={['Home', ...ui.tabs.map((k) => PAGE_META[k].label)].join(' · ')}>
              <BarEditor tabs={ui.tabs} onChange={(tabs) => save({ tabs })} />
            </Group>
          )}
          <Group id="custom-home" title="Home screen" Icon={HomeIcon} color="var(--expense)"
            summary={ui.home.filter((s) => s.visible).map((s) => HOME_SECTIONS.find((h) => h.key === s.key).label).join(' · ')}>
            <HomeEditor home={ui.home} onChange={(home) => save({ home })} />
          </Group>
          <Group id="custom-start" title="Open the app on" Icon={Rocket} color="var(--income)" summary={PAGE_META[ui.start].label}>
            <div role="radiogroup" aria-label="Start page" style={{ padding: '12px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PAGE_KEYS.map((k) => (
                <Chip key={k} id={`start-${k}`} active={ui.start === k} onClick={() => save({ start: k })}>{PAGE_META[k].label}</Chip>
              ))}
            </div>
          </Group>
        </Section>

        <SettingsTab {...props} embedded />
      </div>
    </div>
  );
}

/* ── Bottom bar: Home, then three slots around "+"; each slot can hold any
   other page. Picking a page that's already in another slot swaps the two,
   so there are never duplicates. ── */
function BarEditor({ tabs, onChange }) {
  const preview = ['today', tabs[0], 'add', tabs[1], tabs[2]];
  return (
    <div style={{ padding: '12px 16px 14px' }}>
      {/* live preview */}
      <div aria-hidden style={{ display: 'flex', alignItems: 'center', borderRadius: 18, background: 'var(--surface2)', padding: '8px 4px', marginBottom: 12 }}>
        {preview.map((k) => {
          if (k === 'add') {
            return <span key="add" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px' }}><Plus size={16} /></span>;
          }
          const meta = PAGE_META[k];
          return (
            <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
              <meta.Icon size={16} />
              <span style={{ fontSize: 9, fontWeight: 600 }}>{meta.label}</span>
            </div>
          );
        })}
      </div>
      {tabs.map((k, i) => {
        const { Icon } = PAGE_META[k];
        return (
          <div key={k} className="bar-slot" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</span>
            <Icon size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <select id={`bar-slot-${i}`} value={k} onChange={(e) => onChange(setTabAt(tabs, i, e.target.value))} aria-label={`Bar slot ${i + 1}`}
              style={{ flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
              {SLOT_KEYS.map((p) => <option key={p} value={p}>{PAGE_META[p].label}</option>)}
            </select>
            <MoveButtons i={i} n={tabs.length} onMove={(d) => onChange(move(tabs, i, d))} label={PAGE_META[k].label} />
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
        Home is always first and <strong>+</strong> adds anything. Every other page is a tile on Home.
      </p>
      <ResetLink onClick={() => onChange(normaliseUi({}).tabs)} />
    </div>
  );
}

/* ── Home: order the sections and switch them on or off ── */
function HomeEditor({ home, onChange }) {
  return (
    <div style={{ padding: '6px 16px 14px' }}>
      {home.map((s, i) => {
        const meta = HOME_SECTIONS.find((h) => h.key === s.key);
        return (
          <div key={s.key} className="home-slot" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.visible ? 'var(--text)' : 'var(--text-muted)' }}>{meta.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta.hint}</div>
            </div>
            <MoveButtons i={i} n={home.length} onMove={(d) => onChange(move(home, i, d))} label={meta.label} />
            <button id={`home-toggle-${s.key}`} className={`toggle-track ${s.visible ? 'on' : ''}`} disabled={meta.locked}
              aria-label={`Show ${meta.label}`} aria-pressed={s.visible} style={meta.locked ? { opacity: 0.45 } : undefined}
              onClick={() => onChange(home.map((h) => (h.key === s.key ? { ...h, visible: !h.visible } : h)))}>
              <span className="toggle-thumb" />
            </button>
          </div>
        );
      })}
      <ResetLink onClick={() => onChange(normaliseUi({}).home)} />
    </div>
  );
}

function MoveButtons({ i, n, onMove, label }) {
  const btn = { width: 28, height: 28, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      <button onClick={() => onMove(-1)} disabled={i === 0} aria-label={`Move ${label} up`} style={{ ...btn, opacity: i === 0 ? 0.35 : 1 }}><ChevronUp size={14} /></button>
      <button onClick={() => onMove(1)} disabled={i === n - 1} aria-label={`Move ${label} down`} style={{ ...btn, opacity: i === n - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
    </div>
  );
}

function ResetLink({ onClick }) {
  return (
    <button onClick={onClick} style={{ marginTop: 10, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <RotateCcw size={12} /> Reset to default
    </button>
  );
}

function Chip({ id, active, onClick, children }) {
  return (
    <button id={id} role="radio" aria-checked={active} onClick={onClick}
      style={{ padding: '7px 13px', fontSize: 12, fontWeight: 700, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}

function Pill({ children, tone }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: tone ? `var(--${tone}-bg)` : 'var(--surface2)', color: tone ? `var(--${tone})` : 'var(--text-secondary)' }}>
      {children}
    </span>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
    </div>
  );
}

