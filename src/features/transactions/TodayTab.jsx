import { AddPanel } from '../../components/AddSheet';
import RollingNumber from '../../motion/RollingNumber';
import LiquidGauge from '../../motion/LiquidGauge';
import Sign from '../../motion/Sign';
import { useTilt } from '../../motion/useTilt';
import { useMemo, useRef, useState, Fragment } from 'react';
import { Coins, Users, Zap, ArrowUpRight } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth, localMonthKey } from '../../utils/dateHelpers';
import { TRANSACTION_TYPES as TYPES, getDirectionMeta } from '../../utils/typeConfig';
import { useStats } from '../../hooks/useStats';
import { inferCategory, categoryOf, categoryMeta, EMPTY_RULES } from '../../utils/categories';
import { parseQuickEntry } from '../../utils/smartInput';
import { computeBudgetStatus } from '../../utils/budget';
import { upcomingBills, dueLabel } from '../../utils/bills';
import { toKey, fromKey } from '../../utils/recurring';
import { CategoryBadge } from '../../components/CategoryPicker';
import ProfileButton from '../../components/ProfileButton';
import { useShell } from '../../app/shellContext';
import { PAGE_META, EXPLORE_ORDER } from '../../app/pages';
import { normaliseUi } from '../../utils/uiPrefs';
import { useViewMonth, monthName } from '../../app/month';
import { debtLedger, debtTotals } from '../../utils/debts';
import MonthSwitcher from '../../components/MonthSwitcher';
import { formatMoneyCompact, entryCurrency } from '../../utils/money';
import { formatEntryAmount } from '../../utils/money';

