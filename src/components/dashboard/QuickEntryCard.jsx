// ─── Desktop dashboard: quick-entry form (expense / person / savings) ───
// Form state lives in useQuickEntryForm (owned by DesktopDashboard) so it
// survives switching between dashboard sections, as before the split.
import { PenLine, IndianRupee, Calendar, ClipboardList } from 'lucide-react';
import { formatAmount, todayInputValue } from '../../utils/dateHelpers';
import { TRANSACTION_TYPES, PERSON_DIRECTIONS, SAVINGS_TYPES, getSavingsType } from '../../utils/typeConfig';
import { DCard, CardHeader } from './ui';
import { inputStyle, focusHandlers } from './formStyles';
import CategoryPicker from '../CategoryPicker';

export default function QuickEntryCard({ form, stats, todayTotal, todayCount }) {
  const {
    name, setName, amount, setAmount, dateInput, setDateInput,
    type, setType, direction, setDirection, savingsType, setSavingsType,
    platform, setPlatform, isFullPayment, setIsFullPayment, isCustomName, setIsCustomName,
    nameRef, amountRef, debtPersons, hasDebtPersons, isRepayDirection, sel, saveEntry,
    suggestedCategory, effectiveCategory, pickCategory, handleNameEnter,
  } = form;

  return (
    <DCard style={{ flexShrink: 0 }}>
      <CardHeader
        title="Quick Entry"
        sub={`Today: ${formatAmount(todayTotal)} · ${todayCount} entries`}
      />
      <div style={{ padding: '14px 18px 18px' }}>
        {/* Type picker */}
        <div style={{
          display: 'flex', background: 'var(--surface2)',
          borderRadius: 11, padding: 3, marginBottom: 12,
          border: '1px solid var(--border)',
          position: 'relative', overflow: 'hidden',
        }}>
          {TRANSACTION_TYPES.map(t => (
            <button
              key={t.key}
              id={`desktop-type-${t.key}`}
              onClick={() => setType(t.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: type === t.key ? t.color : 'transparent',
                color: type === t.key ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s',
                position: 'relative', zIndex: type === t.key ? 1 : 0,
                boxShadow: type === t.key ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
              }}
            >
              <t.Icon size={11} />{t.label}
            </button>
          ))}
        </div>

        {/* Person Direction Toggle */}
        {type === 'person' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {PERSON_DIRECTIONS.map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDirection(d.key)}
                style={{
                  flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
                  background: direction === d.key ? d.color + '22' : 'transparent',
                  color: direction === d.key ? d.color : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <d.Icon size={12} />
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Savings Sub-Category */}
        {type === 'savings' && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {SAVINGS_TYPES.map(st => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSavingsType(st.key)}
                  style={{
                    padding: '4px 8px', borderRadius: 14, fontSize: 10, fontWeight: 700,
                    border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                    background: savingsType === st.key ? st.color + '22' : 'transparent',
                    color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
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
                style={{ ...inputStyle, paddingLeft: 12, marginBottom: 4 }}
              />
            )}
          </div>
        )}

        {/* Person Name Selection / Dropdown (only uncleared debt contacts) */}
        {isRepayDirection && !isCustomName ? (
          <div style={{ marginBottom: 8 }}>
            <select
              id="desktop-select-repayment-person"
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
                const debt = direction === 'repaid'
                  ? (stats.personDebts?.[val]?.netOwed ?? 0)
                  : (stats.personDebts?.[val]?.netLent ?? 0);
                if (debt > 0) {
                  setAmount(debt.toString());
                  setIsFullPayment(true);
                } else {
                  setAmount('');
                }
              }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 12,
                border: `1.5px solid ${direction === 'repaid' ? 'var(--person)' : 'var(--income)'}`,
                background: 'var(--input-bg)', color: 'var(--text)',
                outline: 'none', fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              <option value="">
                {hasDebtPersons
                  ? (direction === 'repaid' ? '-- Select Person to Repay (Debt Left) --' : '-- Select Person Who Repaid You --')
                  : '-- No Active Debts (Type Custom Name) --'
                }
              </option>
              {debtPersons.map(p => (
                <option key={p} value={p}>
                  {p} ({direction === 'repaid'
                    ? `Debt Left: ${formatAmount(stats.personDebts[p].netOwed)}`
                    : `Owes You: ${formatAmount(stats.personDebts[p].netLent)}`
                  })
                </option>
              ))}
              <option value="__custom__">Type a custom name…</option>
            </select>

            {name && name !== '__custom__' && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: direction === 'repaid' ? 'var(--person-bg)' : 'var(--income-bg)', border: `1px solid ${direction === 'repaid' ? 'var(--person-border)' : 'var(--income-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: direction === 'repaid' ? 'var(--person)' : 'var(--income)' }}>
                  {direction === 'repaid'
                    ? `Pending Debt: ${formatAmount(stats.personDebts?.[name]?.netOwed ?? 0)}`
                    : `Owes You: ${formatAmount(stats.personDebts?.[name]?.netLent ?? 0)}`
                  }
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: direction === 'repaid' ? 'var(--person)' : 'var(--income)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isFullPayment}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsFullPayment(checked);
                      if (checked) {
                        const fullAmt = direction === 'repaid'
                          ? (stats.personDebts?.[name]?.netOwed ?? 0)
                          : (stats.personDebts?.[name]?.netLent ?? 0);
                        setAmount(fullAmt.toString());
                      }
                    }}
                  />
                  Full {direction === 'repaid' ? 'Payment' : 'Repayment'}
                </label>
              </div>
            )}
          </div>
        ) : null}

        {/* Standard Name Input field (for non-repayment or custom name mode) */}
        {(!isRepayDirection || isCustomName) && (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <PenLine size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="desktop-input-name" ref={nameRef} type="text"
              placeholder={type === 'person' ? 'Person Name' : type === 'expense' ? 'Description… (tip: “chai 20” ⏎)' : 'Description…'}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleNameEnter())}
              autoComplete="off"
              style={{ ...inputStyle, paddingRight: isRepayDirection ? 70 : 12 }}
              {...focusHandlers(sel.color)}
            />
            {isRepayDirection && (
              <button
                type="button"
                onClick={() => { setIsCustomName(false); setName(''); setAmount(''); }}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><ClipboardList size={12} />List</span>
              </button>
            )}
          </div>
        )}

        {/* Category — expenses only */}
        {type === 'expense' && (
          <div style={{ marginBottom: 8 }}>
            <CategoryPicker size="sm" value={effectiveCategory} suggested={suggestedCategory} onChange={pickCategory} label={null} />
          </div>
        )}

        {/* Amount */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <IndianRupee size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            id="desktop-input-amount" ref={amountRef} type="text"
            placeholder="0.00" value={amount}
            onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveEntry())}
            inputMode="decimal" autoComplete="off"
            style={{ ...inputStyle, fontSize: 15, fontWeight: 700 }}
            {...focusHandlers(sel.color)}
          />
        </div>

        {/* Date */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Calendar size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="date"
            value={dateInput}
            max={todayInputValue()}
            onChange={e => setDateInput(e.target.value)}
            style={inputStyle}
            {...focusHandlers(sel.color)}
          />
        </div>

        <button
          id="desktop-btn-save"
          onClick={() => saveEntry()}
          disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
          style={{
            width: '100%', padding: '10px', borderRadius: 10,
            fontSize: 12, fontWeight: 700,
            background: (name.trim() && amount && parseFloat(amount) > 0) ? sel.color : 'var(--surface2)',
            color: (name.trim() && amount && parseFloat(amount) > 0) ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          Add {type === 'person' ? (direction === 'repayment' ? 'Repayment' : 'Lent Money') : sel.label} ↵
        </button>
      </div>
    </DCard>
  );
}
