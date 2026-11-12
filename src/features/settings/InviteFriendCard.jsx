// ─── Invite a friend ─────────────────────────────────────────────
import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { APP_URL } from '../../config/sites';

import { t as tr } from '../../i18n';
const inviteFriendText = (name) => [
  `${name ? `${name} here — ` : ''}I track my money with Expense Tracker: every rupee in one place, bills that remind you, trips split fairly, and a monthly report.`,
  'Free, no ads, and it never asks for bank access.',
  '',
  `Try it — no account needed to look around: ${APP_URL}?demo=1`,
].join('\n');

export default function InviteFriendCard({ name }) {
  const [done, setDone] = useState('');
  const text = inviteFriendText(name);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone('copy'); setTimeout(() => setDone(''), 1500); } catch { /* blocked */ } };
  const share = async () => { try { await navigator.share({ title: tr("Expense Tracker"), text }); } catch { /* cancelled */ } };
  const btn = (primary) => ({ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  return (
    <div id="invite-friend" style={{ padding: '12px 16px 16px' }}>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 10px' }}>{tr("Know someone who keeps losing track of where the money goes? Send them this:")}</p>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text)', background: 'var(--input-bg)', border: '1px solid var(--border)', padding: '10px 12px', margin: 0, lineHeight: 1.5 }}>{text}</pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {canShare && <button id="invite-share" onClick={share} style={btn(true)}><Share2 size={14} /> {tr("Share")}</button>}
        <button id="invite-copy" onClick={copy} style={btn(!canShare)}>{done === 'copy' ? <Check size={14} /> : <Copy size={14} />} {done === 'copy' ? tr("Copied") : tr("Copy message")}</button>
      </div>
    </div>
  );
}
