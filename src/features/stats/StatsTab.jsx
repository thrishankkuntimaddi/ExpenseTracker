// ─── Stats ───────────────────────────────────────────────────────
// The month the app is on (switch it here or in the calendar — every page
// follows):
//   • the balance, and the month at a glance
//   • six months of money in / saved / spent
//   • this month against last month, category by category
//   • the big picture — savings, goals, responsibilities, debts, cash
//   • where the money went, the biggest spends, the spending calendar
// The monthly report opens from the header when you want it; a fresh one
// only shows a small dot there, never a banner.
import { useState, useMemo } from 'react';
import { FileText, TrendingUp, TrendingDown, Minus, PiggyBank, HeartHandshake, ArrowDownLeft, ArrowUpRight, Banknote, Flag, ChevronRight } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatAmount, localMonthKey } from '../../utils/dateHelpers';
import { categoryTotals, categoryColor, categoryOf, EMPTY_RULES } from '../../utils/categories';
import { latestReportDay, getReportSettings, ordinal } from '../../utils/report';
import { toKey, fromKey } from '../../utils/recurring';
import { useStats } from '../../hooks/useStats';
import { useViewMonth, monthName } from '../../app/month';
import SpendingCalendar from './components/SpendingCalendar';
import ReportCard from './components/ReportCard';
import BalanceTimeline from './components/BalanceTimeline';
import { PageHeader, HeaderAction } from '../../components/Page';
import ModalShell from '../../components/ModalShell';
import { CategoryBadge } from '../../components/CategoryPicker';
import { formatMoneyCompact } from '../../utils/money';
import { monthSeries, compareCategories, topSpends } from '../../utils/statsView';
import { computeGoalProgress, isGoalOpen } from '../../utils/goals';
import { respSummary } from '../../utils/responsibilities';
import { debtLedger, debtTotals } from '../../utils/debts';
import { cashSummary } from '../../utils/cash';
import { sumAmounts } from '../../utils/finance';
import { useShell } from '../../app/shellContext';

