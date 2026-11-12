// ─── Invite a friend ─────────────────────────────────────────────
// The message carries your invite link (?ref=CODE): a friend who makes an
// account with it and adds an entry gives you supporter days.
import { useEffect, useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { APP_URL } from '../../config/sites';
import { ensureMyCode } from '../../services/referrals';
import { REF_DAYS } from '../../utils/supporter';

import { t as tr } from '../../i18n';
const inviteFriendText = (name, code) => [
  `${name ? `${name} here — ` : ''}I track my money with Expense Tracker: every rupee in one place, bills that remind you, trips split fairly, and a monthly report.`,
  'Free, no ads, and it never asks for bank access.',
  '',
  `Try it — no account needed to look around: ${APP_URL}?demo=1${code ? `&ref=${code}` : ''}`,
].join('\n');

export default function InviteFriendCard({ name, uid }) {
  const [done, setDone] = useState('');
  const [codeOf, setCodeOf] = useState({ uid: null, code: null });
  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    ensureMyCode(uid).then((code) => { if (live) setCodeOf({ uid, code }); }).catch(() => {});
    return () => { live = false; };
  }, [uid]);
  const code = codeOf.uid === uid ? codeOf.code : null;
  const text = inviteFriendText(name, code);
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
      {code && (
        <p id="invite-code" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '10px 0 0' }}>
          {tr('Your invite code')} <strong style={{ color: 'var(--text)', letterSpacing: '0.08em' }}>{code}</strong> · {tr('each friend who joins and adds an entry gives you')} {REF_DAYS} {tr('supporter days')}
        </p>
      )}
    </div>
  );
}
