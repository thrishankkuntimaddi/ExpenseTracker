// ─── Bank statements → entries ───────────────────────────────────
// Reads the rows of a bank statement (CSV, Excel, or the table in a PDF) the
// way Indian banks lay them out — HDFC, SBI, ICICI, Axis, Kotak, Yes, IDFC,
// PNB, BoB, Canara, Union … — whatever they call the columns, and turns each
// line into an expense, money in, or a cash withdrawal with a clean name.
// Everything here is pure (no files, no network) and unit-tested.
import { importId } from './importHelpers';
import { inferCategory } from './categories';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "12/11/2026", "12-11-26", "12 Nov 2026", "12-NOV-26", "2026-11-12", Excel serial → 'YYYY-MM-DD' | null */
export function parseDateIN(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !isNaN(raw)) return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {          // Excel serial date
    const d = new Date(Math.round((raw - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/., ]+(\d{2,4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad(mi + 1)}-${pad(m[1])}`;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mo = Number(m[2]), d = Number(m[1]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

/** "1,23,456.78", "₹ 500", "(250.00)", "1,200.00 Dr", "-" → { value, sign: -1|1|0 } (value NaN when blank) */
export function parseAmountIN(raw) {
  if (raw == null) return { value: NaN, sign: 0 };
  if (typeof raw === 'number') return { value: Math.abs(raw), sign: raw < 0 ? -1 : raw > 0 ? 1 : 0 };
  const s = String(raw).trim();
  if (!s || /^[-–—]$/.test(s)) return { value: NaN, sign: 0 };
  const dr = /\b(dr|debit|d)\.?$/i.test(s), cr = /\b(cr|credit|c)\.?$/i.test(s);
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[₹\s]/g, ''));
  const num = Number(s.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || !/\d/.test(s)) return { value: NaN, sign: 0 };
  return { value: num, sign: dr || neg ? -1 : cr ? 1 : 0 };
}

const H = {
  date: /^(txn\.?|tran\.?|transaction|posting|post|book(ing)?)?\s*(date|dt\.?)$|^date$/i,
  valueDate: /^value\s*(date|dt\.?)$/i,
  desc: /narration|description|particulars|remarks|details|transaction\s*details|transaction\s*remarks/i,
  debit: /withdrawal|debit|^dr\.?$|paid\s*out|^out$/i,
  credit: /deposit|credit|^cr\.?$|paid\s*in|^in$/i,
  amount: /^(txn\.?|transaction)?\s*amount(\s*\(.*\))?$|^amt\.?$/i,
  type: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|txn\s*type|debit\s*\/\s*credit)$/i,
  balance: /balance/i,
  ref: /(chq|cheque|ref).*(no|number)?/i,
};

/** Which column is which, from one header row; null when it isn't a header. */
export function readHeader(row) {
  const cells = row.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim());
  const find = (re, not = []) => cells.findIndex((c, i) => re.test(c) && !not.includes(i));
  const date = find(H.date);
  const valueDate = find(H.valueDate);
  const desc = find(H.desc);
  const balance = find(H.balance);
  const debit = find(H.debit, [balance]);
  const credit = find(H.credit, [balance, debit]);
  const amount = debit < 0 ? find(H.amount) : -1;
  const type = find(H.type);
  const dateCol = date >= 0 ? date : valueDate;
  if (dateCol < 0 || desc < 0) return null;
  if (!(debit >= 0 && credit >= 0) && amount < 0 && balance < 0) return null;
  return { date: dateCol, desc, debit, credit, amount, type, balance };
}

/**
 * Rows (arrays of cells) → statement lines { date, desc, amount, dir: 'out'|'in', balance? }.
 * Finds the header anywhere in the first 60 rows (banks put the account
 * details above it), joins narrations that wrap onto a second row, and
 * skips opening/closing balance and total rows.
 */
export function rowsToLines(rows) {
  let at = -1, cols = null;
  for (let i = 0; i < Math.min(rows.length, 60) && !cols; i++) { cols = readHeader(rows[i] || []); if (cols) at = i; }
  if (!cols) return { lines: [], header: false };
  const lines = [];
  let prevBalance = null;
  for (const r of rows.slice(at + 1)) {
    const cell = (i) => (i >= 0 ? r[i] : undefined);
    const date = parseDateIN(cell(cols.date));
    const desc = String(cell(cols.desc) ?? '').replace(/\s+/g, ' ').trim();
    if (!date) {
      // a narration that wrapped onto the next row
      if (lines.length && desc && !/^(opening|closing)\s*balance|^total/i.test(desc) && !r.some((c, i) => i !== cols.desc && /\d{2,}/.test(String(c ?? '')))) lines[lines.length - 1].desc += ` ${desc}`;
      continue;
    }
    if (/^(opening|closing)\s*balance|^b\/f|^c\/f|brought forward|carried forward/i.test(desc)) {
      const b = parseAmountIN(cell(cols.balance)); if (Number.isFinite(b.value)) prevBalance = b.value * (b.sign < 0 ? -1 : 1);
      continue;
    }
    let amount = NaN, dir = null;
    const d = parseAmountIN(cell(cols.debit)), c = parseAmountIN(cell(cols.credit));
    if (Number.isFinite(d.value) && d.value > 0) { amount = d.value; dir = 'out'; }
    else if (Number.isFinite(c.value) && c.value > 0) { amount = c.value; dir = 'in'; }
    else if (cols.amount >= 0) {
      const a = parseAmountIN(cell(cols.amount));
      const t = String(cell(cols.type) ?? '').trim().toLowerCase();
      if (Number.isFinite(a.value) && a.value > 0) {
        amount = a.value;
        dir = /^(dr|d|debit|withdrawal)/.test(t) || a.sign < 0 ? 'out' : /^(cr|c|credit|deposit)/.test(t) || a.sign > 0 ? 'in' : null;
      }
    }
    const bal = parseAmountIN(cell(cols.balance));
    const balance = Number.isFinite(bal.value) ? bal.value * (bal.sign < 0 ? -1 : 1) : null;
    // No direction yet (one amount column, no Dr/Cr): the balance moving tells us
    if (amount > 0 && !dir && balance != null && prevBalance != null) dir = balance < prevBalance ? 'out' : 'in';
    if (balance != null) prevBalance = balance;
    if (!(amount > 0) || !dir) continue;
    lines.push({ date, desc, amount: Math.round(amount * 100) / 100, dir, balance });
  }
  return { lines, header: true };
}

/* ── Narrations → names ─────────────────────────────────────────── */
const SMALL = new Set(['of', 'and', 'the', 'for', 'to', 'in', 'pvt', 'ltd']);
export const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  .replace(/\b(Of|And|The|For|To|In)\b/g, (w) => w.toLowerCase())
  .replace(/\b(Pvt|Ltd|Llp)\b/gi, (w) => (SMALL.has(w.toLowerCase()) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
  .replace(/^./, (ch) => ch.toUpperCase());

const NOISE = /^(upi|dr|cr|p2a|p2m|p2p|neft|imps|rtgs|mmt|ach|nach|ecs|pos|ecom|pcd|vps|vin|ref|payment|pay|paid|collect|request|txn|trf|tfr|to|from|by|via|ib|mb|net|banking|inb|bil|onl|online|sent|received|mobile|transfer|fund|funds|self|na|nil|others?|india)$/i;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

/** One narration → { name, channel, cash, salary, autoDebit } */
export function readNarration(desc) {
  const raw = String(desc ?? '').replace(/\s+/g, ' ').trim();
  const up = raw.toUpperCase();
  const channel = /\bUPI\b/.test(up) ? 'upi' : /\b(ATM|ATW|NWD|CWDL|CASH\s*WDL|CASH\s*WITHDRAWAL)\b/.test(up) ? 'atm'
    : /\b(POS|ECOM|PCD|VPS|VIN|DEBIT CARD|CARD)\b/.test(up) ? 'card' : /\bNEFT\b/.test(up) ? 'neft' : /\bIMPS\b/.test(up) ? 'imps'
    : /\bRTGS\b/.test(up) ? 'rtgs' : /\b(ACH|NACH|ECS)\b/.test(up) ? 'ach' : /\b(INT\.?|INTEREST)\s*(PD|CR|CREDIT|PAID)?\b/.test(up) ? 'interest' : 'other';
  const cash = channel === 'atm' || /\bSELF\b.*\b(WDL|WITHDRAWAL)\b/.test(up);
  const salary = /\b(SALARY|SAL\b|PAYROLL)/.test(up);
  const autoDebit = channel === 'ach';
  if (cash) return { name: 'ATM withdrawal', channel, cash, salary, autoDebit };
  if (channel === 'interest') return { name: 'Bank interest', channel, cash, salary, autoDebit };
  const tokens = raw.split(/[/|\-:*#,]+|\s{2,}/).map((t) => t.trim()).filter(Boolean);
  let name = null;
  for (const tok of tokens) {
    const words = tok.split(' ').filter((w) => !NOISE.test(w) && !/@/.test(w) && !IFSC.test(w) && !/\d{4,}/.test(w) && !/^X+\d*$/i.test(w));
    const t = words.join(' ').trim();
    if (!t || /@/.test(tok) || IFSC.test(tok) || /^[A-Z]{4}$/.test(tok) && channel !== 'other' && tok !== tokens[tokens.length - 1]) continue;
    if ((t.match(/[A-Za-z]/g) ?? []).length < 3) continue;
    name = t; break;
  }
  if (name && channel === 'card') name = name.replace(/\s+(IN|IND|INDIA)$/i, '');
  name = name ? titleCase(name).slice(0, 40).trim() : raw.slice(0, 40) || 'Bank entry';
  return { name, channel, cash, salary, autoDebit };
}

/* ── Lines → entries to review ──────────────────────────────────── */
const toISO = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12).toISOString(); };
const dayDiff = (a, b) => Math.abs((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);

/**
 * @param lines   from rowsToLines
 * @param existing { transactions, income } already in the app — matches are marked duplicate
 * @returns items { id, include, duplicate, kind: 'expense'|'income'|'cash', name, amount, date, dateKey, category?, narration, channel }
 */
export function linesToItems(lines, { transactions = [], income = [], rules = {}, source = 'stmt' } = {}) {
  const seen = {};
  const localKey = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const haveLocal = [...transactions.map((t) => ({ k: localKey(t.date), a: Number(t.amount) || 0, inc: false })), ...income.map((i) => ({ k: localKey(i.date), a: Number(i.amount) || 0, inc: true }))];
  return lines.map((l) => {
    const n = readNarration(l.desc);
    const kind = l.dir === 'in' ? 'income' : n.cash ? 'cash' : 'expense';
    const key = [l.date, l.amount, l.dir, l.desc.toLowerCase()];
    const occ = seen[key.join('|')] = (seen[key.join('|')] ?? -1) + 1;
    // Auto-debits (ACH / NACH / ECS) are nearly always EMIs: say so, so the money plan counts them
    let name = n.name, category = kind === 'expense' ? inferCategory(n.name, rules) : null;
    if (kind === 'expense' && n.autoDebit && !/\b(emi|loan|sip|mutual|mf|insurance|premium|lic)\b/i.test(name)) { name = `${name} EMI`; category = 'bills'; }
    const duplicate = haveLocal.some((h) => h.inc === (kind === 'income') && Math.abs(h.a - l.amount) < 0.5 && h.k && dayDiff(h.k, l.date) <= 1);
    return {
      id: importId(source, key, occ), include: !duplicate, duplicate, kind,
      name, amount: l.amount, date: toISO(l.date), dateKey: l.date, category,
      narration: l.desc, channel: n.channel, salary: n.salary, autoDebit: n.autoDebit,
    };
  });
}

/** Ready-to-save records for the chosen items: { transactions, income } */
export function itemsToRecords(items) {
  const transactions = [], income = [];
  for (const it of items) {
    if (!it.include) continue;
    const base = { id: it.id, name: it.name, amount: it.amount, date: it.date, month: it.dateKey.slice(0, 7), source: 'statement', note: it.narration.slice(0, 200) };
    if (it.kind === 'income') income.push(base);
    else if (it.kind === 'cash') transactions.push({ ...base, type: 'cash' });
    else transactions.push({ ...base, type: 'expense', ...(it.category ? { category: it.category } : {}) });
  }
  return { transactions, income };
}

export function summarise(items) {
  const inc = items.filter((i) => i.include);
  const sum = (k) => inc.filter((i) => i.kind === k).reduce((s, i) => s + i.amount, 0);
  return { count: inc.length, out: sum('expense'), cash: sum('cash'), in: sum('income'), duplicates: items.filter((i) => i.duplicate).length };
}

/* ── PDF tables ─────────────────────────────────────────────────── */
/**
 * Text items from a PDF page ({ str, x, y }) → rows of cells. Items on the
 * same baseline form a line; cells are split where the gap between words
 * is wide; once a header is seen, every later cell goes to the column whose
 * header is nearest, so wrapped narrations and right-aligned amounts land
 * in the right place.
 */
export function pdfItemsToRows(pages) {
  const rows = [];
  let anchors = null;
  for (const items of pages) {
    const lines = [];
    for (const it of items.filter((i) => String(i.str).trim())) {
      const line = lines.find((l) => Math.abs(l.y - it.y) < 3);
      if (line) line.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    lines.sort((a, b) => b.y - a.y);   // PDF y grows upwards
    for (const l of lines) {
      const its = l.items.sort((a, b) => a.x - b.x);
      const cells = [];
      for (const it of its) {
        const last = cells[cells.length - 1];
        if (last && it.x - last.end < 6) { last.str += (it.x - last.end > 1 ? ' ' : '') + it.str; last.end = it.x + (it.w ?? it.str.length * 4.5); }
        else cells.push({ str: it.str, x: it.x, end: it.x + (it.w ?? it.str.length * 4.5) });
      }
      const texts = cells.map((c) => c.str.trim());
      if (!anchors && readHeader(texts)) {
        anchors = cells.map((c) => (c.x + c.end) / 2);
        rows.push(texts);
        continue;
      }
      if (anchors && readHeader(texts)) continue;   // the header repeated on a later page
      if (!anchors) { rows.push(texts); continue; }
      const row = new Array(anchors.length).fill('');
      for (const c of cells) {
        const mid = (c.x + c.end) / 2;
        let best = 0;
        anchors.forEach((a, i) => { if (Math.abs(a - mid) < Math.abs(anchors[best] - mid)) best = i; });
        row[best] = row[best] ? `${row[best]} ${c.str.trim()}` : c.str.trim();
      }
      rows.push(row);
    }
  }
  return rows;
}

/**
 * Last resort for PDFs whose table can't be read by columns: lines that start
 * with a date and end with amounts; the balance moving decides in or out.
 */
export function textLinesToLines(textLines) {
  const out = [];
  let prev = null;
  for (const raw of textLines) {
    const s = raw.replace(/\s+/g, ' ').trim();
    const date = parseDateIN(s);
    const nums = [...s.matchAll(/(-?[\d,]+\.\d{2})(\s*(Dr|Cr))?/gi)];
    if (!date && /opening\s*balance|b\/f|brought\s*forward/i.test(s) && nums.length) {
      const b = parseAmountIN(nums[nums.length - 1][0]); prev = b.value * (b.sign < 0 ? -1 : 1); continue;
    }
    if (!date || nums.length < 2) continue;
    const bal = parseAmountIN(nums[nums.length - 1][0]);
    const amt = parseAmountIN(nums[nums.length - 2][0]);
    const balance = bal.value * (bal.sign < 0 ? -1 : 1);
    const desc = s.replace(/^\S+\s*/, '').replace(nums[nums.length - 2][0], '').replace(nums[nums.length - 1][0], '').replace(/\s+/g, ' ').trim();
    let dir = amt.sign < 0 ? 'out' : amt.sign > 0 ? 'in' : null;
    if (!dir && prev != null) dir = balance < prev ? 'out' : 'in';
    prev = balance;
    if (dir && amt.value > 0) out.push({ date, desc, amount: amt.value, dir, balance });
  }
  return out;
}
