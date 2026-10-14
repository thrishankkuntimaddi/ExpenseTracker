// ─── ShareBillingModal ────────────────────────────────────────────
import { useCallback } from 'react';
import ShareSummaryModal from '../../components/ShareSummaryModal';
import { formatSessionTextSummary, generateSessionReceiptBlob } from './shareHelpers';

export default function ShareBillingModal({ session, onClose }) {
  const makeImage = useCallback(() => generateSessionReceiptBlob(session), [session]);
  return <ShareSummaryModal title={`Share “${session.name || 'Billing'}”`} subtitle="Every item, everyone who paid back, the net." text={formatSessionTextSummary(session)} makeImage={makeImage} filename={`${session.name || 'billing'}_receipt`} onClose={onClose} />;
}
