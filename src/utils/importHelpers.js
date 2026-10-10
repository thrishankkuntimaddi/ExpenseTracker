// ─── Import helpers (CSV / Google Sheets) ────────────────────────
// Pure functions — no Firestore access — so they can be unit-tested.
import { dateInputToISO, isoToMonth, todayInputValue } from './dateHelpers';

/**
 * RFC 4180 CSV parser: handles quoted fields, embedded commas, escaped
 * quotes ("") and newlines inside quotes, plus CRLF line endings.
 * @returns {string[][]} rows of trimmed cells (blank rows dropped)
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''));
}

/** Parse "1,200.50", "₹ 1200", "$12" → 1200.5 / 1200 / 12 (NaN if not a number). */
export function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '');
  return cleaned ? Number(cleaned) : NaN;
}

/** Small deterministic string hash (FNV-1a, 32-bit) → base36. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Deterministic id for an imported record. The same input always yields the
 * same id, so re-importing a file overwrites instead of duplicating.
 * `occurrence` distinguishes genuinely repeated rows within one file
 * (e.g. two identical coffees on the same day).
 */
export function importId(prefix, parts, occurrence = 0) {
  return `${prefix}_${hashString([...parts, occurrence].join('|'))}`;
}

/** Turn any date-ish CSV cell into a local-noon ISO string (or null). */
export function normaliseDate(raw) {
  if (!raw) return null;
  // YYYY-MM-DD → local noon (avoids UTC shifting the day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return dateInputToISO(raw);
  // DD/MM/YYYY or DD-MM-YYYY (Indian format, as exported by this app)
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return dateInputToISO(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  const parsed = new Date(raw);
  return isNaN(parsed) ? null : parsed.toISOString();
}

const TXN_TYPES = ['savings', 'person', 'expense'];

/**
 * Convert CSV text into { transactions, income, skipped }.
 * Required columns: name|description and amount. Optional: date, type.
 * Throws an Error with a user-facing message on structural problems.
 */
export function csvToRecords(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV is empty.');

  const header = rows[0].map((h) => h.toLowerCase());
  const col = (...names) => names.map((n) => header.indexOf(n)).find((i) => i !== -1) ?? -1;
  const dateCol = col('date');
  const nameCol = col('name', 'description');
  const amtCol  = col('amount');
  const typeCol = col('type');
  if (amtCol === -1 || nameCol === -1) {
    throw new Error('CSV must have "name"/"description" and "amount" columns.');
  }

  const transactions = [];
  const income = [];
  const seen = {};
  let skipped = 0;

  rows.slice(1).forEach((cols) => {
    const name    = (cols[nameCol] || '').slice(0, 500);   // rules cap names at 500 chars
    const amount  = parseAmount(cols[amtCol]);
    const rawType = (cols[typeCol] || 'expense').toLowerCase();
    const date    = normaliseDate(dateCol !== -1 ? cols[dateCol] : '') ?? dateInputToISO(todayInputValue());
    if (!name || !Number.isFinite(amount) || amount <= 0 || amount >= 1e12) { skipped++; return; }

    const isIncome = rawType === 'income';
    const type     = isIncome ? 'income' : (TXN_TYPES.includes(rawType) ? rawType : 'expense');
    const key      = [type, date.slice(0, 10), name.toLowerCase(), amount];
    const occ      = seen[key.join('|')] = (seen[key.join('|')] ?? -1) + 1;
    const record   = { id: importId('csv', key, occ), name, amount, type, date, month: isoToMonth(date) };

    (isIncome ? income : transactions).push(record);
  });

  return { transactions, income, skipped };
}
