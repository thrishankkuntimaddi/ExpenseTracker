// ─── Ask: questions about your money, answered on the device ─────
// No AI and nothing leaves the phone: the question is read for
//   • a time   — today, yesterday, this/last week, this/last month, "october",
//                "oct 2025", this/last year, "2025", "last 30 days" (default: this month)
//   • a kind   — spent (default) · income · saved · lent / borrowed
//   • a way    — total (default) · how many times · biggest · average per day ·
//                compare two months · subscriptions
//   • a thing  — a category ("food", "fuel") or any word in entry names ("swiggy")
// and answered from your entries. Pure — unit-tested.
import { localDateKey } from './dateHelpers';
import { CATEGORIES, categoryOf } from './categories';
import { toKey, fromKey } from './recurring';
import { incomeKind } from './finance';
import { findSubscriptions } from './insights';
import { formatMoneyCompact as money } from './money';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const monthIndex = (w) => MONTHS.findIndex((m) => m.startsWith(w.slice(0, 3)));
const pad = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const monthRange = (y, m) => ({ start: `${y}-${pad(m + 1)}-01`, end: toKey(new Date(y, m + 1, 0)), label: new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });

const STOP = new Set(('how much many did do i we my me spend spent spending on in at for the a an this last of to from what was is are ' +
  'total times time money pay paid paying buy bought order ordered get got cost costs between and vs versus compare compared with than ' +
  'biggest largest most expensive highest top average avg per day daily income earn earned earning salary received save saved saving savings invest invested ' +
  'lent lend borrowed borrow show me tell all entries expense expenses week month year today yesterday days so far till now since ' +
  'did? much? spend?').split(' '));

/** Pick the time range out of the question. Returns { start, end, label } (inclusive keys). */
export function parseRange(q, todayKey) {
  const [ty, tm] = todayKey.split('-').map(Number);
  let m;
  if (/\btoday\b/.test(q)) return { start: todayKey, end: todayKey, label: 'today' };
  if (/\byesterday\b/.test(q)) { const k = addDays(todayKey, -1); return { start: k, end: k, label: 'yesterday' }; }
  if ((m = q.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/))) return { start: addDays(todayKey, -(Number(m[1]) - 1)), end: todayKey, label: `the last ${m[1]} days` };
  if (/\bthis week\b/.test(q)) { const d = fromKey(todayKey); const mon = addDays(todayKey, -((d.getDay() + 6) % 7)); return { start: mon, end: todayKey, label: 'this week' }; }
  if (/\blast week\b/.test(q)) { const d = fromKey(todayKey); const mon = addDays(todayKey, -((d.getDay() + 6) % 7) - 7); return { start: mon, end: addDays(mon, 6), label: 'last week' }; }
  if (/\blast month\b/.test(q)) return monthRange(tm === 1 ? ty - 1 : ty, (tm + 10) % 12);
  if (/\bthis year\b/.test(q)) return { start: `${ty}-01-01`, end: todayKey, label: `${ty} so far` };
  if (/\blast year\b/.test(q)) return { start: `${ty - 1}-01-01`, end: `${ty - 1}-12-31`, label: String(ty - 1) };
  if ((m = q.match(new RegExp(`\\b${MON_RE}\\b(?:\\s*'?(\\d{2,4}))?`)))) {
    const mi = monthIndex(m[1]);
    let y = m[2] ? Number(m[2].length === 2 ? `20${m[2]}` : m[2]) : ty;
    if (!m[2] && mi + 1 > tm) y -= 1;          // "december" in November means last December
    return monthRange(y, mi);
  }
  if ((m = q.match(/\b(20\d{2})\b/))) { const y = Number(m[1]); return { start: `${y}-01-01`, end: y === ty ? todayKey : `${y}-12-31`, label: String(y) }; }
  return { ...monthRange(ty, tm - 1), label: 'this month' };
}

