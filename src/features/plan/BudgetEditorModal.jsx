// ─── BudgetEditorModal ────────────────────────────────────────────
// Edit the monthly total + per-category caps. "Suggest" fills categories
// from the last three months' average so the first budget takes seconds.
import { useMemo, useState } from 'react';
import { Check, Wand2 } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { CATEGORIES, categoryTotals, categoryColor } from '../../utils/categories';
import { CategoryIcon } from '../../components/CategoryPicker';
import { currentTheme } from '../../utils/theme';
import { localMonthKey, formatAmount } from '../../utils/dateHelpers';
import { EMPTY_BUDGETS } from '../../utils/budget';

const pad2 = (n) => String(n).padStart(2, '0');

export default function BudgetEditorModal({ budgets, transactions = [], rules = {}, onSave, onClose }) {
  const b = budgets ?? EMPTY_BUDGETS;
  const [total, setTotal] = useState(b.total ? String(b.total) : '');
  const [cats, setCats] = useState(() => Object.fromEntries(Object.entries(b.categories ?? {}).map(([k, v]) => [k, String(v)])));
  const theme = currentTheme();

  // Average spend per category over the previous 3 full months (for suggestions)
  const suggestion = useMemo(() => {
    const now = new Date();
    const keys = [1, 2, 3].map((i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; });
    const past = transactions.filter((t) => keys.includes(localMonthKey(t.date)));
    const monthsWithData = new Set(past.map((t) => localMonthKey(t.date))).size || 1;
    const totals = categoryTotals(past, rules);
    const perCat = Object.fromEntries(totals.map((c) => [c.key, Math.ceil(c.amount / monthsWithData / 100) * 100]));
    const all = Math.ceil(totals.reduce((s, c) => s + c.amount, 0) / monthsWithData / 500) * 500;
    return { perCat, all, hasData: totals.length > 0 };
  }, [transactions, rules]);

  function applySuggestion() {
    if (!suggestion.hasData) return;
    setTotal(String(suggestion.all));
    setCats(Object.fromEntries(Object.entries(suggestion.perCat).filter(([, v]) => v > 0).map(([k, v]) => [k, String(v)])));
  }

  const catSum = Object.values(cats).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalNum = Number(total) || 0;

  function save() {
    const categories = Object.fromEntries(Object.entries(cats).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    onSave({ total: totalNum > 0 ? totalNum : null, categories });
    onClose();
  }

  return (
    <ModalShell
      title="Monthly Budget" subtitle="Caps apply to expenses only — savings and lending are excluded." onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}><Check size={14} /> Save budget</PrimaryButton>
      </>}
    >
      <Field label="Total monthly cap" hint={catSum > 0 && totalNum > 0 && catSum > totalNum ? `Category caps add up to ${formatAmount(catSum)}, above the total.` : 'Leave empty to track categories only.'}>
        <input type="text" inputMode="decimal" placeholder="e.g. 30000" value={total}
          onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setTotal(v); }}
          style={{ ...fieldStyle, fontSize: 18, fontWeight: 700 }} autoFocus />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per category (optional)</span>
        <button type="button" onClick={applySuggestion} disabled={!suggestion.hasData}
          title={suggestion.hasData ? 'Fill from your last 3 months' : 'Needs a few months of data'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: suggestion.hasData ? 'pointer' : 'not-allowed', opacity: suggestion.hasData ? 1 : 0.5, fontFamily: 'inherit' }}>
          <Wand2 size={11} /> Suggest from history
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
        {CATEGORIES.map((c) => {
          const color = categoryColor(c.key, theme);
          const sug = suggestion.perCat[c.key];
          return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 10, border: '1px solid var(--border)', background: cats[c.key] ? color + '10' : 'transparent' }}>
              <CategoryIcon category={c.key} size={13} style={{ color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</div>
                {sug > 0 && !cats[c.key] && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>avg {formatAmount(sug)}</div>}
              </div>
              <input type="text" inputMode="decimal" placeholder="—" value={cats[c.key] ?? ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setCats((p) => ({ ...p, [c.key]: v })); }}
                style={{ width: 84, padding: '7px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: 'right', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}
