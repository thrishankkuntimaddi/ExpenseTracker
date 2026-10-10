import { useRef, useState, useMemo } from 'react';
import { PenLine, IndianRupee, Zap, TrendingDown, Coins, Briefcase, ShoppingCart, PiggyBank, Users, Calendar, ClipboardList } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { getCurrentMonthValue } from '../../utils/periodHelpers';
import { TRANSACTION_TYPES as TYPES, PERSON_DIRECTIONS, SAVINGS_TYPES, getSavingsType, getDirectionMeta } from '../../utils/typeConfig';
import { useStats } from '../../hooks/useStats';
import { inferCategory, categoryOf, EMPTY_RULES } from '../../utils/categories';
import { parseQuickEntry } from '../../utils/smartInput';
import { computeBudgetStatus } from '../../utils/budget';
import CategoryPicker, { CategoryBadge } from '../../components/CategoryPicker';
import DueRecurringCard from '../plan/components/DueRecurringCard';

export default function TodayTab({ transactions = [], income = [], onAdd, theme, settings, recurring, onLearnCategory }) {
  const { stats } = useStats(transactions, income, { type: 'current_month', value: getCurrentMonthValue() }, theme, settings);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [settlement, setSettlement] = useState('');
  const [type, setType] = useState('expense');
  const [direction, setDirection] = useState('lent');
  const [savingsType, setSavingsType] = useState('cash');
  const [platform, setPlatform] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [isCustomName, setIsCustomName] = useState(false);

  const nameRef = useRef(null);
  const amountRef = useRef(null);
  const settlementRef = useRef(null);

  const debtPersons = useMemo(() => {
    const all = Object.keys(stats?.personDebts || {});
    if (direction === 'repaid') return all.filter(p => (stats.personDebts[p]?.netOwed ?? 0) > 0);
    return [];
  }, [stats?.personDebts, direction]);

  const hasDebtPersons = debtPersons.length > 0;
  const isRepayDirection = type === 'person' && direction === 'repaid';

  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;
  const suggestedCategory = type === 'expense' ? inferCategory(name, categoryRules) : null;
  const effectiveCategory = type === 'expense' ? (categoryTouched && category ? category : suggestedCategory) : null;

  const budgetStatus = useMemo(
    () => computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey: getCurrentMonthValue(), rules: categoryRules }),
    [settings?.budgets, transactions, categoryRules],
  );
  const safeToday = budgetStatus.hasBudget && budgetStatus.total.limit ? budgetStatus.total : null;

  const now = new Date();
  const todayTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  });

  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Recent entries: the last 7 days, newest first (not only today — an empty
  // "nothing logged" screen hid everything you'd just entered yesterday)
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

  function handleNameKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // "chai 20" ⏎ → name "chai", amount 20, saved in one go
    if (!amount) {
      const parsed = parseQuickEntry(name);
      if (parsed) { save({ name: parsed.name, amount: String(parsed.amount) }); return; }
    }
    amountRef.current?.focus();
  }
  function handleAmountKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      type === 'external' ? settlementRef.current?.focus() : save();
    }
  }
  function handleAmountInput(e) {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
  }

  function save(override = {}) {
    const rawName = override.name ?? name, rawAmount = override.amount ?? amount;
    const n = rawName.trim(), a = parseFloat(rawAmount);
    if (!n || !rawAmount || isNaN(a) || a <= 0) return;

    const isoDate = dateInputToISO(dateInput);
    const entry = {
      id: generateId(), name: n, amount: a, type,
      date: isoDate,
      month: isoToMonth(isoDate),
    };

    if (type === 'person') {
      entry.direction = direction;
    }
    if (type === 'expense') {
      const cat = categoryTouched && category ? category : inferCategory(n, categoryRules);
      entry.category = cat;
      if (categoryTouched) onLearnCategory?.(n, cat);
    }
    if (type === 'savings') {
      entry.savingsType = savingsType;
      const st = getSavingsType(savingsType);
      if (st.hasPlatform && platform.trim()) {
        entry.platform = platform.trim();
      }
    }

    onAdd(entry);
    setName(''); setAmount(''); setSettlement(''); setPlatform('');
    setCategory(null); setCategoryTouched(false);
    setDateInput(todayInputValue());
    nameRef.current?.focus();
  }

  const sel = TYPES.find(t => t.key === type);
  const canSave = !!name.trim() && !!amount && parseFloat(amount) > 0 &&
    (type !== 'external' || (settlement !== '' && parseFloat(settlement) >= 0));

  return (
    <div className="tab-root">

      {/* ── Header ── */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{monthName}</div>
        </div>

        {/* Month at a glance: what you'd open the app to check */}
        <div id="home-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
          <SummaryTile label="Spent this month" value={formatAmount(stats?.totalExpense ?? 0)} color="var(--expense)" />
          <SummaryTile label="Today" value={formatAmount(todayExpense)} color="var(--text)" />
          {safeToday
            ? <SummaryTile label={safeToday.status === 'over' ? 'Over budget' : 'Budget left'} value={formatAmount(Math.abs(safeToday.remaining))} color={safeToday.status === 'over' ? 'var(--expense)' : 'var(--income)'} />
            : <SummaryTile label="Balance" value={formatAmount(stats?.balance ?? 0)} color={(stats?.balance ?? 0) < 0 ? 'var(--expense)' : 'var(--income)'} />}
        </div>
        {safeToday && safeToday.status !== 'over' && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Safe to spend today: <strong style={{ color: 'var(--income)' }}>{formatAmount(safeToday.safeToday)}</strong>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Entry Form Column */}
        <div className="today-form-col" style={{ flex: '0 0 100%', padding: '16px 20px 0' }}>

          {recurring && (
            <DueRecurringCard due={recurring.manualDue} onPost={recurring.post} onSkip={recurring.skip} onSkipAll={recurring.skipAllFor} compact />
          )}

          {/* Type Selector */}
          <div style={{
            display: 'flex', gap: 0,
            background: 'var(--surface2)',
            borderRadius: 14, padding: 4, marginBottom: 14,
            border: '1px solid var(--border)',
          }}>
            {TYPES.map(t => (
              <button
                key={t.key}
                id={`type-${t.key}`}
                onClick={() => setType(t.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 4px', borderRadius: 10,
                  fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: type === t.key ? t.color : 'transparent',
                  color: type === t.key ? '#fff' : 'var(--text-secondary)',
                  boxShadow: type === t.key ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <t.Icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Entry Card */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 16,
            border: `1.5px solid ${type === 'person' ? getDirectionMeta(direction).border : sel.border}`,
            boxShadow: 'var(--shadow)',
            padding: 16,
            marginBottom: 16,
          }}>
            {/* Type indicator band — direction-aware for person */}
            <div style={{
              height: 3, borderRadius: 99,
              background: type === 'person' ? getDirectionMeta(direction).color : sel.color,
              marginBottom: 14, opacity: 0.7,
            }} />

            {/* Person Direction Toggle */}
            {type === 'person' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {PERSON_DIRECTIONS.map(d => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDirection(d.key)}
                      style={{
                        padding: '9px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
                        background: direction === d.key ? d.color + '22' : 'transparent',
                        color: direction === d.key ? d.color : 'var(--text-secondary)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        textAlign: 'center',
                      }}
                    >
                      <d.Icon size={12} flexShrink={0} />
                      <span style={{ lineHeight: 1.2 }}>{d.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dropdown for Debt Repayment (only active/uncleared debts) */}
                {isRepayDirection && !isCustomName ? (
                  <div style={{ marginBottom: 10 }}>
                    <select
                      value={name}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomName(true);
                          setName('');
                          setAmount('');
                          setIsFullPayment(false);
                          return;
                        }
                        setName(val);
                        setIsFullPayment(false);
                        const debt = stats.personDebts?.[val]?.netOwed ?? 0;
                        if (debt > 0) {
                          setAmount(debt.toString());
                          setIsFullPayment(true);
                        } else {
                          setAmount('');
                        }
                      }}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                        border: '1.5px solid var(--person)',
                        background: 'var(--input-bg)', color: 'var(--text)',
                        outline: 'none', fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >
                      <option value="">
                        {hasDebtPersons ? '-- Select Person to Repay (Debt Left) --' : '-- No Active Debts (Type Custom Name) --'}
                      </option>
                      {debtPersons.map(p => (
                        <option key={p} value={p}>
                          {p} (Debt Left: {formatAmount(stats.personDebts[p].netOwed)})
                        </option>
                      ))}
                      <option value="__custom__">Type a custom name…</option>
                    </select>

                    {name && name !== '__custom__' && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--person)',
                        fontWeight: 700, marginTop: 6, padding: '8px 10px', borderRadius: 8,
                        background: 'var(--person-bg)',
                        border: '1px solid var(--person-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span>Pending Debt: {formatAmount(stats.personDebts?.[name]?.netOwed ?? 0)}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isFullPayment}
                            onChange={e => {
                              const checked = e.target.checked;
                              setIsFullPayment(checked);
                              if (checked) {
                                const fullAmt = stats.personDebts?.[name]?.netOwed ?? 0;
                                setAmount(fullAmt.toString());
                              }
                            }}
                          />
                          Full Payment
                        </label>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

        {/* Savings Sub-Category Selector */}
        {type === 'savings' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Investment Type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SAVINGS_TYPES.map(st => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSavingsType(st.key)}
                  style={{
                    padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                    background: savingsType === st.key ? st.color + '22' : 'transparent',
                    color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
            {getSavingsType(savingsType).hasPlatform && (
              <input
                type="text"
                placeholder="Platform (e.g. Angel One, Zerodha)"
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                style={{
                  width: '100%', marginTop: 8, padding: '9px 12px',
                  borderRadius: 10, fontSize: 13,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            )}
          </div>
        )}

        {/* Standard Name Input field (for non-repayment or custom name mode) */}
        {(!isRepayDirection || isCustomName) && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <PenLine size={14} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              id="input-name"
              ref={nameRef}
              type="text"
              placeholder={type === 'person' ? 'Person Name' : type === 'expense' ? 'Description… (tip: “chai 20” ⏎)' : 'Description…'}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleNameKey}
              autoComplete="off"
              style={{
                width: '100%', paddingLeft: 38, paddingRight: isRepayDirection ? 80 : 14, paddingTop: 11, paddingBottom: 11,
                borderRadius: 10, fontSize: 14,
                border: '1.5px solid var(--input-border)',
                background: 'var(--input-bg)', color: 'var(--text)',
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = type === 'person' ? getDirectionMeta(direction).color : sel.color)}
              onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
            />
            {isRepayDirection && (
              <button
                type="button"
                onClick={() => { setIsCustomName(false); setName(''); setAmount(''); }}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><ClipboardList size={12} />List</span>
              </button>
            )}
          </div>
        )}

        {/* Category (expenses only) — auto-suggested from the name */}
        {type === 'expense' && (
          <div style={{ marginBottom: 12 }}>
            <CategoryPicker
              size="sm"
              value={effectiveCategory}
              suggested={suggestedCategory}
              onChange={(c) => { setCategory(c); setCategoryTouched(true); }}
              theme={theme}
            />
          </div>
        )}

        {/* Amount */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <IndianRupee size={14} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            id="input-amount"
            ref={amountRef}
            type="text"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountInput}
            onKeyDown={handleAmountKey}
            inputMode="decimal"
            autoComplete="off"
            style={{
              width: '100%', paddingLeft: 38, paddingRight: 14,
              paddingTop: 12, paddingBottom: 12,
              borderRadius: 10, fontSize: 22, fontWeight: 700,
              border: '1.5px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text)', outline: 'none',
              fontFamily: 'inherit', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = sel.color)}
            onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
          />
        </div>

        {/* Date Selection */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Calendar size={14} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="date"
            value={dateInput}
            max={todayInputValue()}
            onChange={e => setDateInput(e.target.value)}
            style={{
              width: '100%', paddingLeft: 38, paddingRight: 14,
              paddingTop: 10, paddingBottom: 10,
              borderRadius: 10, fontSize: 13,
              border: '1.5px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text)', outline: 'none',
              fontFamily: 'inherit', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = sel.color)}
            onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
          />
        </div>

        {/* Save Button */}
        <button
          id="btn-save-entry"
          onClick={() => save()}
          disabled={!canSave}
          style={{
            width: '100%', padding: '13px',
            borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: canSave ? (type === 'person' ? getDirectionMeta(direction).color : sel.color) : 'var(--surface2)',
            color: canSave ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            letterSpacing: '0.01em',
          }}
        >
          Add {type === 'person' ? (getDirectionMeta(direction)?.label ?? 'Lent Money') : sel.label}
        </button>
      </div>
    </div>

        {/* Entries List Column */ }
  <div className="today-entries-col" style={{ flex: '0 0 100%', padding: '0 20px 20px' }}>
    {recent.length > 0 ? (
      <>
        <p className="section-label" style={{ marginBottom: 10 }}>
          Recent entries
        </p>
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
      </div >

    <style>{`
        @media (min-width: 1024px) {
          .today-form-col    { flex: 0 0 400px !important; padding: 24px !important; }
          .today-entries-col { flex: 1 1 0% !important; padding: 24px 24px 24px 0 !important; overflow-y: auto; }
        }
        @media (max-width: 1023px) {
          .today-form-col    { flex: 0 0 100% !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
          .today-entries-col { flex: 0 0 100% !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
        }
      `}</style>
    </div >
  );
}

function SummaryTile({ label, value, color }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}
