// ─── Budget (phone) ──────────────────────────────────────────────
// Without a budget: what you actually spend (last three months), and a
// one-tap budget built from it. With one: what's left, what's safe to
// spend per day, where the month will land, and an envelope per category —
// every category you spent in this month, limited or not.
import { useMemo, useState } from 'react';
import { Pencil, Wand2, Target, TrendingUp } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill, LinkButton } from '../../components/Page';
import { BudgetBar } from '../plan/components/BudgetStatusCard';
import { CategoryIcon } from '../../components/CategoryPicker';
import BudgetEditorModal from '../plan/BudgetEditorModal';
import { computeBudgetStatus, suggestBudget } from '../../utils/budget';
import { categoryTotals, categoryColor, EMPTY_RULES } from '../../utils/categories';
import { formatAmount, localMonthKey } from '../../utils/dateHelpers';
import { getCurrentMonthValue } from '../../utils/periodHelpers';
import { useShell } from '../../app/shellContext';

const STATUS_COLOR = { ok: 'var(--income)', pace: 'var(--lent)', warn: 'var(--waste)', over: 'var(--expense)', none: 'var(--text-muted)' };
const STATUS_TEXT = { ok: 'On track', pace: 'Spending too fast', warn: 'Nearly spent', over: 'Over budget' };
const round = (n) => formatAmount(Math.round(n));

