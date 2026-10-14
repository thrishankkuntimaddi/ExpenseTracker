// ─── Currency picker ─────────────────────────────────────────────
// A native <select> (fast, keyboard- and screen-reader-friendly, the phone's
// own wheel on Android) grouped like the list in utils/money.js.
// `compact` shows just the code — for a chip next to an amount field.
import { CURRENCY_GROUPS, CURRENCY_NAMES, currencySymbol } from '../utils/money';
import { fieldStyle } from './formTokens';

export default function CurrencySelect({ value, onChange, compact = false, id, style, title = 'Currency', recent = [] }) {
  const recents = recent.filter((c, i) => CURRENCY_NAMES[c] && recent.indexOf(c) === i).slice(0, 4);
  const label = (c) => (compact ? c : `${c} · ${CURRENCY_NAMES[c]} (${currencySymbol(c)})`);
  return (
    <select id={id} value={value} title={title} aria-label={title} onChange={(e) => onChange(e.target.value)}
      style={compact
        ? { ...fieldStyle, width: 'auto', padding: '0 6px', fontSize: 12, fontWeight: 700, flex: '0 0 auto', ...style }
        : { ...fieldStyle, ...style }}>
      {recents.length > 0 && (
        <optgroup label="Recent">
          {recents.map((c) => <option key={`r-${c}`} value={c}>{label(c)}</option>)}
        </optgroup>
      )}
      {CURRENCY_GROUPS.map((g) => (
        <optgroup key={g.title} label={g.title}>
          {g.codes.filter((c) => !recents.includes(c)).map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
