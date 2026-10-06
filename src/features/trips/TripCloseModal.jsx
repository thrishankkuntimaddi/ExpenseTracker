// ─── TripCloseModal ───────────────────────────────────────────────
// Closing a trip can post to the personal ledger in one go:
//   • my share of the trip as a Travel expense
//   • what others still owe me as "Lent" entries (per wallet)
//   • what I still owe as "Borrowed" entries
// Ids are deterministic (trip id + wallet) so re-closing never duplicates.
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { formatAmount } from '../../utils/dateHelpers';

export default function TripCloseModal({ trip, summary, onConfirm, onClose }) {
  const hasMe = !!trip.meMemberId;
  const [logShare, setLogShare] = useState(hasMe && summary.myShare > 0);
  const [logLent, setLogLent] = useState(hasMe && summary.owedToMe.length > 0);
  const [logBorrowed, setLogBorrowed] = useState(hasMe && summary.iOwe.length > 0);

  const owed = summary.owedToMe.reduce((s, t) => s + t.amount, 0);
  const iOwe = summary.iOwe.reduce((s, t) => s + t.amount, 0);

  return (
    <ModalShell title="Close trip" subtitle="Lock the trip and update your own ledger." onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => onConfirm({ logShare, logLent, logBorrowed })} color="var(--external)"><Lock size={14} /> Close trip</PrimaryButton>
      </>}
    >
      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>{trip.name}</strong> · {formatAmount(summary.total)} across {summary.members.length} people
        {summary.isSettled ? ' · fully settled ✓' : ` · ${formatAmount(summary.outstanding)} still to settle`}
      </div>

      {!hasMe ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tick who you are in “Edit trip” to post your share and dues to your ledger.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Opt checked={logShare} onChange={setLogShare} disabled={!(summary.myShare > 0)}
            title={`Log my share as an expense — ${formatAmount(summary.myShare)}`} sub="Category: Travel. This is what the trip really cost you." />
          <Opt checked={logLent} onChange={setLogLent} disabled={!summary.owedToMe.length}
            title={`Record what others owe me as Lent — ${formatAmount(owed)}`} sub={summary.owedToMe.map((t) => `${t.fromName} ${formatAmount(t.amount)}`).join(' · ') || 'Nobody owes you'} />
          <Opt checked={logBorrowed} onChange={setLogBorrowed} disabled={!summary.iOwe.length}
            title={`Record what I owe as Borrowed — ${formatAmount(iOwe)}`} sub={summary.iOwe.map((t) => `${t.toName} ${formatAmount(t.amount)}`).join(' · ') || 'You owe nobody'} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Reopening the trip removes these entries again (they go to Recently Deleted).</div>
        </div>
      )}
    </ModalShell>
  );
}

function Opt({ checked, onChange, disabled, title, sub }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${checked && !disabled ? 'var(--external-border)' : 'var(--border)'}`, background: checked && !disabled ? 'var(--external-bg)' : 'transparent', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--external)' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>{checked && !disabled && <Check size={12} style={{ color: 'var(--external)' }} />}{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </label>
  );
}
