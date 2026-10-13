import { useMemo, useState, Fragment } from 'react';
import {
  Coins, Users, Search, Zap, ArrowUpRight, List, Wallet, Sparkles, CalendarDays, Target, Repeat, Flag,
  ReceiptText, Plane, Bell, Database,
} from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { getCurrentMonthValue } from '../../utils/periodHelpers';
import { TRANSACTION_TYPES as TYPES, getDirectionMeta } from '../../utils/typeConfig';
import { useStats } from '../../hooks/useStats';
import { inferCategory, categoryOf, categoryMeta, EMPTY_RULES } from '../../utils/categories';
import { parseQuickEntry } from '../../utils/smartInput';
import { computeBudgetStatus } from '../../utils/budget';
import { CategoryBadge } from '../../components/CategoryPicker';
import DueRecurringCard from '../plan/components/DueRecurringCard';
import ProfileButton from '../../components/ProfileButton';
import { useShell } from '../../app/shellContext';
import { ADD_KINDS } from '../../app/pages';
import { normaliseUi } from '../../utils/uiPrefs';

/* Home tiles: every feature one tap away (PhonePe-style service grid). */
const SHORTCUTS = [
  { key: 'history',   label: 'History',   Icon: List,         color: '#D97706', go: ['history'] },
  { key: 'income',    label: 'Income',    Icon: Wallet,       color: '#059669', go: ['income'] },
  { key: 'insights',  label: 'Insights',  Icon: Sparkles,     color: '#2563EB', go: ['stats'] },
  { key: 'calendar',  label: 'Calendar',  Icon: CalendarDays, color: '#E11D48', go: ['stats', { anchor: 'stats-calendar' }] },
  { key: 'budget',    label: 'Budget',    Icon: Target,       color: '#0891B2', go: ['plan', { anchor: 'plan-budget' }] },
  { key: 'recurring', label: 'Recurring', Icon: Repeat,       color: '#7C3AED', go: ['plan', { anchor: 'plan-recurring' }] },
  { key: 'goals',     label: 'Goals',     Icon: Flag,         color: '#16A34A', go: ['plan', { anchor: 'plan-goals' }] },
  { key: 'people',    label: 'People',    Icon: Users,        color: '#C2410C', go: ['people'] },
  { key: 'billings',  label: 'Billings',  Icon: ReceiptText,  color: '#4F46E5', go: ['external', { mode: 'billings' }] },
  { key: 'trips',     label: 'Trips',     Icon: Plane,        color: '#0EA5E9', go: ['external', { mode: 'trips' }] },
  { key: 'reminders', label: 'Reminders', Icon: Bell,         color: '#DB2777', go: ['profile', { openGroup: 'reminders' }] },
  { key: 'backup',    label: 'Backup',    Icon: Database,     color: '#475569', go: ['profile', { openGroup: 'data-management' }] },
];

const linkBtn = { padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };

