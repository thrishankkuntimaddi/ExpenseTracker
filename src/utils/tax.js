// ─── Tax-saving tracker (India, old regime) ──────────────────────
// Finds tax-saving payments in the financial year (1 Apr – 31 Mar) from
// your own entries and adds them up per section, against the limits:
//   80C       ₹1,50,000  PPF, EPF/VPF, ELSS / tax-saver funds, life insurance,
//                        Sukanya, NSC, 5-year tax-saver FD, children's tuition fees
//   80CCD(1B) ₹50,000    NPS (on top of 80C)
//   80D       ₹25,000    health insurance for you & family (+₹25k–50k for parents)
//   Rent      —          rent paid, for HRA (claimed through your employer)
// Deductions only help in the OLD regime; the new regime ignores them. Pure.
import { localDateKey } from './dateHelpers';
import { categoryOf } from './categories';

export const TAX_SECTIONS = [
  { key: '80C', label: 'Section 80C', limit: 150000, hint: 'PPF, EPF, ELSS, life insurance, tuition fees, Sukanya, NSC, tax-saver FD' },
  { key: '80CCD1B', label: 'NPS · 80CCD(1B)', limit: 50000, hint: 'Your own NPS contributions, over and above 80C' },
  { key: '80D', label: 'Health insurance · 80D', limit: 25000, hint: 'For you, your spouse and children (parents: another ₹25k–50k)' },
  { key: 'HRA', label: 'Rent paid (HRA)', limit: null, hint: 'Give rent receipts to your employer to claim HRA' },
];

const has = (s, re) => re.test(String(s ?? '').toLowerCase());

/** The section an entry counts towards, or null. */
export function taxSectionOf(t, rule, rules = {}) {
  const name = `${t.name ?? ''} ${t.platform ?? ''}`;
  if (t.taxSection) return t.taxSection === 'none' ? null : t.taxSection;
  if (t.type === 'savings') {
    if (has(name, /\bnps\b|national pension/)) return '80CCD1B';
    if (has(name, /\b(ppf|epf|vpf|elss|tax ?saver|tax ?saving|sukanya|ssy|nsc|ulip)\b/)) return '80C';
    if (t.savingsType === 'pf') return '80C';
    if (t.savingsType === 'deposit' && has(name, /\b(5 ?y(ea)?r|tax)\b/)) return '80C';
    return null;
  }
  if (t.type !== 'expense') return null;
  const cat = categoryOf(t, rules);
  const insType = t.insuranceType ?? rule?.insuranceType;
  if (cat === 'insurance' || insType) {
    if (insType === 'health' || has(name, /health|mediclaim|medical insurance|star health|niva bupa|care health/)) return '80D';
    if (insType === 'life' || has(name, /\blic\b|term|life insurance|jeevan/)) return '80C';
    return null;
  }
  if (has(name, /preventive|health check ?up|full body check/)) return '80D';
  if (cat === 'education' && has(name, /tuition|school fee|college fee|school fees/)) return '80C';
  if (cat === 'rent' && has(name, /\brent\b/)) return 'HRA';
  return null;
}

/** Financial year containing the day: { start, last, label: 'FY 2026–27' }. */
export function fyWindow(todayKey) {
  const [y, m] = todayKey.split('-').map(Number);
  const s = m >= 4 ? y : y - 1;
  return { start: `${s}-04-01`, last: `${s + 1}-03-31`, label: `FY ${s}–${String(s + 1).slice(2)}` };
}

export function taxSummary({ transactions = [], recurringRules = [], rules = {}, todayKey }) {
  const fy = fyWindow(todayKey);
  const ruleById = Object.fromEntries(recurringRules.map((r) => [r.id, r]));
  const bySection = Object.fromEntries(TAX_SECTIONS.map((s) => [s.key, { ...s, used: 0, entries: [] }]));
  for (const t of transactions) {
    const k = localDateKey(t.date);
    if (!k || k < fy.start || k > fy.last || t.isCarryForward) continue;
    const sec = taxSectionOf(t, ruleById[t.recurringId], rules);
    if (!sec || !bySection[sec]) continue;
    bySection[sec].used += Number(t.amount) || 0;
    bySection[sec].entries.push(t);
  }
  const sections = Object.values(bySection).map((s) => ({
    ...s, used: Math.round(s.used), left: s.limit ? Math.max(0, s.limit - Math.round(s.used)) : null,
    entries: s.entries.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  }));
  const [ly, lm, ld] = fy.last.split('-').map(Number), [ty, tm, td] = todayKey.split('-').map(Number);
  const daysLeft = Math.max(0, Math.round((new Date(ly, lm - 1, ld) - new Date(ty, tm - 1, td)) / 86400000));
  const deductible = sections.filter((s) => s.limit).reduce((sum, s) => sum + Math.min(s.used, s.limit), 0);
  return { fy, sections, daysLeft, deductible };
}

/** Rough tax saved by the deductions at a slab rate (old regime), with 4 % cess. */
export const taxSaved = (deductible, slab) => Math.round(deductible * slab * 1.04);
