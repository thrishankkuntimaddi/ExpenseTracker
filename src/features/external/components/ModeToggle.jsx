// ─── Billings ⇄ Trips segmented switch ────────────────────────────
import { ReceiptText, Map } from 'lucide-react';

export default function ModeToggle({ mode, onChange }) {
  const opts = [
    { key: 'billings', label: 'Billings', Icon: ReceiptText, hint: 'paid on behalf of someone' },
    { key: 'trips',    label: 'Trips & Splits', Icon: Map, hint: 'shared spending, settle fairly' },
  ];
  return (
    <div role="tablist" aria-label="Billings mode" style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 12, padding: 3, border: '1px solid var(--border)' }}>
      {opts.map((o) => {
        const active = mode === o.key;
        return (
          <button key={o.key} role="tab" aria-selected={active} id={`billings-mode-${o.key}`} onClick={() => onChange(o.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 6px', borderRadius: 9, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: active ? 'var(--external)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s',
          }}>
            <o.Icon size={13} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