export default function BudgetPage({ transactions = [], settings, onPatchSettings, theme }) {
  const shell = useShell();
  const [editing, setEditing] = useState(false);
  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const budgets = settings?.budgets;
  const monthKey = getCurrentMonthValue();

  const status = useMemo(() => computeBudgetStatus({ budgets, transactions, monthKey, rules }), [budgets, transactions, monthKey, rules]);
  const suggestion = useMemo(() => suggestBudget(transactions, rules), [transactions, rules]);
  const spentByCat = useMemo(
    () => categoryTotals(transactions.filter((t) => localMonthKey(t.date) === monthKey), rules),
    [transactions, monthKey, rules],
  );

  // Last six months of spending, against today's budget
  const history = useMemo(() => {
    const now = new Date();
    return [5, 4, 3, 2, 1, 0].map((i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const spent = transactions.filter((t) => t.type === 'expense' && localMonthKey(t.date) === key).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), spent };
    });
  }, [transactions]);
  const maxMonth = Math.max(1, ...history.map((h) => h.spent), status.total.limit ?? 0);

  function applySuggestion() {
    onPatchSettings({ budgets: { total: suggestion.all, categories: suggestion.perCat } });
    shell?.toast(`Budget set to ${formatAmount(suggestion.all)} a month`);
  }

  const limited = Object.fromEntries(status.categories.map((c) => [c.key, c]));
  const envelopes = [
    ...status.categories,
    ...spentByCat.filter((c) => !limited[c.key]).map((c) => ({ key: c.key, label: c.label, spent: c.amount, limit: null })),
  ];
  const t = status.total;

  return (
    <div className="tab-root budget-page">
      <PageHeader title="Budget" subtitle={status.hasBudget ? `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left in the month` : 'Plan what you spend each month'}
        actions={status.hasBudget && <HeaderAction id="budget-edit" Icon={Pencil} label="Edit" onClick={() => setEditing(true)} />} />

      <div className="tab-body">
        {!status.hasBudget ? (
          suggestion.hasData ? (
            <div className="card budget-setup" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={18} style={{ color: 'var(--accent)' }} /></span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)' }}>Your budget, ready to go</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>From what you spent in the last {suggestion.months === 1 ? 'month' : `${suggestion.months} months`}</div>
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', margin: '14px 0 2px' }}>{formatAmount(suggestion.all)}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}> / month</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Biggest: {suggestion.top.map((c) => `${c.label} ${round(c.monthly)}`).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <PrimaryPill id="budget-use-suggestion" Icon={Target} onClick={applySuggestion}>Use this budget</PrimaryPill>
                <button onClick={() => setEditing(true)} style={{ padding: '10px 16px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer' }}>Set my own</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '12px 0 0' }}>
                You'll see what's safe to spend each day, a warning when a category runs fast, and an evening reminder if you turn it on.
              </p>
            </div>
          ) : (
            <EmptyState Icon={Target} title="Set a monthly budget"
              text="Pick a monthly limit — and limits per category if you like. You'll see what's safe to spend each day."
              action={<PrimaryPill id="budget-set" Icon={Target} onClick={() => setEditing(true)}>Set a budget</PrimaryPill>} />
          )
        ) : (
          <div className="card" style={{ padding: '16px' }}>
            {t.limit ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.remaining >= 0 ? 'Left to spend' : 'Over by'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[t.status] }}>{STATUS_TEXT[t.status]}</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: t.remaining >= 0 ? 'var(--text)' : 'var(--expense)', margin: '2px 0 10px' }}>{formatAmount(Math.abs(t.remaining))}</div>
                <BudgetBar pct={t.pct} pacePct={status.pacePct} color={STATUS_COLOR[t.status]} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{formatAmount(t.spent)} of {formatAmount(t.limit)} · the line marks where the month is today</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <Figure label="Safe today" value={t.safeToday != null ? round(t.safeToday) : '—'} color="var(--income)" />
                  <Figure label="Month ends at" value={round(t.projected)} color={t.projected > t.limit ? 'var(--expense)' : 'var(--text)'} />
                  <Figure label="Days left" value={status.daysLeft} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Category limits only. <LinkButton onClick={() => setEditing(true)}>Add a monthly total</LinkButton> to see what's safe to spend each day.
              </div>
            )}
          </div>
        )}

        {/* ── Envelopes ── */}
        {envelopes.length > 0 && (
          <>
            <SectionHeading id="budget-categories" title="By category" hint="this month" action={<LinkButton onClick={() => setEditing(true)}>Set limits</LinkButton>} />
            <div className="card">
              {envelopes.map((c, i) => {
                const color = categoryColor(c.key, theme);
                const pct = c.limit ? (c.spent / c.limit) * 100 : null;
                return (
                  <div key={c.key} style={{ padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 10, background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CategoryIcon category={c.key} size={14} style={{ color }} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.limit && c.spent > c.limit ? 'var(--expense)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {round(c.spent)}<span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{c.limit ? ` / ${round(c.limit)}` : ' · no limit'}</span>
                      </span>
                    </div>
                    {c.limit && (
                      <div style={{ marginTop: 8, marginLeft: 40 }}><BudgetBar pct={pct} pacePct={status.pacePct} color={STATUS_COLOR[c.status]} height={6} /></div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Six months ── */}
        <SectionHeading title="Last 6 months" hint="total spend" />
        <div className="card" style={{ padding: '16px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
            {history.map((h) => {
              const over = t.limit && h.spent > t.limit;
              return (
                <div key={h.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{h.spent >= 1000 ? `${Math.round(h.spent / 1000)}k` : Math.round(h.spent)}</span>
                  <div style={{ width: '100%', maxWidth: 30, height: `${Math.max(3, (h.spent / maxMonth) * 80)}px`, borderRadius: 8, background: over ? 'var(--expense)' : h.key === monthKey ? 'var(--accent)' : 'var(--border-dark)' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: h.key === monthKey ? 'var(--text)' : 'var(--text-muted)' }}>{h.label}</span>
                </div>
              );
            })}
          </div>
          {t.limit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              <TrendingUp size={12} /> Red months went over today's {formatAmount(t.limit)} budget
            </div>
          )}
        </div>
      </div>

      {editing && (
        <BudgetEditorModal budgets={budgets} transactions={transactions} rules={rules}
          onSave={(b) => onPatchSettings({ budgets: b })} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function Figure({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 750, color, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
