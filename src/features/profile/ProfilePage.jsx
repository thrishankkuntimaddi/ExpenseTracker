// ─── Profile (phone) ─────────────────────────────────────────────
// Opened from the avatar at the top of every page: who is signed in, the
// look of the app, how the phone layout is arranged, then every setting
// grouped into a few sections (the same SettingsTab the desktop uses).
import { useMemo } from 'react';
import { ArrowLeft, Sun, Moon, Monitor, LayoutGrid, Home as HomeIcon, Rocket, ChevronUp, ChevronDown, RotateCcw, ShieldCheck } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { displayNameOf } from '../../app/shellContext';
import { PAGE_META } from '../../app/pages';
import { PAGE_KEYS, HOME_SECTIONS, normaliseUi, serialiseUi, move, setTabAt } from '../../utils/uiPrefs';
import { Section, Group } from '../settings/SettingsGroup';
import SettingsTab from '../settings/SettingsTab';

export default function ProfilePage(props) {
  const { user, transactions = [], income = [], devices, settings, themePref = 'system', theme, onThemePrefChange, onPatchSettings, onBack } = props;
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

        {/* ── Appearance ── */}
        <section style={{ marginBottom: 18 }}>
          <p className="section-label" style={{ padding: '0 6px' }}>Appearance</p>
          <div role="radiogroup" aria-label="Theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { key: 'light', label: 'Light', Icon: Sun, swatch: ['#F2F3F7', '#FFFFFF', '#1D1D1F'] },
              { key: 'dark', label: 'Dark', Icon: Moon, swatch: ['#0B0E14', '#161A23', '#ECEEF3'] },
              { key: 'system', label: 'Auto', Icon: Monitor, swatch: null },
            ].map(({ key, label, Icon, swatch }) => {
              const on = themePref === key;
              return (
                <button key={key} id={`theme-${key}`} role="radio" aria-checked={on} onClick={() => onThemePrefChange?.(key)}
                  className="theme-tile"
                  style={{ padding: 8, borderRadius: 16, border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                  <ThemeSwatch swatch={swatch} />
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    <Icon size={13} /> {label}
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '7px 6px 0' }}>
            {themePref === 'system' ? `Follows your phone — ${theme === 'monoflow' ? 'dark' : 'light'} right now.` : 'Saved on this device.'}
          </p>
        </section>

        {/* ── Customize ── */}
        <Section title="Customize">
          <Group id="custom-bar" title="Bottom bar" Icon={LayoutGrid} color="var(--savings)"
            summary={ui.tabs.map((k) => PAGE_META[k].label).join(' · ')}>
            <BarEditor tabs={ui.tabs} onChange={(tabs) => save({ tabs })} />
          </Group>
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

/* ── Bottom bar: four slots, each can hold any page; picking a page that's
   already in another slot swaps the two, so there are never duplicates. ── */
function BarEditor({ tabs, onChange }) {
  const rest = PAGE_KEYS.filter((k) => !tabs.includes(k));
  return (
    <div style={{ padding: '12px 16px 14px' }}>
      {/* live preview */}
      <div aria-hidden style={{ display: 'flex', borderRadius: 18, background: 'var(--surface2)', padding: '8px 4px', marginBottom: 12 }}>
        {[...tabs, 'more'].map((k) => {
          const meta = PAGE_META[k] ?? { label: 'More', Icon: LayoutGrid };
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
              {PAGE_KEYS.map((p) => <option key={p} value={p}>{PAGE_META[p].label}</option>)}
            </select>
            <MoveButtons i={i} n={tabs.length} onMove={(d) => onChange(move(tabs, i, d))} label={PAGE_META[k].label} />
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
        {rest.length ? <>In <strong>More</strong>: {rest.map((k) => PAGE_META[k].label).join(', ')}, and Profile.</> : 'Profile is in More.'}
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

/* A tiny picture of the theme: a page with a card and two lines of text. */
function ThemeSwatch({ swatch }) {
  const one = ([bg, card, ink], style) => (
    <div style={{ background: bg, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <div style={{ background: card, borderRadius: 5, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 3, width: '70%', borderRadius: 2, background: ink, opacity: 0.85 }} />
        <div style={{ height: 3, width: '45%', borderRadius: 2, background: ink, opacity: 0.35 }} />
      </div>
    </div>
  );
  const light = ['#F2F3F7', '#FFFFFF', '#1D1D1F'];
  const dark = ['#0B0E14', '#161A23', '#ECEEF3'];
  return (
    <div style={{ display: 'flex', height: 46, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {swatch ? one(swatch, { flex: 1 }) : (<>{one(light, { flex: 1 })}{one(dark, { flex: 1 })}</>)}
    </div>
  );
}
