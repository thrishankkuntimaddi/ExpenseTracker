// ─── BigAmount ───────────────────────────────────────────────────
// The app's headline figure (Stats timeline, page summaries): the symbol
// small and raised, the rupees large, the paise small — ₹5,809.74.
import { currencySymbol } from '../utils/money';

export default function BigAmount({ value = 0, size = 46, color, paise = true, currency, id }) {
  const neg = value < 0;
  const abs = Math.abs(Number(value) || 0);
  const whole = Math.floor(abs).toLocaleString('en-IN');
  const p = String(Math.round((abs % 1) * 100)).padStart(2, '0');
  const sym = currencySymbol(currency);
  return (
    <span id={id} className="tl-big" style={{ fontSize: size, ...(color ? { color } : {}) }} aria-label={`${neg ? 'minus ' : ''}${sym}${whole}.${p}`}>
      {neg && <span className="tl-minus">−</span>}
      <span className="tl-sym">{sym}</span>
      <span>{whole}</span>
      {paise && <span className="tl-paise">.{p}</span>}
    </span>
  );
}
