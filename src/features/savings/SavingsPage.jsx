// ─── Savings & goals (phone) ─────────────────────────────────────
// Where the money you put away goes: the month on screen vs income (savings
// rate), all-time by kind (SIP, mutual fund, trading, cash …), six months,
// your goals (where each one's money is kept), and that month's entries.
import { useMemo, useState } from 'react';
import { Plus, PiggyBank } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill } from '../../components/Page';
import GoalsCard from '../plan/components/GoalsCard';
import GoalModal from '../plan/GoalModal';
import { SAVINGS_TYPES, getSavingsType } from '../../utils/typeConfig';
import { formatAmount, localMonthKey } from '../../utils/dateHelpers';
import { generateId } from '../../utils/storage';
import { useShell } from '../../app/shellContext';
import { useViewMonth, monthName } from '../../app/month';

const sum = (list) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);

export default function SavingsPage({ transactions = [], income = [], settings, onPatchSettings, selectedPeriod }) {
  const shell = useShell();
  const [goalModal, setGoalModal] = useState(null);
  const goals = settings?.goals ?? [];
  const { month: monthKey } = useViewMonth(selectedPeriod);

  const savings = useMemo(() => transactions.filter((t) => t.type === 'savings').sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions]);
  const thisMonth = useMemo(() => sum(savings.filter((t) => localMonthKey(t.date) === monthKey)), [savings, monthKey]);
  const monthIncome = useMemo(() => sum(income.filter((i) => localMonthKey(i.date) === monthKey && !i.isBorrowed)), [income, monthKey]);
  const allTime = sum(savings);
  const rate = monthIncome > 0 ? Math.round((thisMonth / monthIncome) * 100) : null;

  const byType = useMemo(() => {
    const m = {};
    savings.forEach((t) => { const k = getSavingsType(t.savingsType ?? 'cash')?.key ?? 'other'; m[k] = (m[k] ?? 0) + (Number(t.amount) || 0); });
    return SAVINGS_TYPES.filter((st) => m[st.key]).map((st) => ({ ...st, amount: m[st.key] })).sort((a, b) => b.amount - a.amount);
  }, [savings]);

  const months = useMemo(() => {
    const [vy, vm] = monthKey.split('-').map(Number);
    const now = new Date(vy, vm - 1, 1);
    return [5, 4, 3, 2, 1, 0].map((i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), amount: sum(savings.filter((t) => localMonthKey(t.date) === key)) };
    });
  }, [savings, monthKey]);
  const maxMonth = Math.max(1, ...months.map((m) => m.amount));

  function saveGoal(g) {
    const list = g.id ? goals.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...goals, { ...g, id: generateId() }];
    onPatchSettings({ goals: list });
  }
  const updateGoal = (g) => onPatchSettings({ goals: goals.map((x) => (x.id === g.id ? g : x)) });
  const monthEntries = savings.filter((t) => localMonthKey(t.date) === monthKey);

  return (
    <div className="tab-root savings-page">
      <PageHeader title="Savings & goals" subtitle="SIPs, funds, cash — and what they're for" month
        actions={<HeaderAction id="savings-add" Icon={Plus} label="Save" onClick={() => shell?.openAdd('savings')} />} />

      <div className="tab-body">
        {savings.length === 0 ? (
          <EmptyState Icon={PiggyBank} tone="savings" title="Start tracking your savings"
            text="Log SIPs, mutual funds, trading and cash savings. See your savings rate, where it goes, and how close your goals are."
            action={<PrimaryPill id="savings-empty-add" Icon={Plus} tone="savings" onClick={() => shell?.openAdd('savings')}>Add savings</PrimaryPill>} />
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Saved in {monthName(monthKey, { month: 'long' })}</span>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--savings)', margin: '2px 0 0' }}>{formatAmount(thisMonth)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <Figure label="Savings rate" value={rate != null ? `${rate}% of income` : '—'} />
              <Figure label="Saved in total" value={formatAmount(allTime)} />
            </div>
          </div>
        )}

        {byType.length > 0 && (
          <>
            <SectionHeading title="Where it goes" hint="all time" />
            <div className="card" style={{ padding: '6px 14px' }}>
              {byType.map((st, i) => (
                <div key={st.key} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><st.Icon size={14} style={{ color: st.color }} /></span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{st.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(st.amount)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: 'var(--surface2)', margin: '8px 0 0 40px', overflow: 'hidden' }}>
                    <div style={{ width: `${(st.amount / allTime) * 100}%`, height: '100%', borderRadius: 99, background: st.color }} />
                  </div>
                </div>
              ))}
            </div>

            <SectionHeading title="Last 6 months" />
            <div className="card" style={{ padding: '16px 14px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
                {months.map((m) => (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{m.amount >= 1000 ? `${Math.round(m.amount / 1000)}k` : Math.round(m.amount) || ''}</span>
                    <div style={{ width: '100%', maxWidth: 30, height: `${Math.max(3, (m.amount / maxMonth) * 70)}px`, borderRadius: 8, background: m.key === monthKey ? 'var(--savings)' : 'var(--border-dark)' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: m.key === monthKey ? 'var(--text)' : 'var(--text-muted)' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div id="savings-goals" style={{ marginTop: 20 }} />
        <GoalsCard goals={goals} transactions={transactions} onAdd={() => setGoalModal('new')} onEdit={(g) => setGoalModal(g)}
          onUpdate={updateGoal} onContribute={(g) => shell?.openAdd('savings', { goalId: g.id })} />

        {monthEntries.length > 0 && (
          <>
            <SectionHeading title={`Saved in ${monthName(monthKey, { month: 'long' })}`} />
            <div className="card">
              {monthEntries.slice(0, 12).map((t, i) => {
                const st = getSavingsType(t.savingsType ?? 'cash');
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><st.Icon size={14} style={{ color: st.color }} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {st.label}{t.platform ? ` · ${t.platform}` : ''}{t.goalId ? ` · ${goals.find((g) => g.id === t.goalId)?.name ?? 'goal'}` : ''}{t.heldWith ? ` · with ${t.heldWith}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--savings)' }}>{formatAmount(t.amount)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {goalModal && (
        <GoalModal goal={goalModal === 'new' ? null : goalModal} onSave={saveGoal}
          onDelete={(id) => onPatchSettings({ goals: goals.filter((g) => g.id !== id) })} onClose={() => setGoalModal(null)} />
      )}
    </div>
  );
}

function Figure({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

