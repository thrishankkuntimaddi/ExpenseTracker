// ─── Bills & payments (phone) ────────────────────────────────────
// The month's essentials — rent on the 5th, electricity, EMIs, SIPs,
// subscriptions — as a dated timeline: what's paid, what's due today,
// what's late and what's coming. Pay with one tap (even early); add a bill
// from a preset. Built on the recurring rules.
import { useMemo, useState } from 'react';
import { Plus, Check, Zap, Pause, Play, Pencil, CalendarClock, ReceiptText, SkipForward } from 'lucide-react';
import { PageHeader, HeaderAction, SectionHeading, EmptyState, PrimaryPill } from '../../components/Page';
import RecurringRuleModal from '../plan/RecurringRuleModal';
import DueRecurringCard from '../plan/components/DueRecurringCard';
import { formatAmount } from '../../utils/dateHelpers';
import { monthBills, dueLabel, BILL_PRESETS } from '../../utils/bills';
import { describeSchedule, fromKey, toKey, monthlyEquivalent } from '../../utils/recurring';
import { EMPTY_RULES, categoryMeta } from '../../utils/categories';
import { useShell } from '../../app/shellContext';
import { useViewMonth } from '../../app/month';
import { formatEntryAmount } from '../../utils/money';

const STATUS = {
  paid:     { label: 'Paid',     color: 'var(--income)' },
  skipped:  { label: 'Skipped',  color: 'var(--text-muted)' },
  overdue:  { color: 'var(--expense)' },
  today:    { color: 'var(--lent)' },
  upcoming: { color: 'var(--text-muted)' },
};
const KIND_COLOR = { expense: 'var(--expense)', savings: 'var(--savings)', income: 'var(--income)' };
const KIND_BG = { expense: 'var(--expense-bg)', savings: 'var(--savings-bg)', income: 'var(--income-bg)' };

