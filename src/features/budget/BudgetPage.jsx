// ─── Budget (phone) ──────────────────────────────────────────────
// Without a budget: what you actually spend (last three months), and a
// one-tap budget built from it. With one: what's left, what's safe to
// spend per day, where the month will land, and an envelope per category —
// every category you spent in this month, limited or not. On top: the
// month's plan — income, fixed payments (rent, EMIs, insurance, SIPs from
// Bills), the spending budget, and what's left; plus salary deductions.
import { useMemo, useState } from 'react';
import { Pencil, Wand2, Target, TrendingUp, Plus, X, Check, ChevronRight } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill, LinkButton } from '../../components/Page';
import { BudgetBar } from '../plan/components/BudgetStatusCard';
import { CategoryIcon } from '../../components/CategoryPicker';
import BudgetEditorModal from '../plan/BudgetEditorModal';
import { computeBudgetStatus, suggestBudget, monthPlan, DEDUCTION_PRESETS } from '../../utils/budget';
import { categoryTotals, categoryColor, EMPTY_RULES } from '../../utils/categories';
import { formatAmount, localMonthKey } from '../../utils/dateHelpers';
import { useShell } from '../../app/shellContext';
import LiquidGauge from '../../motion/LiquidGauge';
import RollingNumber from '../../motion/RollingNumber';
import Sign from '../../motion/Sign';
import { useViewMonth, monthName } from '../../app/month';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';

const STATUS_COLOR = { ok: 'var(--income)', pace: 'var(--lent)', warn: 'var(--waste)', over: 'var(--expense)', none: 'var(--text-muted)' };
const STATUS_TEXT = { ok: 'On track', pace: 'Spending too fast', warn: 'Nearly spent', over: 'Over budget' };
const round = (n) => formatAmount(Math.round(n));