export default function TodayTab({ transactions = [], income = [], onAdd, theme, settings, recurring }) {
  const shell = useShell();
  const homeSections = useMemo(() => normaliseUi(settings?.ui).home, [settings?.ui]);
  const { stats } = useStats(transactions, income, { type: 'current_month', value: getCurrentMonthValue() }, theme, settings);
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const [quick, setQuick] = useState('');

  const budgetStatus = useMemo(
    () => computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey: getCurrentMonthValue(), rules: categoryRules }),
    [settings?.budgets, transactions, categoryRules],
  );
  const safeToday = budgetStatus.hasBudget && budgetStatus.total.limit ? budgetStatus.total : null;

  const now = new Date();
  const todayExpense = transactions
    .filter((t) => t.type === 'expense' && new Date(t.date).toDateString() === now.toDateString())
    .reduce((s, t) => s + t.amount, 0);
  const monthShort = now.toLocaleDateString('en-IN', { month: 'long' });
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dueCount = recurring?.manualDue?.length ?? 0;

  // Recent entries: the last 7 days, newest first
  const recent = useMemo(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 6);
    return transactions.filter(t => new Date(t.date) >= since)
      .sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)))
      .slice(0, 8);
  }, [transactions]);
  const dayLabel = (iso) => {
    const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    return d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  /* "chai 20" ⏎ → an expense, categorised, dated now. Anything that doesn't
     parse opens the full form instead. */
  function submitQuick(e) {
    e.preventDefault();
    const parsed = parseQuickEntry(quick);
    if (!parsed) { shell?.openAdd('expense'); return; }
    const isoDate = dateInputToISO(todayInputValue());
    const category = inferCategory(parsed.name, categoryRules);
    onAdd({ id: generateId(), type: 'expense', name: parsed.name, amount: parsed.amount, category, date: isoDate, month: isoToMonth(isoDate) });
    shell?.toast(`Added ${parsed.name} · ${formatAmount(parsed.amount)} · ${categoryMeta(category).label}`);
    setQuick('');
  }

  const pct = safeToday ? Math.min(100, (safeToday.spent / safeToday.limit) * 100) : 0;
  const overviewSection = (
    <div className="home-hero" id="home-summary" role={shell ? 'button' : undefined} tabIndex={shell ? 0 : undefined}
      onClick={() => shell?.goTo('stats')} style={{ marginBottom: 14, padding: '16px 18px 14px', borderRadius: 26, color: '#fff', cursor: shell ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>Spent in {monthShort}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
          {safeToday ? (safeToday.status === 'over' ? 'Over budget' : `${Math.round(pct)}% of budget`) : 'Insights'} <ArrowUpRight size={13} />
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {formatAmount(stats?.totalExpense ?? 0)}
      </div>
      {safeToday && (
        <>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.22)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: safeToday.status === 'over' ? '#FDA4AF' : safeToday.status === 'warn' || safeToday.status === 'pace' ? '#FDE68A' : '#FFFFFF' }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
            {safeToday.status === 'over'
              ? <><strong>{formatAmount(Math.abs(safeToday.remaining))}</strong> over the {formatAmount(safeToday.limit)} budget</>
              : <><strong>{formatAmount(safeToday.remaining)}</strong> left of {formatAmount(safeToday.limit)}</>}
          </div>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
        <Metric label="Today" value={formatAmount(todayExpense)} />
        {safeToday && safeToday.status !== 'over'
          ? <Metric label="Safe to spend today" value={formatAmount(safeToday.safeToday)} />
          : <Metric label="Saved" value={formatAmount(stats?.totalSavings ?? 0)} />}
        <Metric label="Balance" value={formatAmount(stats?.balance ?? 0)} />
      </div>
    </div>
  );

  const addSection = (
    <form className="home-add card" onSubmit={submitQuick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', marginBottom: 14 }}>
      <Zap size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <input id="home-quick-entry" value={quick} onChange={(e) => setQuick(e.target.value)} autoComplete="off" enterKeyHint="done"
        placeholder='Quick entry — try "chai 20"' aria-label="Quick entry: name and amount"
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', boxShadow: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, padding: '8px 0', fontFamily: 'inherit' }} />
      <button type="submit" disabled={!quick.trim()} style={{ padding: '8px 14px', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: quick.trim() ? 'var(--accent)' : 'var(--surface2)', color: quick.trim() ? '#fff' : 'var(--text-muted)', cursor: quick.trim() ? 'pointer' : 'default' }}>
        Add
      </button>
    </form>
  );

  const actionsSection = shell && (
    <div className="home-actions" style={{ marginBottom: 14 }}>
      <div className="card" style={{ padding: '14px 8px 6px', marginBottom: 12 }}>
        <p className="section-label" style={{ margin: '0 8px 10px' }}>Quick add</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {ADD_KINDS.map(({ key, label, Icon, color, bg }) => (
            <Tile key={key} id={`quick-${key}`} label={label} onClick={() => shell.openAdd(key)}>
              <span className="tile-icon" style={{ background: bg }}><Icon size={20} style={{ color }} /></span>
            </Tile>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: '14px 8px 6px' }}>
        <p className="section-label" style={{ margin: '0 8px 10px' }}>Manage money</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 4 }}>
          {SHORTCUTS.map(({ key, label, Icon, color, go }) => (
            <Tile key={key} id={`shortcut-${key}`} label={label} onClick={() => shell.goTo(...go)} badge={key === 'recurring' ? dueCount : 0}>
              <span className="tile-icon tile-icon-solid" style={{ background: color }}><Icon size={19} style={{ color: '#fff' }} /></span>
            </Tile>
          ))}
        </div>
      </div>
    </div>
  );

  const recentSection = (
    <div className="home-recent" style={{ marginBottom: 6 }}>
    {recent.length > 0 ? (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 4px 8px' }}>
          <p className="section-label" style={{ margin: 0 }}>Recent activity</p>
          {shell && <button id="home-see-all" onClick={() => shell.goTo('history')} style={linkBtn}>See all</button>}
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
                  {txn.type === 'person' && txn.direction === 'repayment' ? '+' : ''}{formatAmount(txn.amount)}
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
            Nothing logged this week
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
    if (key === 'actions') return actionsSection;
    if (key === 'recent') return recentSection;
    if (key === 'due' && recurring) {
      return <DueRecurringCard due={recurring.manualDue} onPost={recurring.post} onSkip={recurring.skip} onSkipAll={recurring.skipAllFor} compact collapsible />;
    }
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
            {shell && (
              <button id="home-search" onClick={() => shell.goTo('history', { focus: 'history-search' })} aria-label="Search transactions"
                style={{ width: 34, height: 34, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Search size={16} />
              </button>
            )}
            <ProfileButton />
          </div>
        </div>
      </div>

      <div className="home-body" style={{ flex: 1, overflow: 'auto', padding: '14px 16px 20px' }}>
        {homeSections.filter((s) => s.visible).map(({ key }) => <Fragment key={key}>{section(key)}</Fragment>)}
      </div>
    </div>
  );
}

function Tile({ id, label, onClick, badge = 0, children }) {
  return (
    <button id={id} className="home-tile" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 2px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
      {children}
      {badge > 0 && <span className="tile-badge">{badge > 9 ? '9+' : badge}</span>}
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