export default function BillsPage({ transactions = [], income = [], recurring, settings, selectedPeriod }) {
  const shell = useShell();
  const todayKey = toKey(new Date());
  const { month: monthKey } = useViewMonth(selectedPeriod);   // the app-wide month
  const [ruleModal, setRuleModal] = useState(null);   // null | { rule } | { preset }
  const [busy, setBusy] = useState({});
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const rules = useMemo(() => recurring?.rules ?? [], [recurring?.rules]);

  const existingIds = useMemo(() => {
    const s = new Set();
    transactions.forEach((t) => s.add(t.id));
    income.forEach((i) => s.add(i.id));
    return s;
  }, [transactions, income]);

  const month = useMemo(() => monthBills(rules, existingIds, monthKey, todayKey), [rules, existingIds, monthKey, todayKey]);
  const monthStart = `${monthKey}-01`;
  const earlierDue = (recurring?.manualDue ?? []).filter((d) => d.rule.kind !== 'income' && d.dateKey < monthStart && monthKey === todayKey.slice(0, 7));
  const committed = rules.filter((r) => r.active !== false && r.kind !== 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const isThisMonth = monthKey === todayKey.slice(0, 7);
  const monthLabel = fromKey(`${monthKey}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const paidPct = month.total > 0 ? Math.min(100, (month.paid / month.total) * 100) : 0;

  async function pay(item) {
    const k = `${item.rule.id}|${item.dateKey}`;
    setBusy((b) => ({ ...b, [k]: true }));
    // Paying ahead of the due date records today's date on the entry
    const ok = await recurring.post({ rule: item.rule, dateKey: item.dateKey, paidOn: item.dateKey > todayKey ? todayKey : null });
    setBusy((b) => { const n = { ...b }; delete n[k]; return n; });
    if (ok) shell?.toast(`Paid ${item.rule.name} · ${formatEntryAmount(item.rule, item.amount)}`);
  }

  return (
    <div className="tab-root bills-page">
      <PageHeader title="Bills & payments" subtitle="Rent, EMIs, SIPs, insurance, utilities" month
        actions={<HeaderAction id="bills-add" Icon={Plus} label="Add" onClick={() => setRuleModal({ preset: null })} />} />

      <div className="tab-body">
        {/* ── Month summary ── */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Figure label={isThisMonth ? 'This month' : monthLabel.split(' ')[0]} value={formatAmount(month.total)} />
            <Figure label="Paid" value={formatAmount(month.paid)} color="var(--income)" />
            <Figure label={month.overdueCount ? `${month.overdueCount} late` : 'To pay'} value={formatAmount(month.remaining)} color={month.overdueCount ? 'var(--expense)' : 'var(--text)'} />
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${paidPct}%`, height: '100%', borderRadius: 99, background: 'var(--income)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {rules.some((r) => r.kind !== 'income') ? `${formatAmount(committed)} a month goes to regular payments` : 'Add the payments you make every month'}
          </div>
        </div>

        {earlierDue.length > 0 && (
          <>
            <SectionHeading title="Still unpaid from earlier" />
            <DueRecurringCard due={earlierDue} onPost={recurring.post} onSkip={recurring.skip} onSkipAll={recurring.skipAllFor} compact />
          </>
        )}

        {/* ── Timeline ── */}
        <SectionHeading id="bills-timeline" title={isThisMonth ? 'This month' : monthLabel} hint={month.items.length ? `${month.items.length} payment${month.items.length === 1 ? '' : 's'}` : undefined} />
        {month.items.length === 0 ? (
          <EmptyState Icon={ReceiptText} title={rules.length ? 'Nothing due this month' : 'Never miss a due date'}
            text={rules.length ? 'No regular payments fall in this month.' : 'Add rent, electricity, EMIs, SIPs, insurance once. See what’s due, pay with one tap, and get a “Have you paid?” reminder on the day.'}
            action={!rules.length && <PrimaryPill id="bills-empty-add" Icon={Plus} onClick={() => setRuleModal({ preset: null })}>Add your first bill</PrimaryPill>} />
        ) : (
          <div className="card">
            {month.items.map((item, i) => {
              const d = fromKey(item.dateKey);
              const st = STATUS[item.status];
              const k = `${item.rule.id}|${item.dateKey}`;
              const open = item.status === 'overdue' || item.status === 'today' || item.status === 'upcoming';
              return (
                <div key={k} className="bill-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--border)' : 'none', opacity: item.status === 'skipped' ? 0.55 : 1 }}>
                  <div className="bill-date" style={{ width: 42, flexShrink: 0, textAlign: 'center', padding: '5px 0', borderRadius: 12, background: item.status === 'overdue' ? 'var(--expense-bg)' : item.status === 'today' ? 'var(--lent-bg)' : 'var(--surface2)' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1, color: item.status === 'overdue' ? 'var(--expense)' : item.status === 'today' ? 'var(--lent)' : 'var(--text)' }}>{d.getDate()}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.rule.name}</span>
                      {item.rule.autoPost && <Zap size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-label="Logged automatically" />}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: st.color, marginTop: 2 }}>
                      {st.label ?? (item.rule.autoPost && item.status === 'upcoming' ? `Auto · ${dueLabel(item.dateKey, todayKey)}` : dueLabel(item.dateKey, todayKey))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 750, color: item.status === 'paid' ? 'var(--text-secondary)' : KIND_COLOR[item.rule.kind], fontVariantNumeric: 'tabular-nums' }}>{formatEntryAmount(item.rule, item.amount)}</div>
                  </div>
                  {item.status === 'paid' ? (
                    <span aria-label="Paid" style={{ ...roundBtn, background: 'var(--income-bg)', color: 'var(--income)' }}><Check size={15} /></span>
                  ) : (open && isThisMonth) || item.status === 'overdue' ? (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button id={`bill-pay-${item.rule.id}-${item.dateKey}`} onClick={() => pay(item)} disabled={!!busy[k]} aria-label={`Pay ${item.rule.name}`}
                        style={{ ...pillBtn, background: item.status === 'upcoming' ? 'var(--surface2)' : 'var(--income)', color: item.status === 'upcoming' ? 'var(--text-secondary)' : '#fff' }}>
                        {busy[k] ? '…' : 'Pay'}
                      </button>
                      {item.status === 'overdue' && (
                        <button onClick={() => recurring.skip(item)} aria-label={`Skip ${item.rule.name}`} title="Skip this one" style={{ ...roundBtn, border: 'none', cursor: 'pointer' }}><SkipForward size={13} /></button>
                      )}
                    </div>
                  ) : <span style={{ width: 34 }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Quick add from presets ── */}
        {rules.filter((r) => r.kind !== 'income').length < 4 && <SectionHeading title="Common payments" hint="tap to add" />}
        {rules.filter((r) => r.kind !== 'income').length < 4 && <div className="chip-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 2 }}>
          {BILL_PRESETS.map((p) => (
            <button key={p.key} id={`preset-${p.key}`} onClick={() => setRuleModal({ preset: { ...p, frequency: p.frequency ?? 'monthly' } })}
              style={{ flexShrink: 0, padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer' }}>
              {p.label}
            </button>
          ))}
        </div>}

        {/* ── Every rule, to manage ── */}
        {rules.length > 0 && (
          <>
            <SectionHeading title="All regular payments" hint={`${rules.length}`} />
            <div className="card">
              {rules.map((r, i) => {
                const paused = r.active === false;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none', opacity: paused ? 0.55 : 1 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 11, background: KIND_BG[r.kind], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {r.autoPost ? <Zap size={14} style={{ color: KIND_COLOR[r.kind] }} /> : <CalendarClock size={14} style={{ color: KIND_COLOR[r.kind] }} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {describeSchedule(r).replace('Monthly on the', 'Every')}{r.kind === 'expense' && r.category ? ` · ${categoryMeta(r.category).label}` : r.kind === 'income' ? ' · income' : ' · savings'}{paused ? ' · paused' : r.autoPost ? ' · auto' : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 750, color: KIND_COLOR[r.kind], flexShrink: 0 }}>{r.kind === 'income' ? '+' : ''}{formatEntryAmount(r)}</span>
                    <button onClick={() => recurring.toggleActive(r)} aria-label={paused ? `Resume ${r.name}` : `Pause ${r.name}`} style={{ ...roundBtn, border: 'none', cursor: 'pointer' }}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>
                    <button onClick={() => setRuleModal({ rule: r })} aria-label={`Edit ${r.name}`} style={{ ...roundBtn, border: 'none', cursor: 'pointer' }}><Pencil size={12} /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {ruleModal && (
        <RecurringRuleModal rule={ruleModal.rule ?? null} preset={ruleModal.preset} categoryRules={categoryRules}
          onSave={recurring.saveRule} onDelete={recurring.removeRule} onClose={() => setRuleModal(null)} />
      )}
    </div>
  );
}

function Figure({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 750, color, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const roundBtn = { width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const pillBtn = { padding: '7px 13px', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
