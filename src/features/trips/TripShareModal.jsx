// ─── TripShareModal ───────────────────────────────────────────────
import { useState } from 'react';
import { Copy, Share2, Check } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { tripSummaryText } from '../../utils/split';
import { formatAmount } from '../../utils/dateHelpers';

export default function TripShareModal({ trip, onClose }) {
  const text = tripSummaryText(trip, (n) => formatAmount(n));
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  }
  async function share() {
    try { await navigator.share({ title: `${trip.name} — trip summary`, text }); } catch { /* cancelled */ }
  }

  return (
    <ModalShell title="Share summary" subtitle="Paste into the group chat." onClose={onClose}
      footer={<>
        <GhostButton onClick={copy}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</GhostButton>
        {canShare && <PrimaryButton onClick={share} color="var(--external)"><Share2 size={14} /> Share…</PrimaryButton>}
      </>}
    >
      <textarea readOnly value={text} rows={Math.min(16, text.split('\n').length + 1)} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
    </ModalShell>
  );
}
