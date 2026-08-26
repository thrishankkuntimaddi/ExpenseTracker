import { useRef, useState, useMemo } from 'react';
import { PenLine, IndianRupee, Zap, TrendingDown, Coins, Briefcase, ShoppingCart, PiggyBank, Users, Calendar } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { TRANSACTION_TYPES as TYPES, PERSON_DIRECTIONS, SAVINGS_TYPES, getSavingsType, getDirectionMeta } from '../../utils/typeConfig';
import { useStats } from '../../hooks/useStats';

function AppHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 10,
    }}>
      <img
        src={import.meta.env.BASE_URL + 'Expense.png'}
        alt="Expense Tracker Logo"
        style={{
          width: 36, height: 36, borderRadius: 10,
          objectFit: 'cover',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          Expense Tracker
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
          Smart Financial Tracking
        </div>
      </div>
    </div>
  );
}

export default function TodayTab({ transactions = [], income = [], onAdd, theme }) {
  const { stats } = useStats(transactions, income, { type: 'select_month', month: new Date().toISOString().slice(0, 7) }, theme);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [settlement, setSettlement] = useState('');
  const [externalSource, setExtSource] = useState('');
  const [type, setType] = useState('expense');
  const [direction, setDirection] = useState('lent');
  const [savingsType, setSavingsType] = useState('cash');
  const [platform, setPlatform] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [isCustomName, setIsCustomName] = useState(false);

  const nameRef = useRef(null);
  const amountRef = useRef(null);
  const settlementRef = useRef(null);
  const extSourceRef = useRef(null);

  const debtPersons = useMemo(() => {
    const all = Object.keys(stats?.personDebts || {});
    if (direction === 'repaid') return all.filter(p => (stats.personDebts[p]?.netOwed ?? 0) > 0);
    return [];
  }, [stats?.personDebts, direction]);

  const hasDebtPersons = debtPersons.length > 0;
  const isRepayDirection = type === 'person' && direction === 'repaid';

  const now = new Date();
  const todayTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  });

  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todaySavings = todayTxns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const todayPerson = todayTxns.filter(t => t.type === 'person').reduce((s, t) => s + t.amount, 0);
  const todayTotal = todayExpense + todaySavings + todayPerson;

  function handleNameKey(e) { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); } }
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

  function save() {
    const n = name.trim(), a = parseFloat(amount);
    if (!n || !amount || isNaN(a) || a <= 0) return;

    const isoDate = dateInputToISO(dateInput);
    const entry = {
      id: generateId(), name: n, amount: a, type,
      date: isoDate,
      month: isoToMonth(isoDate),
    };

    if (type === 'person') {
      entry.direction = direction;
    }
    if (type === 'savings') {
      entry.savingsType = savingsType;
      const st = getSavingsType(savingsType);
      if (st.hasPlatform && platform.trim()) {
        entry.platform = platform.trim();
      }
    }

    onAdd(entry);
    setName(''); setAmount(''); setSettlement(''); setExtSource(''); setPlatform('');
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
        <AppHeader />

        {/* Date Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              {now.toLocaleDateString('en-IN', { year: 'numeric' })}
            </div>
          </div>

          {/* Today's total pill */}
          {todayTotal > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--expense-bg)', border: '1px solid var(--expense-border)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <TrendingDown size={12} style={{ color: 'var(--expense)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--expense)' }}>
                {formatAmount(todayTotal)}
              </span>
            </div>
          )}
        </div>

        {/* ── Summary Chips — placed right under date ── */}
        {(todayExpense > 0 || todaySavings > 0 || todayPerson > 0) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <SummaryChip label="Spent" value={todayExpense} color="var(--expense)" bg="var(--expense-bg)" border="var(--expense-border)" Icon={ShoppingCart} />
            <SummaryChip label="Saved" value={todaySavings} color="var(--savings)" bg="var(--savings-bg)" border="var(--savings-border)" Icon={PiggyBank} />
            <SummaryChip label="Given" value={todayPerson} color="var(--person)" bg="var(--person-bg)" border="var(--person-border)" Icon={Users} />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Entry Form Column */}
        <div className="today-form-col" style={{ flex: '0 0 100%', padding: '16px 20px 0' }}>

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
                {isRepayDirection && !isCustomName && hasDebtPersons ? (
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
                      <option value="">-- Select Person to Repay (Debt Left) --</option>
                      {debtPersons.map(p => (
                        <option key={p} value={p}>
                          {p} (Debt Left: {formatAmount(stats.personDebts[p].netOwed)})
                        </option>
                      ))}
                      <option value="__custom__">✏️ Type Custom Name…</option>
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

        {/* Standard Name Input field (for non-repayment, custom name mode, or when no active debt contacts) */}
        {(!isRepayDirection || isCustomName || !hasDebtPersons) && (
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
              placeholder={type === 'person' ? 'Person Name' : 'What did you spend on?'}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleNameKey}
              autoComplete="off"
              style={{
                width: '100%', paddingLeft: 38, paddingRight: isRepayDirection && hasDebtPersons ? 80 : 14,
                paddingTop: 12, paddingBottom: 12,
                borderRadius: 10, fontSize: 14,
                border: '1.5px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text)', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = sel.color)}
              onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
            />
            {isRepayDirection && hasDebtPersons && (
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
                List 📋
              </button>
            )}
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
            max={new Date().toISOString().slice(0, 10)}
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
          onClick={save}
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
    {todayTxns.length > 0 ? (
      <>
        <p className="section-label" style={{ marginBottom: 10 }}>
          Today's Entries — {todayTxns.length}
        </p>
        <div className="card">
          {todayTxns.slice().reverse().map((txn, i) => {
            // Pick the right color meta: direction-aware for person, type-based otherwise
            const t = txn.type === 'person'
              ? getDirectionMeta(txn.direction)
              : (TYPES.find(x => x.key === txn.type) || TYPES[0]);
            const isExternal = txn.type === 'external';
            const extProfit = isExternal ? (txn.settlement ?? txn.amount) - txn.amount : 0;
            const dirMeta = txn.type === 'person' ? getDirectionMeta(txn.direction) : null;
            return (
              <div key={txn.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: i < todayTxns.length - 1 ? '1px solid var(--border)' : 'none',
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
                    <span style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>
                      {txn.type === 'person'
                        ? dirMeta?.label ?? 'Person'
                        : txn.type === 'savings'
                          ? `${txn.savingsType ? txn.savingsType.toUpperCase() : 'Savings'}${txn.platform ? ' · ' + txn.platform : ''}`
                          : t.label
                      }
                    </span>
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
            Nothing logged yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Add your first entry above
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

function SummaryChip({ label, value, color, bg, border, Icon }) {
  if (value === 0) return null;
  return (
    <div style={{
      borderRadius: 10, padding: '7px 12px',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon size={12} style={{ color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{formatAmount(value)}</span>
    </div>
  );
}
