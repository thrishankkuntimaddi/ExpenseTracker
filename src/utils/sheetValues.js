// Values typed or pasted into a Sheet (components/Sheet.jsx).

/** "120+80*2" → 280 · "1,200" → 1200 · invalid → NaN */
export function evalAmount(text) {
  const t = String(text ?? '').replace(/[₹$€£¥₩₫₱₦₪฿,\s]|[A-Z]{3}/g, '');
  if (!t) return NaN;
  if (!/^[\d.+\-*/]+$/.test(t) || /^[+*/]|[+\-*/]$/.test(t) || /[+\-*/]{2}/.test(t)) return NaN;
  const tokens = t.match(/\d*\.?\d+|[+\-*/]/g);
  if (!tokens || tokens.join('') !== t) return NaN;
  // two passes: * and / first, then + and -
  const terms = []; let op = '+';
  let i = 0;
  if (tokens[0] === '-') { op = '-'; i = 1; }   // "-50"
  const num = () => { const n = Number(tokens[i++]); return Number.isFinite(n) ? n : NaN; };
  let acc = num();
  while (i <= tokens.length) {
    const next = tokens[i];
    if (next === '*' || next === '/') { i++; const b = num(); acc = next === '*' ? acc * b : acc / b; continue; }
    terms.push(op === '-' ? -acc : acc);
    if (next === undefined) break;
    op = next; i++; acc = num();
  }
  const total = terms.reduce((s, x) => s + x, 0);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : NaN;
}

/** "14/10/2026", "2026-10-14", "14-10-26" → "2026-10-14" (or '' if not a date) */
export function parseDateText(text) {
  const t = String(text ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}