/** Two months for "compare october and september" / "oct vs sep". */
function parseTwoMonths(q, todayKey) {
  const found = [...q.matchAll(new RegExp(`\\b${MON_RE}\\b(?:\\s*'?(\\d{2,4}))?`, 'g'))];
  const [ty, tm] = todayKey.split('-').map(Number);
  const toR = (mm) => { const mi = monthIndex(mm[1]); let y = mm[2] ? Number(mm[2].length === 2 ? `20${mm[2]}` : mm[2]) : ty; if (!mm[2] && mi + 1 > tm) y -= 1; return monthRange(y, mi); };
  if (found.length >= 2) return [toR(found[0]), toR(found[1])];
  if (/\bthis month\b/.test(q) && /\blast month\b/.test(q)) return [monthRange(ty, tm - 1), monthRange(tm === 1 ? ty - 1 : ty, (tm + 10) % 12)];
  return null;
}

/** A category named in the question, by label word, key or keyword. */
function findCategory(words) {
  for (const c of CATEGORIES) {
    const labelWords = c.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && w !== 'and');
    if (words.some((w) => w === c.key || labelWords.includes(w))) return c;
  }
  for (const c of CATEGORIES) if (words.some((w) => w.length > 3 && c.keywords.includes(w) && ['food', 'fuel', 'rent', 'groceries', 'grocery', 'petrol', 'diesel', 'travel', 'shopping', 'health', 'medicine', 'medicines', 'gifts', 'gift', 'insurance', 'education', 'subscription', 'subscriptions', 'family', 'entertainment', 'bills', 'transport'].includes(w))) return c;
  return null;
}

export function parseQuestion(question, todayKey) {
  const q = ` ${String(question ?? '').toLowerCase().replace(/[’']/g, '').replace(/[?!.,]/g, ' ')} `;
  const kind = /\b(income|earn|earned|salary|received|came in)\b/.test(q) ? 'income'
    : /\b(saved|save|savings|invest|invested|sip)\b/.test(q) && !/\bspen/.test(q) ? 'savings'
    : /\b(lent|lend)\b/.test(q) ? 'lent'
    : /\b(borrowed|borrow)\b/.test(q) ? 'borrowed'
    : 'expense';
  const way = /\bsubscriptions?\b/.test(q) && !/\bspen/.test(q) ? 'subscriptions'
    : /\b(compare|vs|versus)\b/.test(q) ? 'compare'
    : /\bhow many( times)?\b|\bhow often\b|\bcount\b/.test(q) ? 'count'
    : /\b(biggest|largest|most expensive|highest|top)\b/.test(q) ? 'biggest'
    : /\b(average|avg|per day|daily)\b/.test(q) ? 'average'
    : 'total';
  const range = parseRange(q, todayKey);
  const words = q.replace(new RegExp(`\\b${MON_RE}\\b`, 'g'), ' ').replace(/\b\d+\b/g, ' ').split(/\s+/).filter(Boolean);
  const content = words.filter((w) => !STOP.has(w) && w.length > 1);
  const category = kind === 'expense' ? findCategory(content) : null;
  const term = category ? null : content.join(' ').trim() || null;
  return { kind, way, range, category: category?.key ?? null, categoryLabel: category?.label ?? null, term, months: way === 'compare' ? parseTwoMonths(q, todayKey) : null };
}

function pick(p, transactions, income, rules, range) {
  const inRange = (e) => { const k = localDateKey(e.date); return k && k >= range.start && k <= range.end && !e.isCarryForward; };
  let list;
  if (p.kind === 'income') list = income.filter((i) => inRange(i) && incomeKind(i) === 'income');
  else if (p.kind === 'savings') list = transactions.filter((t) => t.type === 'savings' && inRange(t));
  else if (p.kind === 'lent') list = transactions.filter((t) => t.type === 'person' && t.direction === 'lent' && inRange(t));
  else if (p.kind === 'borrowed') list = [...transactions.filter((t) => t.type === 'person' && t.direction === 'borrowed'), ...income.filter((i) => incomeKind(i) === 'borrowed')].filter(inRange);
  else list = transactions.filter((t) => t.type === 'expense' && inRange(t));
  if (p.category) list = list.filter((t) => categoryOf(t, rules) === p.category);
  if (p.term) {
    const terms = p.term.split(' ');
    const hay = (t) => `${t.name ?? ''} ${t.note ?? ''} ${t.platform ?? ''} ${t.person ?? ''}`.toLowerCase();
    list = list.filter((t) => terms.every((w) => hay(t).includes(w)));
  }
  return list;
}

