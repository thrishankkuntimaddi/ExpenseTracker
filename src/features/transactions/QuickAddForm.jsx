// ─── QuickAddForm ────────────────────────────────────────────────
// The entry form for expenses, money with people and savings. Used by the
// "+" sheet on phones. Pass `type` to control the kind from outside (the
// sheet's own tabs); otherwise it shows its own type switcher.
import { useRef, useState, useMemo } from 'react';
import { PenLine, IndianRupee, Briefcase, ShoppingCart, PiggyBank, Calendar, ClipboardList } from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { getCurrentMonthValue } from '../../utils/periodHelpers';
import { TRANSACTION_TYPES as TYPES, PERSON_DIRECTIONS, SAVINGS_TYPES, getSavingsType, getDirectionMeta } from '../../utils/typeConfig';
import { useStats } from '../../hooks/useStats';
import { inferCategory, EMPTY_RULES } from '../../utils/categories';
import { parseQuickEntry } from '../../utils/smartInput';
import CategoryPicker from '../../components/CategoryPicker';

export default function QuickAddForm({ transactions = [], income = [], onAdd, theme, settings, onLearnCategory, type: typeProp, initialType = 'expense', onSaved, autoFocus = false }) {
  const { stats } = useStats(transactions, income, { type: 'current_month', value: getCurrentMonthValue() }, theme, settings);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [settlement, setSettlement] = useState('');
  const [typeState, setType] = useState(initialType);
  const type = typeProp ?? typeState;
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
    onSaved?.(entry);
    setName(''); setAmount(''); setSettlement(''); setPlatform('');
    setCategory(null); setCategoryTouched(false);
    setDateInput(todayInputValue());
    nameRef.current?.focus();
  }

  const sel = TYPES.find(t => t.key === type);
  const canSave = !!name.trim() && !!amount && parseFloat(amount) > 0 &&
    (type !== 'external' || (settlement !== '' && parseFloat(settlement) >= 0));

  return (
    <div className="quick-add-form">
          {/* Type Selector */}
          {typeProp == null && <div style={{
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
          </div>}

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
              autoFocus={autoFocus}
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
  );
}
