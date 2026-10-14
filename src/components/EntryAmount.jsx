// An entry's amount as it was paid; for another currency, the converted
// figure sits underneath in small type ("$30.00" / "≈ ₹2,850").
import { formatMoney, formatMoneyCompact, getDisplayCurrency } from '../utils/money';

export default function EntryAmount({ entry, amount = entry?.amount, prefix = '' }) {
  const o = entry?.orig;
  if (!o || o.currency === getDisplayCurrency() || typeof o.amount !== 'number') {
    return <>{prefix}{formatMoney(amount, !o && entry?.currency ? entry.currency : getDisplayCurrency())}</>;
  }
  const share = entry.amount ? amount / entry.amount : 1;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
      <span>{prefix}{formatMoney(Math.abs(o.amount * share), o.currency)}</span>
      <span style={{ fontSize: '0.72em', fontWeight: 600, opacity: 0.7 }}>≈ {formatMoneyCompact(Math.abs(amount))}</span>
    </span>
  );
}