const sum = (l) => Math.round(l.reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) / 100;
const KIND_WORD = { expense: 'Spent', income: 'Income', savings: 'Saved', lent: 'Lent', borrowed: 'Borrowed' };

/**
 * → { title, value (number|null), unit ('money'|'count'), sub, entries[], rows? }
 *   rows: [{ label, value }] for compare / subscriptions
 */
export function answer(question, { transactions = [], income = [], rules = {}, todayKey }) {
  const p = parseQuestion(question, todayKey);
  const what = p.categoryLabel ?? (p.term ? `“${p.term}”` : null);
  const where = what ? ` on ${what}` : '';
  if (p.way === 'subscriptions') {
    const subs = findSubscriptions(transactions, rules, todayKey);
    const total = subs.reduce((s, x) => s + x.monthly, 0);
    return { parsed: p, title: subs.length ? `${subs.length} subscription${subs.length === 1 ? '' : 's'} a month` : 'No subscriptions found', value: total, unit: 'money',
      sub: subs.length ? `About ${money(total * 12)} a year` : 'Nothing is paid once a month at the same price.', rows: subs.map((s) => ({ label: s.name, value: s.monthly })), entries: [] };
  }
  if (p.way === 'compare' && p.months) {
    const [a, b] = p.months.map((r) => ({ r, total: sum(pick(p, transactions, income, rules, r)) }));
    const diff = a.total - b.total;
    return { parsed: p, title: `${KIND_WORD[p.kind]}${where}: ${a.r.label} vs ${b.r.label}`, value: diff, unit: 'money', signed: true,
      sub: b.total ? `${diff >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round((diff / b.total) * 100))}%` : null,
      rows: [{ label: a.r.label, value: a.total }, { label: b.r.label, value: b.total }], entries: [] };
  }
  const list = pick(p, transactions, income, rules, p.range).sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
  const total = sum(list);
  const top = [...list].sort((x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0));
  if (p.way === 'count') {
    return { parsed: p, title: `${list.length} time${list.length === 1 ? '' : 's'}${where} ${p.range.label}`, value: list.length, unit: 'count', sub: list.length ? `${money(total)} in all` : null, entries: list.slice(0, 20) };
  }
  if (p.way === 'biggest') {
    const b = top[0];
    return { parsed: p, title: b ? `Biggest${where} ${p.range.label}: ${b.name}` : `Nothing${where} ${p.range.label}`, value: b ? Number(b.amount) : null, unit: 'money', sub: b ? new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null, entries: top.slice(0, 10) };
  }
  if (p.way === 'average') {
    const end = p.range.end > todayKey ? todayKey : p.range.end;
    const days = Math.max(1, Math.round((fromKey(end) - fromKey(p.range.start)) / 86400000) + 1);
    return { parsed: p, title: `${KIND_WORD[p.kind]} per day${where} ${p.range.label}`, value: Math.round((total / days) * 100) / 100, unit: 'money', sub: `${money(total)} over ${days} days`, entries: top.slice(0, 10) };
  }
  return { parsed: p, title: `${KIND_WORD[p.kind]}${where} ${p.range.label}`, value: total, unit: 'money', sub: `${list.length} entr${list.length === 1 ? 'y' : 'ies'}`, entries: list.slice(0, 20) };
}

export const ASK_EXAMPLES = [
  'How much on Swiggy this month?',
  'Food last month',
  'Biggest expense this year',
  'How many times Zomato in October?',
  'Average per day this month',
  'Compare this month and last month',
  'My subscriptions',
  'Income in August',
];