const linkBtn = { padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const rupees = (n) => formatMoneyCompact(n);   // compact: no paise
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function TodayTab(props) {
  const { transactions = [], income = [], onAdd, onAddIncome, theme, settings, recurring, selectedPeriod } = props;
  const shell = useShell();
  const ui = useMemo(() => normaliseUi(settings?.ui), [settings?.ui]);
  const homeSections = ui.home;
  const { month: monthKey, isNow, period } = useViewMonth(selectedPeriod);
  const { stats } = useStats(transactions, income, period, theme, settings);
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const [quick, setQuick] = useState('');

  const budgetStatus = useMemo(
    () => computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey, rules: categoryRules }),
    [settings?.budgets, transactions, monthKey, categoryRules],
  );
  const safeToday = budgetStatus.hasBudget && budgetStatus.total.limit ? budgetStatus.total : null;   // budget for the month on screen

  const now = new Date();
  const todayKey = toKey(now);
  const todayExpense = transactions
    .filter((t) => t.type === 'expense' && new Date(t.date).toDateString() === now.toDateString())
    .reduce((s, t) => s + t.amount, 0);
  const monthAbbr = monthName(monthKey, { month: 'short' });
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Bills: late + the next seven days
  const existingIds = useMemo(() => {
    const s = new Set();
    transactions.forEach((t) => s.add(t.id));
    income.forEach((i) => s.add(i.id));
    return s;
  }, [transactions, income]);
  const rules = useMemo(() => recurring?.rules ?? [], [recurring?.rules]);
  const soon = upcomingBills(rules, existingIds, todayKey, 7);
  const lateCount = soon.filter((b) => b.status === 'overdue').length;

  // Recent entries: the last 7 days, newest first (an earlier month: its last entries)
  const recent = useMemo(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 6);
    return transactions.filter(t => (isNow ? new Date(t.date) >= since : localMonthKey(t.date) === monthKey))
      .sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)))
      .slice(0, shell?.desktop ? 20 : 6);
  }, [transactions, isNow, monthKey, shell?.desktop]);
  const dayLabel = (iso) => {
    const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    return d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  /* Quick entry: "chai 20" ⏎ → a categorised expense, dated now. A live
     preview shows exactly what will be saved before you press Add. */
  const parsed = parseQuickEntry(quick);
  const preview = parsed && { name: capitalise(parsed.name), amount: parsed.amount, currency: parsed.currency ?? entryCurrency.get(), category: inferCategory(parsed.name, categoryRules) };
  function submitQuick(e) {
    e.preventDefault();
    if (!preview) return;
    const isoDate = dateInputToISO(todayInputValue());
    const entry = { id: generateId(), type: 'expense', name: preview.name, amount: preview.amount, currency: preview.currency, category: preview.category, date: isoDate, month: isoToMonth(isoDate) };
    onAdd(entry);
    if (shell?.celebrate) shell.celebrate(entry); else shell?.toast(`Added ${preview.name} · ${formatAmount(preview.amount, preview.currency)}`);
    setQuick('');
  }

  // Explore: one live line per page that isn't already in the bar
  const monthTxns = transactions.filter((t) => localMonthKey(t.date) === monthKey);
  const monthIncome = income.filter((i) => localMonthKey(i.date) === monthKey).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const debts = debtTotals(debtLedger(transactions, income));
  const savedThisMonth = monthTxns.filter((t) => t.type === 'savings').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const exploreLine = {
    history: `${monthTxns.length} entr${monthTxns.length === 1 ? 'y' : 'ies'} this month`,
    bills: rules.length ? (lateCount ? `${lateCount} late` : soon.length ? `${soon.length} due this week` : 'Nothing due this week') : 'Add rent, EMIs, SIPs',
    stats: `Calendar & report · ${monthAbbr}`,
    budget: safeToday ? (safeToday.remaining < 0 ? 'Over budget' : `${rupees(safeToday.remaining)} left`) : budgetStatus.hasBudget ? 'Category limits set' : 'Set a monthly budget',
    savings: savedThisMonth ? `${rupees(savedThisMonth)} in ${monthAbbr}` : 'SIPs, funds, goals',
    income: monthIncome ? `${rupees(monthIncome)} in ${monthAbbr}` : 'Nothing yet this month',
    people: debts.owedToYou ? `${rupees(debts.owedToYou)} owed to you` : debts.youOwe ? `You owe ${rupees(debts.youOwe)}` : 'Lent, borrowed, paid back',
    trips: 'Split shared costs',
    external: 'Spent for others',
  };
  const explorePages = EXPLORE_ORDER.filter((k) => !ui.tabs.includes(k));

  const pct = safeToday ? Math.min(100, (safeToday.spent / safeToday.limit) * 100) : 0;
  const heroRef = useRef(null);
  useTilt(heroRef);
  const overviewSection = (
    <div ref={heroRef} className="home-hero" id="home-summary" role={shell ? 'button' : undefined} tabIndex={shell ? 0 : undefined}
      onClick={(e) => { if (!e.target.closest('.month-switcher')) shell?.goTo('stats'); }} style={{ marginBottom: 14, padding: '14px 18px 14px', borderRadius: 26, color: '#fff', cursor: shell ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {shell ? <MonthSwitcher tone="hero" compact /> : <span style={{ fontSize: 12, fontWeight: 700 }}>{monthName(monthKey)}</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
          {safeToday?.status === 'over' && <Sign kind="warn" size={15} style={{ color: '#FFD0D7' }} />}
          {safeToday ? (safeToday.status === 'over' ? 'Over budget' : `${Math.round(pct)}% of budget`) : 'Stats'} <ArrowUpRight size={13} />
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginTop: 10 }}>Spent</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 0, fontVariantNumeric: 'tabular-nums' }}>
        <RollingNumber id="home-spent" value={stats?.totalExpense ?? 0} />
      </div>
      {safeToday && (
        <>
          <LiquidGauge variant="bar" fraction={safeToday.limit ? safeToday.spent / safeToday.limit : 0} style={{ marginTop: 10 }} />
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
            {safeToday.status === 'over'
              ? <><strong>{formatAmount(Math.abs(safeToday.remaining))}</strong> over the {formatAmount(safeToday.limit)} budget</>
              : <><strong>{formatAmount(safeToday.remaining)}</strong> left of {formatAmount(safeToday.limit)}</>}
          </div>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
        {isNow ? <Metric label="Today" value={todayExpense} /> : <Metric label="Income" value={stats?.totalIncome ?? 0} />}
        {isNow && safeToday && safeToday.status !== 'over'
          ? <Metric label="Safe to spend today" value={safeToday.safeToday} />
          : <Metric label="Saved" value={stats?.totalSavings ?? 0} />}
        <Metric label="Balance" value={stats?.balance ?? 0} />
      </div>
      {stats?.balanceParts?.length > 0 && (
        <div id="home-balance-fx" style={{ fontSize: 10.5, marginTop: 8, opacity: 0.85, lineHeight: 1.45 }}>
          Balance at today’s rates: {stats.balanceParts.map((p) => formatAmount(p.amount, p.currency)).join(' + ').replace(/\+ -/g, '− ').replace(/\+ −/g, '− ')}
        </div>
      )}
    </div>
  );

  // Wide screens: the full Add form sits right here, open — no window to open, no quick entry
  const addPanel = shell?.desktop && (
    <div className="card home-add-panel" id="home-add-panel" style={{ padding: 16, marginBottom: 14 }}>
      <AddPanel inline compact {...props} onAdd={onAdd} onAddIncome={onAddIncome}
        onSaved={(e) => (shell.celebrate ? shell.celebrate(e) : shell.toast?.(`Added ${e.name} · ${formatAmount(e.amount, e.currency)}`))} />
    </div>
  );

  // Wide screens: the full form only. Phone: quick entry ("chai 20"), with + for everything else.
  const addSection = shell?.desktop ? addPanel : (
    <form className="home-add card" onSubmit={submitQuick} style={{ padding: '6px 6px 6px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <input id="home-quick-entry" value={quick} onChange={(e) => setQuick(e.target.value)} autoComplete="off" enterKeyHint="done"
          placeholder='Quick entry — type "chai 20"' aria-label="Quick entry: name and amount"
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', boxShadow: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, padding: '8px 0', fontFamily: 'inherit' }} />
        <button type="submit" disabled={!preview} style={{ padding: '8px 14px', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: preview ? 'var(--accent)' : 'var(--surface2)', color: preview ? '#fff' : 'var(--text-muted)', cursor: preview ? 'pointer' : 'default' }}>
          Add
        </button>
      </div>
      {quick.trim() && (
        <div id="quick-preview" style={{ fontSize: 12, padding: '2px 0 6px 24px', color: preview ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {preview
            ? <>Expense · <strong style={{ color: 'var(--text)' }}>{preview.name}</strong> · {formatAmount(preview.amount, preview.currency)} · {categoryMeta(preview.category).label} · today</>
            : 'Add an amount — e.g. "petrol 500" or "250 swiggy"'}
        </div>
      )}
    </form>
  );

  // Only when something needs paying — setting bills up lives on the Bills page
  const billsSection = soon.length > 0 && (
    <div className="home-bills" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 4px 8px' }}>
        <p className="section-label" style={{ margin: 0 }}>{lateCount ? `Due · ${lateCount} late` : 'Due this week'}</p>
        {shell && <button id="home-bills-all" onClick={() => shell.goTo('bills')} style={linkBtn}>All bills</button>}
      </div>
      <div className="card">
        {soon.slice(0, 4).map((b, i) => {
          const d = fromKey(b.dateKey);
          const late = b.status === 'overdue';
          return (
            <div key={`${b.rule.id}|${b.dateKey}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 38, flexShrink: 0, textAlign: 'center', padding: '4px 0', borderRadius: 11, background: late ? 'var(--expense-bg)' : 'var(--surface2)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1, color: late ? 'var(--expense)' : 'var(--text)' }}>{d.getDate()}</div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.rule.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: late ? 'var(--expense)' : b.status === 'today' ? 'var(--lent)' : 'var(--text-muted)', marginTop: 1 }}>
                  {b.rule.autoPost ? `Auto · ${dueLabel(b.dateKey, todayKey)}` : dueLabel(b.dateKey, todayKey)}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(b.amount)}</span>
              {!b.rule.autoPost && recurring?.post && (
                <button id={`home-pay-${b.rule.id}`} onClick={async () => {
                  if (await recurring.post({ rule: b.rule, dateKey: b.dateKey, paidOn: b.dateKey > todayKey ? todayKey : null })) shell?.toast(`Paid ${b.rule.name} · ${formatAmount(b.amount)}`);
                }} style={{ padding: '7px 13px', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: b.status === 'upcoming' ? 'var(--surface2)' : 'var(--income)', color: b.status === 'upcoming' ? 'var(--text-secondary)' : '#fff' }}>
                  Pay
                </button>
              )}
            </div>
          );
        })}
        {soon.length > 4 && (
          <button onClick={() => shell?.goTo('bills')} style={{ width: '100%', padding: '10px', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            {soon.length - 4} more
          </button>
        )}
      </div>
    </div>
  );

  const exploreSection = shell && explorePages.length > 0 && (
    <div className="home-explore" style={{ marginBottom: 14 }}>
      <p className="section-label" style={{ margin: '4px 4px 8px' }}>Explore</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {explorePages.map((k) => {
          const { label, Icon, tone } = PAGE_META[k];
          return (
            <button key={k} id={`explore-${k}`} className="card explore-card" onClick={() => shell.goTo(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 }}>
              <span className="explore-icon" style={{ width: 36, height: 36, borderRadius: 12, background: `var(--${tone}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} strokeWidth={2} style={{ color: `var(--${tone})` }} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exploreLine[k]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const recentSection = (
    <div className="home-recent" style={{ marginBottom: 6 }}>
    {recent.length > 0 ? (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 4px 8px' }}>
          <p className="section-label" style={{ margin: 0 }}>{isNow ? 'Recent activity' : `Last entries in ${monthName(monthKey, { month: 'long' })}`}</p>
          {shell && <button id="home-see-all" onClick={() => shell.goTo('history')} style={linkBtn}>All history</button>}
        </div>
        <div className="card" id="recent-entries">
          {recent.map((txn, i) => {
            // Pick the right color meta: direction-aware for person, type-based otherwise
            const t = txn.type === 'person'
              ? getDirectionMeta(txn.direction)
              : (TYPES.find(x => x.key === txn.type) || TYPES[0]);
            const dirMeta = txn.type === 'person' ? getDirectionMeta(txn.direction) : null;
            return (
              <div key={txn.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: t.bg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {txn.type === 'person'
                      ? <Users size={14} style={{ color: t.color }} />
                      : <t.Icon size={14} style={{ color: t.color }} />
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 500, color: 'var(--text)',
                      display: 'block', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {txn.name}
                    </span>
                    {txn.type === 'expense' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{dayLabel(txn.date)}</span>
                        <CategoryBadge category={categoryOf(txn, categoryRules)} compact theme={theme} />
                        {txn.recurringId && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>recurring</span>}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 6 }}>{dayLabel(txn.date)}</span>
                        {txn.type === 'person'
                          ? dirMeta?.label ?? 'Person'
                          : `${txn.savingsType ? txn.savingsType.toUpperCase() : 'Savings'}${txn.platform ? ' · ' + txn.platform : ''}`
                        }
                      </span>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: t.color,
                  marginLeft: 12, flexShrink: 0,
                }}>
                  {txn.type === 'person' && txn.direction === 'repayment' ? '+' : ''}{formatEntryAmount(txn)}
                </span>
              </div>
            );
          })}
        </div>
      </>
    ) : (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px', gap: 12,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Coins size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {isNow ? 'Nothing logged this week' : `Nothing logged in ${monthName(monthKey, { month: 'long' })}`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Add an entry above — it shows up here
          </p>
        </div>
      </div>
    )}
    </div>
  );

  function section(key) {
    if (key === 'overview') return overviewSection;
    if (key === 'add') return addSection;
    if (key === 'bills') return billsSection;
    if (key === 'explore') return exploreSection;
    if (key === 'recent') return recentSection;
    return null;
  }

  return (
    <div className="tab-root">
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 1 }}>
              {greeting}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ProfileButton />
          </div>
        </div>
      </div>

      <div className={`home-body${shell?.desktop ? ' home-fit' : ''}`} style={{ flex: 1, overflow: 'auto', padding: '14px 16px 20px' }}>
        {shell?.desktop ? (
          // Wide screens, one screen, no scrolling: what you do (overview, entry)
          // beside where to go (explore, bills, recent — which fills the rest)
          <div className="home-columns">
            {[['overview', 'add'], ['explore', 'bills', 'recent']].map((keys, i) => (
              <div key={i} className="home-column">
                {homeSections.filter((s) => s.visible && keys.includes(s.key)).map(({ key }) => <Fragment key={key}>{section(key)}</Fragment>)}
              </div>
            ))}
          </div>
        ) : homeSections.filter((s) => s.visible).map(({ key }) => <Fragment key={key}>{section(key)}</Fragment>)}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}><RollingNumber value={value} /></div>
    </div>
  );
}
