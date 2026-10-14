// ─── TripShareModal ───────────────────────────────────────────────
// The trip as an image and as text — both carry everything: totals, who
// pays whom, what's paid, paid vs share, wallets, categories, every row.
import { useCallback } from 'react';
import ShareSummaryModal from '../../components/ShareSummaryModal';
import { tripSummaryText } from '../../utils/split';
import { formatAmount } from '../../utils/dateHelpers';
import { tripImageBlob } from './tripCard';

export default function TripShareModal({ trip, onClose }) {
  const text = tripSummaryText(trip, (n) => formatAmount(n, trip.currency));
  const makeImage = useCallback(() => tripImageBlob(trip), [trip]);
  return <ShareSummaryModal title={`Share “${trip.name}”`} subtitle="Send the picture or the text to the group." text={text} makeImage={makeImage} filename={`${trip.name}_trip`} onClose={onClose} />;
}
