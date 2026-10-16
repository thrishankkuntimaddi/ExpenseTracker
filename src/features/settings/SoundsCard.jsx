// ─── Profile → Sounds ─────────────────────────────────────────────
// On/off, volume, and each kind of sound — with a play button to hear it.
// Per device (a phone and a laptop can differ). See sound/sound.js.
import { Play, Volume1, Volume2 } from 'lucide-react';
import { useSoundPrefs, setSoundPrefs, SOUND_KINDS, play } from '../../sound/sound';


export default function SoundsCard() {
  const p = useSoundPrefs();
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border)' };
  return (
    <div id="sounds-card">
      <div style={{ ...row, borderTop: 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Sounds</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Made by the app itself — on this device only</div>
        </div>
        <Toggle id="sounds-on" on={p.on} label="Sounds" onClick={() => setSoundPrefs({ on: !p.on })} />
      </div>

      <div style={{ ...row, opacity: p.on ? 1 : 0.5 }}>
        <Volume1 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input id="sounds-volume" type="range" min="0" max="1" step="0.05" value={p.volume} disabled={!p.on} aria-label="Volume"
          onChange={(e) => setSoundPrefs({ volume: Number(e.target.value) })}
          onPointerUp={() => play('debit', { force: true })} onKeyUp={() => play('tap', { force: true })}
          style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <Volume2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {SOUND_KINDS.map((k) => (
        <div key={k.key} style={{ ...row, opacity: p.on ? 1 : 0.5 }}>
          <button type="button" id={`sound-try-${k.key}`} aria-label={`Play ${k.label}`} onClick={() => play(k.demo, { force: true })} data-no-tap-sound
            style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Play size={13} fill="currentColor" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)' }}>{k.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{k.hint}</div>
          </div>
          <Toggle id={`sound-${k.key}`} on={!!p[k.key]} label={k.label} disabled={!p.on} onClick={() => setSoundPrefs({ [k.key]: !p[k.key] })} />
        </div>
      ))}
    </div>
  );
}

function Toggle({ id, on, label, onClick, disabled }) {
  return (
    <button id={id} type="button" className={`toggle-track ${on ? 'on' : ''}`} aria-label={label} aria-pressed={on} onClick={onClick} disabled={disabled} style={{ flexShrink: 0 }}>
      <span className="toggle-thumb" />
    </button>
  );
}
