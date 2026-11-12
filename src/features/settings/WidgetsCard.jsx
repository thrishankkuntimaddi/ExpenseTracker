// ─── Home-screen widgets (Android) ───────────────────────────────
// settings.widgets = { headline: 'safe' | 'left' | 'spent', chart, theme }
import { useEffect, useState } from 'react';
import { widgetsAvailable, widgetCount } from '../../native/intake';
import { WIDGET_DEFAULTS } from '../../utils/widgetData';
import { DOWNLOADS_URL } from '../../config/sites';

const Chip = ({ id, on, onClick, children }) => (
  <button id={id} role="radio" aria-checked={on} onClick={onClick}
    style={{ padding: '6px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' }}>{children}</button>
);

export default function WidgetsCard({ settings, onPatchSettings }) {
  const ready = widgetsAvailable();
  const [placed, setPlaced] = useState(null);
  useEffect(() => { if (ready) widgetCount().then(setPlaced); }, [ready]);
  const w = { ...WIDGET_DEFAULTS, ...(settings?.widgets ?? {}) };
  const set = (patch) => onPatchSettings?.({ widgets: { ...w, ...patch } });

  if (!ready) {
    return (
      <div id="widgets-update" style={{ padding: '12px 16px 16px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        Widgets need the newest Android app (3.28 or later). Install it once from{' '}
        <a href={DOWNLOADS_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>the download page</a>
        {' '}— your data stays as it is.
      </div>
    );
  }
  const row = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 };
  const label = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', width: '100%' };
  return (
    <div id="widgets-card" style={{ padding: '12px 16px 16px' }}>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
        {placed ? `${placed} on your home screen. ` : ''}Touch and hold an empty spot on your home screen → <strong>Widgets</strong> → <strong>Expense Tracker</strong>: Quick add, This month and Bills due.
      </p>
      <div role="radiogroup" aria-label="Big number" style={row}>
        <span style={label}>This month shows</span>
        <Chip id="w-headline-safe" on={w.headline === 'safe'} onClick={() => set({ headline: 'safe' })}>Safe to spend today</Chip>
        <Chip id="w-headline-left" on={w.headline === 'left'} onClick={() => set({ headline: 'left' })}>Left in budget</Chip>
        <Chip id="w-headline-spent" on={w.headline === 'spent'} onClick={() => set({ headline: 'spent' })}>Spent this month</Chip>
      </div>
      <div role="radiogroup" aria-label="Chart" style={row}>
        <span style={label}>Seven-day chart</span>
        <Chip id="w-chart-on" on={w.chart} onClick={() => set({ chart: true })}>Show</Chip>
        <Chip id="w-chart-off" on={!w.chart} onClick={() => set({ chart: false })}>Hide</Chip>
      </div>
      <div role="radiogroup" aria-label="Widget theme" style={row}>
        <span style={label}>Quick add & Bills look</span>
        <Chip id="w-theme-auto" on={w.theme === 'auto'} onClick={() => set({ theme: 'auto' })}>Follow phone</Chip>
        <Chip id="w-theme-light" on={w.theme === 'light'} onClick={() => set({ theme: 'light' })}>Light</Chip>
        <Chip id="w-theme-dark" on={w.theme === 'dark'} onClick={() => set({ theme: 'dark' })}>Dark</Chip>
      </div>
    </div>
  );
}