const rupees = (n) => formatMoneyCompact(n);
// Order matters: green and red never sit side by side (colour-blind safe)
const SERIES = [
  { key: 'in',    name: 'Money in', light: '#059669', dark: '#10B981' },
  { key: 'saved', name: 'Saved',    light: '#2563EB', dark: '#3B82F6' },
  { key: 'spent', name: 'Spent',    light: '#E11D48', dark: '#F43F5E' },
];

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow)', fontSize: 12 }}>
      {label && <p style={{ fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload?.color || p.fill }} />
          {p.name}: <strong style={{ color: 'var(--text)' }}>{formatAmount(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function Card({ id, title, hint, children, style }) {
  return (
    <section id={id} className="card stats-card" style={{ padding: 16, marginBottom: 14, scrollMarginTop: 12, ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h2 className="section-label" style={{ margin: 0 }}>{title}</h2>
          {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

function Glance({ label, value, sub, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 650, color: 'var(--text-muted)' }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: `var(--${tone})` }} />{label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginTop: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rupees(value)}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

export default function StatsTab({ transactions, income, selectedPeriod, theme, settings, recurring, onPatchSettings }) {
  const shell = useShell();
  const { month, setMonth, period } = useViewMonth(selectedPeriod);
  const { stats, filtTxns, pieData, income: incomeWithCarry } = useStats(transactions, income, period, theme, settings);
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const dark = theme === 'monoflow';
  const [reportOpen, setReportOpen] = useState(false);
  const todayKey = toKey(new Date());
  const monthLong = monthName(month, { month: 'long' });

  // The monthly report: a dot on the button while it's fresh (published in the last 3 days)
  const { day } = getReportSettings(settings);
  const latest = latestReportDay(day, todayKey);
  const fresh = (fromKey(todayKey) - fromKey(latest)) / 86400000 <= 3;

  const series = useMemo(() => monthSeries(transactions, income, month, 6), [transactions, income, month]);
  const compare = useMemo(() => compareCategories(transactions, month, categoryRules), [transactions, month, categoryRules]);
  const top = useMemo(() => topSpends(transactions, month, 5), [transactions, month]);
  const catTotals = useMemo(() => categoryTotals(filtTxns, categoryRules), [filtTxns, categoryRules]);

  // Where the money went: categories (biggest seven, the rest together), then money that left without being spending
  const moneyOut = useMemo(() => {
    const shown = catTotals.length > 8 ? 7 : 8;
    const cats = catTotals.slice(0, shown).map((c) => ({ key: c.key, name: c.label, value: c.amount, count: c.count, color: categoryColor(c.key, theme) }));
    const rest = catTotals.slice(shown);
    if (rest.length) cats.push({ key: 'other-cats', name: `${rest.length} more categories`, value: rest.reduce((t, c) => t + c.amount, 0), color: 'var(--text-muted)' });
    const NOT_SPENDING = { Savings: 'var(--savings)', Lent: '#A8A29E', 'Debt Repaid': '#78716C', 'Given (Gift)': 'var(--text-secondary)' };
    const others = pieData.filter((d) => NOT_SPENDING[d.name] && d.value > 0)
      .map((d) => ({ key: d.name, name: d.name === 'Given (Gift)' ? 'Given to people' : d.name, value: d.value, color: NOT_SPENDING[d.name] }));
    return [...cats, ...others].filter((d) => d.value > 0);
  }, [catTotals, pieData, theme]);
  const outTotal = moneyOut.reduce((t, d) => t + d.value, 0);

  // The big picture: all time, not just this month
  const goalList = settings?.goals, respList = settings?.responsibilities;
  const big = useMemo(() => {
    const takenOut = sumAmounts(transactions.filter((t) => t.type === 'expense' && t.paidFrom === 'savings'));
    const saved = sumAmounts(transactions.filter((t) => t.type === 'savings')) - takenOut;
    const goals = (goalList ?? []).filter(isGoalOpen).map((g) => computeGoalProgress(g, transactions));
    const resp = respSummary(respList ?? [], transactions, toKey(new Date()));
    const debts = debtTotals(debtLedger(transactions, income));
    const cash = cashSummary(transactions);
    return {
      saved,
      goalSaved: goals.reduce((s, g) => s + g.saved, 0), goalTarget: goals.reduce((s, g) => s + g.target, 0), goalCount: goals.length,
      resp, debts, cash,
    };
  }, [transactions, income, goalList, respList]);

  const avgIn = series.slice(0, -1).filter((m) => m.in > 0);
  // Earned this month: real income only — not borrowed, not paid back, not carried over from last month
  const earned = sumAmounts(income.filter((i) => !i.isCarryForward && !i.isBorrowed && !i.isRepaymentRec && localMonthKey(i.date) === month));
  const carried = stats.totalIncome - earned - stats.totalBorrowed - stats.totalRepaymentRec;
  const savingsRate = earned > 0 ? Math.round((stats.totalSavings / earned) * 100) : null;
  const changed = compare.rows.filter((r) => Math.abs(r.change) >= 1).slice(0, 6);
  const maxChange = Math.max(1, ...changed.map((r) => Math.max(r.now, r.prev)));
  const hasTrend = series.some((m) => m.in || m.saved || m.spent);

  return (
    <div className="tab-root stats-page">
      <PageHeader title="Stats" subtitle={`${monthLong} · trends, categories, the big picture`} month
        actions={(
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <HeaderAction id="stats-open-report" Icon={FileText} label="Report" onClick={() => setReportOpen(true)} />
            {fresh && <span aria-label="A new report is ready" style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--expense)', border: '2px solid var(--surface)' }} />}
          </span>
        )} />

      <div className="tab-body">
        {/* ── The remaining balance over time — the same Balance as Home ── */}
        <BalanceTimeline transactions={transactions} incomeWithCarry={incomeWithCarry} monthBalance={month === todayKey.slice(0, 7) ? stats.balance : null} dark={dark}
          monthIn={stats.totalIncome}
          monthOut={stats.totalExpense - (stats.paidFromSavings ?? 0) + stats.totalSavings + stats.totalLent + stats.totalRepaidThem + stats.totalGivenGift}
          savedTotal={big.saved} youOwe={big.debts.youOwe} />

        <div className="stats-layout">
          <div className="stats-left">
            {/* ── The month at a glance ── */}
            <Card id="stats-glance">
              <div className="stats-glance" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <Glance label="Money in" tone="income" value={stats.totalIncome} sub={[`${rupees(earned)} earned`, stats.totalBorrowed > 0 && `${rupees(stats.totalBorrowed)} borrowed`, carried > 0.5 && `${rupees(carried)} carried over`].filter(Boolean).join(' · ')} />
                <Glance label="Spent" tone="expense" value={stats.totalExpense} sub={`${rupees(stats.avgDay)} a day`} />
                <Glance label="Saved" tone="savings" value={stats.totalSavings} sub={savingsRate != null ? `${savingsRate}% of income` : '—'} />
                <Glance label="Wasted" tone="lent" value={stats.totalWaste} sub={`${stats.wastePercent}% of spending`} />
              </div>
            </Card>

            {/* ── Six months ── */}
            <Card id="stats-trend" title="Six months" hint={avgIn.length ? `avg in ${rupees(avgIn.reduce((s, m) => s + m.in, 0) / avgIn.length)}` : undefined}>
              {hasTrend ? (
                <>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                    {SERIES.map((s) => (
                      <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 650, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: dark ? s.dark : s.light }} />{s.name}
                      </span>
                    ))}
                  </div>
                  <div style={{ width: '100%', height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => (v >= 100000 ? `${Math.round(v / 1000) / 100}L` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface2)' }} />
                        {SERIES.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={dark ? s.dark : s.light} radius={[4, 4, 0, 0]} maxBarSize={18} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : <Empty>Nothing recorded in the last six months yet.</Empty>}
            </Card>

            {/* ── Against last month ── */}
            <Card id="stats-compare" title={`Against ${monthName(compare.prevKey, { month: 'long' })}`}
              hint={compare.totalPct != null ? `${month === todayKey.slice(0, 7) ? 'so far: ' : ''}spending ${compare.totalPct > 0 ? 'up' : compare.totalPct < 0 ? 'down' : 'flat'} ${Math.abs(compare.totalPct)}%` : undefined}>
              {changed.length ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {changed.map((r) => {
                    const up = r.change > 0;
                    const Icon = up ? TrendingUp : r.change < 0 ? TrendingDown : Minus;
                    return (
                      <div key={r.key} className="compare-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ flex: 1, minWidth: 0, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                          <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{rupees(r.prev)} →</span>
                          <span style={{ fontWeight: 750, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rupees(r.now)}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, width: 70, justifyContent: 'flex-end', fontWeight: 700, color: up ? 'var(--expense)' : 'var(--income)', fontVariantNumeric: 'tabular-nums' }}>
                            <Icon size={12} />{r.pct == null ? 'new' : `${up ? '+' : ''}${r.pct}%`}
                          </span>
                        </div>
                        <div style={{ position: 'relative', height: 6, marginTop: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }} aria-hidden>
                          <div style={{ position: 'absolute', inset: 0, width: `${(r.prev / maxChange) * 100}%`, background: 'var(--border)', borderRadius: 99 }} />
                          <div style={{ position: 'absolute', top: 1, bottom: 1, left: 0, width: `${(r.now / maxChange) * 100}%`, background: categoryColor(r.key, theme), borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Grey bar: last month · coloured bar: this month</div>
                </div>
              ) : <Empty>No spending to compare yet.</Empty>}
            </Card>

            <section id="stats-calendar" style={{ marginBottom: 14, scrollMarginTop: 12 }}>
              <SpendingCalendar transactions={transactions} month={month} onMonthChange={setMonth} rules={categoryRules} theme={theme} />
            </section>
          </div>

          <div className="stats-right">
            {/* ── Where the money went ── */}
            <Card id="money-went" title="Where the money went" hint={outTotal ? `${rupees(outTotal)} out` : undefined}>
              {moneyOut.length > 0 ? (
                <div className="money-went" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0, margin: '0 auto' }}>
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={moneyOut} cx="50%" cy="50%" innerRadius={46} outerRadius={68} dataKey="value" paddingAngle={2} stroke="none">
                          {moneyOut.map((e) => <Cell key={e.key} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Out</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rupees(outTotal)}</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: 7 }}>
                    {moneyOut.map((d) => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}{d.count ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {d.count}</span> : null}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rupees(d.value)}</span>
                        <span style={{ width: 34, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.value / outTotal < 0.005 ? '<1' : Math.round((d.value / outTotal) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <Empty>Nothing went out in {monthLong} yet.</Empty>}
            </Card>

            {/* ── The big picture (all time) ── */}
            <Card id="stats-big-picture" title="The big picture" hint="all time">
              <div style={{ display: 'grid', gap: 2 }}>
                <BigRow Icon={PiggyBank} tone="savings" label="Savings" value={big.saved} sub="everything saved, minus what you used" onClick={() => shell?.goTo('savings')} />
                {big.goalCount > 0 && (
                  <BigRow Icon={Flag} tone="income" label={`Goals · ${big.goalCount}`} value={big.goalSaved}
                    sub={`of ${rupees(big.goalTarget)} · ${big.goalTarget ? Math.round((big.goalSaved / big.goalTarget) * 100) : 0}% there`} onClick={() => shell?.goTo('savings')}
                    bar={big.goalTarget ? big.goalSaved / big.goalTarget : 0} />
                )}
                <BigRow Icon={HeartHandshake} tone="given" label="Responsibilities left" value={big.resp.remaining}
                  sub={big.resp.count ? `${big.resp.count} to clear${big.resp.dueThisMonth ? ` · ${rupees(big.resp.dueThisMonth)} due this month` : ''}` : 'nothing to clear'} onClick={() => shell?.goTo('responsibilities')}
                  bar={big.resp.total ? big.resp.paid / big.resp.total : null} />
                <BigRow Icon={ArrowDownLeft} tone="borrowed" label="You owe" value={big.debts.youOwe} sub={big.debts.youOwe ? 'borrowed, still open' : 'all clear'} onClick={() => shell?.goTo('people')} />
                <BigRow Icon={ArrowUpRight} tone="lent" label="Owed to you" value={big.debts.owedToYou} sub={big.debts.owedToYou ? 'lent, not back yet' : 'all returned'} onClick={() => shell?.goTo('people')} />
                {big.cash.used && <BigRow Icon={Banknote} tone="lent" label="Cash in hand" value={Math.max(0, big.cash.inHand)} sub="withdrawn minus spent in cash" />}
              </div>
            </Card>

            {/* ── Biggest spends ── */}
            <Card id="stats-top" title={`Biggest spends in ${monthLong}`}>
              {top.length ? (
                <div style={{ display: 'grid' }}>
                  {top.map((t, i) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <CategoryBadge category={categoryOf(t, categoryRules)} compact theme={theme} />
                        </span>
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(t.amount, t.currency)}</span>
                      <span style={{ width: 36, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>{stats.totalExpense ? `${Math.round((Number(t.amount) / stats.totalExpense) * 100)}%` : ''}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty>No expenses in {monthLong} yet.</Empty>}
            </Card>
          </div>
        </div>
      </div>

      {reportOpen && (
        <ModalShell title="Monthly report" subtitle={`Salary to salary, on the ${ordinal(day)} · ‹ › for earlier ones`} onClose={() => setReportOpen(false)} maxWidth={620}>
          <ReportCard transactions={transactions} income={income} settings={settings} recurringRules={recurring?.rules ?? []} onPatchSettings={onPatchSettings} />
        </ModalShell>
      )}

      <style>{`
        @media (min-width: 1180px) {
          .desktop-main .stats-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
        }
        .stats-layout { display: flex; flex-direction: column; }
        @media (max-width: 420px) {
          .stats-glance { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}

function BigRow({ Icon, tone, label, value, sub, onClick, bar = null }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="big-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', border: 'none', background: 'transparent', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', width: '100%', borderRadius: 10 }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: `var(--${tone}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} style={{ color: `var(--${tone})` }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatMoneyCompact(value)}</span>
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</span>
        {bar != null && (
          <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--surface2)', marginTop: 5, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.min(100, bar * 100)}%`, background: `var(--${tone})`, borderRadius: 99 }} />
          </span>
        )}
      </span>
      {onClick && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </Tag>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>{children}</div>;
}
