// ─── Profile → Supporter ─────────────────────────────────────────
// Everything stays free. Supporters get a badge and new features first.
// Earned by inviting friends (REF_DAYS each, once they add an entry);
// paying is built but off (PAID_SUPPORT) until the payment server runs.
import { Heart, Gift, Sparkles, BadgeCheck } from 'lucide-react';
import { REF_DAYS, PAID_SUPPORT } from '../../utils/supporter';
import { t as tr } from '../../i18n';

const fmt = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function SupporterCard({ status: s, settings, onPatchSettings, onInvite }) {
  const early = !!settings?.earlyAccess;
  const perk = (Icon, title, sub) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Icon size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{sub}</div></div>
    </div>
  );
  return (
    <div id="supporter" style={{ padding: '14px 16px 16px', display: 'grid', gap: 14 }}>
      <div style={{ padding: '12px 14px', borderRadius: 14, background: s.active ? 'var(--accent-bg)' : 'var(--surface2)', border: `1px solid ${s.active ? 'var(--accent-border)' : 'var(--border)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
          <Heart size={16} style={{ color: s.active ? 'var(--accent)' : 'var(--text-muted)' }} fill={s.active ? 'currentColor' : 'none'} />
          {s.active ? tr('You’re a supporter') : tr('Everything is free')}
        </div>
        <div id="supporter-status" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
          {s.active
            ? `${tr('Until')} ${fmt(s.until)} · ${s.daysLeft} ${tr('days left')}`
            : tr('No limits, no ads. Supporters just get a few extras — invite friends to become one.')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          {s.joined} {tr('friends joined with your link')} · {s.counted} {tr('started using it')}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <p className="section-label" style={{ margin: 0 }}>{tr('Supporter extras')}</p>
        {perk(BadgeCheck, tr('Supporter badge'), tr('On your profile — a thank-you for spreading the word.'))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Sparkles size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr('New features first')}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{tr('Try what’s coming before everyone else.')}</div></div>
          <button id="early-access-toggle" className={`toggle-track ${s.active && early ? 'on' : ''}`} disabled={!s.active} aria-pressed={s.active && early} aria-label={tr('New features first')}
            onClick={() => onPatchSettings?.({ earlyAccess: !early })} style={{ flexShrink: 0, opacity: s.active ? 1 : 0.45 }}>
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p className="section-label" style={{ margin: 0 }}>{tr('How to become one')}</p>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {tr('Send a friend your invite link. When they make an account and add their first entry, you get')} <strong>{REF_DAYS} {tr('supporter days')}</strong>. {tr('More friends, more days — they add up.')}
        </div>
        <button id="supporter-invite" onClick={onInvite} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 'none', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <Gift size={14} /> {tr('Invite a friend')}
        </button>
        {PAID_SUPPORT && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tr('Or support with money — coming soon.')}</div>
        )}
      </div>
    </div>
  );
}
