// ─── PlanTab ──────────────────────────────────────────────────────
// Everything forward-looking in one place: the monthly budget, recurring
// entries (with what is due now and what is coming up) and savings goals.
import { useMemo, useState } from 'react';
import { Target, Repeat, Flag, Plus, Pencil, Zap, Pause, Play, CalendarClock } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import { getCurrentMonthValue } from '../../utils/periodHelpers';
import { computeBudgetStatus } from '../../utils/budget';
import { describeSchedule, monthlyEquivalent, fromKey } from '../../utils/recurring';
import { generateId } from '../../utils/storage';
import { EMPTY_RULES } from '../../utils/categories';
import BudgetStatusCard from './components/BudgetStatusCard';
import DueRecurringCard from './components/DueRecurringCard';
import GoalsCard from './components/GoalsCard';
import BudgetEditorModal from './BudgetEditorModal';
import RecurringRuleModal from './RecurringRuleModal';
import GoalModal from './GoalModal';
import { CategoryBadge } from '../../components/CategoryPicker';

const KIND_COLOR = { expense: 'var(--expense)', savings: 'var(--savings)', income: 'var(--income)' };

export default function PlanTab({ transactions = [], settings, onPatchSettings, recurring, embedded = false }) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [ruleModal, setRuleModal] = useState(null);   // null | 'new' | rule
  const [goalModal, setGoalModal] = useState(null);   // null | 'new' | goal

  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const budgets = settings?.budgets;
  const goals = settings?.goals ?? [];

  const budgetStatus = useMemo(
    () => computeBudgetStatus({ budgets, transactions, monthKey: getCurrentMonthValue(), rules }),
    [budgets, transactions, rules],
  );

  const committed = useMemo(() => {
    const active = recurring.rules.filter((r) => r.active !== false);
    return {
      out: active.filter((r) => r.kind !== 'income').reduce((s, r) => s + monthlyEquivalent(r), 0),
      in: active.filter((r) => r.kind === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0),
    };
  }, [recurring.rules]);

  const nextByRule = useMemo(() => Object.fromEntries(recurring.upcoming.map((u) => [u.rule.id, u.next])), [recurring.upcoming]);

  function saveGoal(g) {
    const list = g.id ? goals.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...goals, { ...g, id: generateId() }];
    onPatchSettings({ goals: list });
  }
  function deleteGoal(id) { onPatchSettings({ goals: goals.filter((g) => g.id !== id) }); }

  const body = (
    <>
      <DueRecurringCard due={recurring.manualDue} onPost={recurring.post} onSkip={recurring.skip} onSkipAll={recurring.skipAllFor} />

      {/* ── Budget ── */}
      <SectionTitle Icon={Target} title="Monthly Budget" sub={budgetStatus.hasBudget ? `${budgetStatus.daysLeft} day${budgetStatus.daysLeft === 1 ? '' : 's'} left this month` : undefined} />
      <BudgetStatusCard status={budgetStatus} onEdit={() => setBudgetOpen(true)} />

      {/* ── Recurring ── */}
      <SectionTitle
        Icon={Repeat} title="Recurring Entries"
        sub={recurring.rules.length ? `${formatAmount(committed.out)}/mo out${committed.in ? ` · ${formatAmount(committed.in)}/mo in` : ''}` : undefined}
        action={<SmallButton onClick={() => setRuleModal('new')} color="var(--accent)"><Plus size={11} /> New</SmallButton>}
        style={{ marginTop: 18 }}
      />
      {recurring.rules.length === 0 ? (
        <EmptyCard Icon={Repeat} color="var(--accent)" title="Nothing repeats yet"
          text="Add rent, EMIs, SIPs, salary or subscriptions once. They get logged on schedule — automatically, or with a one-tap confirm."
          action={<SmallButton onClick={() => setRuleModal('new')} color="var(--accent)" filled><Plus size={12} /> Add recurring</SmallButton>} />
      ) : (
        <div className="card">
          {recurring.rules.map((r, i) => {
            const inactive = r.active === false;
            const next = nextByRule[r.id];
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < recurring.rules.length - 1 ? '1px solid var(--border)' : 'none', opacity: inactive ? 0.55 : 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: (KIND_COLOR[r.kind] ?? 'var(--text-muted)') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {r.autoPost ? <Zap size={14} style={{ color: KIND_COLOR[r.kind] }} /> : <CalendarClock size={14} style={{ color: KIND_COLOR[r.kind] }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    {r.kind === 'expense' && r.category && <CategoryBadge category={r.category} compact />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {describeSchedule(r)}
                    {inactive ? ' · paused' : next ? ` · next ${fromKey(next).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ' · ended'}
                    {r.autoPost ? ' · auto' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: KIND_COLOR[r.kind] ?? 'var(--text)', flexShrink: 0 }}>
                  {r.kind === 'income' ? '+' : ''}{formatAmount(r.amount)}
                </span>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <IconButton title={inactive ? 'Resume' : 'Pause'} onClick={() => recurring.toggleActive(r)}>{inactive ? <Play size={11} /> : <Pause size={11} />}</IconButton>
                  <IconButton title="Edit" onClick={() => setRuleModal(r)}><Pencil size={11} /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Goals ── */}
      <SectionTitle Icon={Flag} title="Savings Goals" style={{ marginTop: 18 }}
        action={goals.length ? <SmallButton onClick={() => setGoalModal('new')} color="var(--savings)"><Plus size={11} /> New</SmallButton> : null} />
      <GoalsCard goals={goals} transactions={transactions} onAdd={() => setGoalModal('new')} onEdit={(g) => setGoalModal(g)} />

      {budgetOpen && (
        <BudgetEditorModal budgets={budgets} transactions={transactions} rules={rules}
          onSave={(b) => onPatchSettings({ budgets: b })} onClose={() => setBudgetOpen(false)} />
      )}
      {ruleModal && (
        <RecurringRuleModal rule={ruleModal === 'new' ? null : ruleModal} categoryRules={rules}
          onSave={recurring.saveRule} onDelete={recurring.removeRule} onClose={() => setRuleModal(null)} />
      )}
      {goalModal && (
        <GoalModal goal={goalModal === 'new' ? null : goalModal} onSave={saveGoal} onDelete={deleteGoal} onClose={() => setGoalModal(null)} />
      )}
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <div className="tab-root">
      <div className="tab-header">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Plan</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Budget · recurring entries · savings goals</p>
      </div>
      <div className="tab-body">{body}</div>
    </div>
  );
}

function SectionTitle({ Icon, title, sub, action, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Icon size={12} style={{ color: 'var(--text-muted)' }} />
        <span className="section-label" style={{ margin: 0 }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>· {sub}</span>}
      </div>
      {action}
    </div>
  );
}

function SmallButton({ children, onClick, color, filled }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: filled ? '7px 12px' : '4px 10px', borderRadius: 8,
      fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
      background: filled ? color : color.replace(')', '-bg)'), color: filled ? '#fff' : color,
      border: filled ? 'none' : `1px solid ${color.replace(')', '-border)')}`,
    }}>{children}</button>
  );
}

function IconButton({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}

function EmptyCard({ Icon, color, title, text, action }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: color.replace(')', '-bg)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.5 }}>{text}</div>
      </div>
      {action}
    </div>
  );
}
