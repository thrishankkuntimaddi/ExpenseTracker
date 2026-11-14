// ─── Demo: the banner, locked pages and the demo profile ─────────
import { Sparkles, Users, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
import { endDemo } from './demo';
import { PageHeader, EmptyState, PrimaryPill } from '../components/Page';

import { t as tr } from '../i18n';
export function DemoBanner() {
  return (
    <div id="demo-banner" className="demo-banner" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 14px', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600, boxShadow: '0 10px 28px -10px rgba(0,0,0,0.18)' }}>
      <Sparkles size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>{tr("Demo · sample data, nothing is saved")}</span>
      <button id="demo-signup" onClick={() => endDemo(true)} style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,.6)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {tr("Create free account")}
      </button>
    </div>
  );
}

export function DemoLocked({ what }) {
  return (
    <div className="tab-root">
      <PageHeader title={what} subtitle={tr("Shared with friends, live")} />
      <div className="tab-body">
        <EmptyState Icon={Users} title={tr("Made for sharing")} tone="external"
          text={`${what} sync between people’s phones, so they need a real account. Create one — it’s free — and invite your friends with a link.`}
          action={<PrimaryPill id="demo-locked-signup" Icon={UserPlus} tone="external" onClick={() => endDemo(true)}>{tr("Create free account")}</PrimaryPill>} />
      </div>
    </div>
  );
}

export function DemoProfile() {
  return (
    <div className="tab-root">
      <PageHeader title={tr("Demo")} subtitle={tr("Try anything — it all resets when you close this tab")} />
      <div className="tab-body">
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{tr("Like what you see?")}</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '6px 0 14px' }}>
            {tr("A free account keeps your entries in sync across your phone and computer, with reminders, backups to your own Google Drive and an app lock.")}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PrimaryPill id="demo-profile-signup" Icon={UserPlus} onClick={() => endDemo(true)}>{tr("Create free account")}</PrimaryPill>
            <button id="demo-exit" onClick={() => endDemo(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer' }}>
              <LogOut size={14} /> {tr("Leave the demo")}
            </button>
          </div>
        </div>
        <div className="card" style={{ padding: 16, marginTop: 12, display: 'flex', gap: 12 }}>
          <ShieldCheck size={20} style={{ color: 'var(--income)', flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text)' }}>{tr("Your money stays yours.")}</strong> {tr("No ads, no selling or sharing your data, no bank access. Only you can read your entries — the database rules allow no one else.")}{' '}
            <a href="https://thrishankkuntimaddi.github.io/ExpenseTracker/privacy.html" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>{tr("Privacy policy")}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