export default function BudgetPage({ transactions = [], income = [], settings, onPatchSettings, theme, recurring, selectedPeriod }) {
  const shell = useShell();
  const [editing, setEditing] = useState(false);
  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const budgets = settings?.budgets;
  const { month: monthKey, isNow } = useViewMonth(selectedPeriod);
  const saveBudgets = (patch) => onPatchSettings({ budgets: { ...(budgets ?? {}), ...patch } });
  const plan = monthPlan({ budgets, rules: recurring?.rules ?? [], transactions, income, monthKey, todayKey: toKey(new Date()) });

  const status = useMemo(() => computeBudgetStatus({ budgets, transactions, monthKey, rules }), [budgets, transactions, monthKey, rules]);
  const suggestion = useMemo(() => suggestBudget(transactions, rules), [transactions, rules]);
  const spentByCat = useMemo(
    () => categoryTotals(transactions.filter((t) => localMonthKey(t.date) === monthKey), rules),
    [transactions, monthKey, rules],
  );

  // Six months up to the one on screen, against the budget
  const history = useMemo(() => {
    const [vy, vm] = monthKey.split('-').map(Number);
    const now = new Date(vy, vm - 1, 1);
    return [5, 4, 3, 2, 1, 0].map((i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const spent = transactions.filter((t) => t.type === 'expense' && localMonthKey(t.date) === key).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), spent };
    });
  }, [transactions, monthKey]);
  const maxMonth = Math.max(1, ...history.map((h) => h.spent), status.total.limit ?? 0);

  function applySuggestion() {
    saveBudgets({ total: suggestion.all, categories: suggestion.perCat });
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
      <PageHeader title="Budget" subtitle={status.hasBudget && isNow ? `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left in the month` : 'Your month: income, fixed payments, spending'} month
        actions={status.hasBudget && <HeaderAction id="budget-edit" Icon={Pencil} label="Edit" onClick={() => setEditing(true)} />} />

      <div className="tab-body">
        <PlanCard plan={plan} monthKey={monthKey} budgets={budgets} onSave={saveBudgets} />

        <SectionHeading title="Spending budget" hint={monthName(monthKey, { month: 'long' })} />
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
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                  {/* the month's budget as liquid in a glass capsule */}
                  <LiquidGauge id="budget-liquid" variant="capsule" fraction={t.limit ? t.spent / t.limit : 0} style={{ width: 62, height: 132, flexShrink: 0 }}
                    label={`${Math.round(t.pct)}% of the budget used`} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.remaining >= 0 ? 'Left to spend' : 'Over by'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: STATUS_COLOR[t.status] }}>
                        {t.status === 'over' && <Sign kind="warn" size={16} />}{STATUS_TEXT[t.status]}
                      </span>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: t.remaining >= 0 ? 'var(--text)' : 'var(--expense)', margin: '2px 0 4px' }}><RollingNumber value={Math.abs(t.remaining)} /></div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>{Math.round(t.pct)}%</strong> used · {formatAmount(t.spent)} of {formatAmount(t.limit)}</div>
                    <BudgetBar pct={t.pct} pacePct={status.pacePct} color={STATUS_COLOR[t.status]} height={6} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>The line marks where the month is today</div>
                  </div>
                </div>
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
            <SectionHeading id="budget-categories" title="By category" hint={monthName(monthKey, { month: 'long' })} action={<LinkButton onClick={() => setEditing(true)}>Set limits</LinkButton>} />
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
              <TrendingUp size={12} /> Red months went over the {formatAmount(t.limit)} budget
            </div>
          )}
        </div>
      </div>

      {editing && (
        <BudgetEditorModal budgets={budgets} transactions={transactions} rules={rules}
          onSave={(b) => saveBudgets(b)} onClose={() => setEditing(false)} />
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

/* ── The month's plan: income − fixed − spending budget = left ── */
function PlanCard({ plan, monthKey, budgets, onSave }) {
  const shell = useShell();
  const [showFixed, setShowFixed] = useState(false);
  const [editDed, setEditDed] = useState(false);
  const row = (label, value, opts = {}) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderTop: opts.top ? '1px solid var(--border)' : 'none' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: opts.big ? 14 : 13, fontWeight: opts.big ? 750 : 600, color: opts.big ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: opts.big ? 18 : 14, fontWeight: 800, color: opts.color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
  return (
    <div className="card budget-plan" id="budget-plan" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
        {monthName(monthKey, { month: 'long' })} plan
      </div>
      {row(plan.useExpected ? 'Income (expected)' : 'Income received', round(plan.incomeBase), { color: 'var(--income)' })}
      <button id="budget-fixed-toggle" onClick={() => setShowFixed((v) => !v)} style={{ width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        {row(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>− Fixed payments · {plan.fixedItems.length}<ChevronRight size={13} style={{ transform: showFixed ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} /></span>, round(plan.fixed), { color: 'var(--expense)' })}
      </button>
      {showFixed && (
        <div style={{ margin: '0 0 6px 12px', paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
          {plan.fixedItems.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No rent, EMIs, insurance or SIPs added yet.</div>
            : plan.fixedItems.map((i) => (
              <div key={`${i.rule.id}|${i.dateKey}`} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)' }}>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.rule.name}{i.rule.kind === 'savings' ? ' · saving' : ''}</span>
                <span style={{ color: i.status === 'paid' ? 'var(--income)' : 'var(--text-muted)', fontWeight: 600 }}>{i.status === 'paid' ? 'paid' : `on ${Number(i.dateKey.slice(8))}`}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{round(i.amount)}</span>
              </div>
            ))}
          {shell && <button onClick={() => shell.goTo('bills')} style={{ padding: '4px 0', border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Manage in Bills & payments</button>}
        </div>
      )}
      {row('− Spending budget', plan.spendBudget != null ? round(plan.spendBudget) : 'not set', { color: plan.spendBudget != null ? 'var(--text)' : 'var(--text-muted)' })}
      {row(plan.free >= 0 ? 'Left to save or spare' : 'Short by', round(Math.abs(plan.free)), { top: true, big: true, color: plan.free >= 0 ? 'var(--income)' : 'var(--expense)' })}
      {plan.incomeBase === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Add this month’s income (or a recurring salary in Bills) to see the plan.</div>}

      {/* Salary deductions — taken before the money reaches you */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Taken from salary{plan.deductionTotal ? ` · ${round(plan.deductionTotal)}` : ''}</span>
          <button id="budget-deductions-edit" onClick={() => setEditDed((v) => !v)} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{editDed ? 'Done' : plan.deductions.length ? 'Edit' : 'Add tax, PF…'}</button>
        </div>
        {!editDed && plan.deductions.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
            {plan.deductions.map((d) => `${d.name} ${round(d.amount)}`).join(' · ')}
            {plan.incomeBase > 0 && <> · gross pay about <strong style={{ color: 'var(--text-secondary)' }}>{round(plan.gross)}</strong></>}
          </div>
        )}
        {editDed && <DeductionsEditor list={budgets?.deductions ?? []} onChange={(deductions) => onSave({ deductions })} />}
      </div>
    </div>
  );
}

function DeductionsEditor({ list, onChange }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const can = name.trim() && Number(amount) > 0;
  const input = { padding: '8px 10px', fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', minWidth: 0 };
  const add = () => { if (!can) return; onChange([...list, { id: generateId(), name: name.trim(), amount: Number(amount) }]); setName(''); setAmount(''); };
  return (
    <div style={{ marginTop: 8 }}>
      {list.map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
          <span style={{ flex: 1, color: 'var(--text)' }}>{d.name}</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{round(d.amount)}</span>
          <button aria-label={`Remove ${d.name}`} onClick={() => onChange(list.filter((x) => x.id !== d.id))} style={{ width: 26, height: 26, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={12} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        {DEDUCTION_PRESETS.filter((p) => !list.some((d) => d.name === p)).map((p) => (
          <button key={p} onClick={() => setName(p)} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${name === p ? 'var(--accent)' : 'var(--border)'}`, background: name === p ? 'var(--accent-bg)' : 'var(--surface2)', color: name === p ? 'var(--accent)' : 'var(--text-secondary)' }}>{p}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input id="deduction-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deduction" style={{ ...input, flex: 1 }} />
        <input id="deduction-amount" value={amount} inputMode="decimal" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="₹ / month" style={{ ...input, width: 100 }} />
        <button aria-label="Add deduction" onClick={add} disabled={!can} style={{ width: 36, border: 'none', background: can ? 'var(--accent)' : 'var(--surface2)', color: can ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: can ? 'pointer' : 'default' }}>{can ? <Check size={14} /> : <Plus size={14} />}</button>
      </div>
    </div>
  );
}
