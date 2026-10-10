// ─── Desktop dashboard: income / borrowed / repayment-received form + list ───
// Form state lives in useIncomeEntryForm (owned by DesktopDashboard) so it
// survives switching between dashboard sections, as before the split.
import { PenLine, IndianRupee, Calendar, Pencil, Trash2, Wallet, HandCoins, ClipboardList } from 'lucide-react';
import { formatAmount, todayInputValue } from '../../utils/dateHelpers';
import { DCard, CardHeader } from './ui';
import { inputStyle, focusHandlers } from './formStyles';

export default function IncomeEntryCard({
  form, stats, filtInc, filtTxns, income, transactions,
  onUpdateIncome, onDeleteIncome, onDeleteTransaction,
  setEditingInc, setDeletingIncId, setDeletingTxnId,
}) {
  const {
    incMode, setIncMode, iName, setIName, iAmount, setIAmount, iDateInput, setIDateInput,
    isICustomName, setIsICustomName, isIFullPayment, setIsIFullPayment,
    iNameRef, iAmountRef, lentPersons, hasLentPersons, saveIncome,
  } = form;

  return (
    <DCard style={{ height: '100%' }}>
      <CardHeader
        title="Income & Inflows"
        right={
          <div style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--income-bg)', color: 'var(--income)', fontSize: 11, fontWeight: 700, border: '1px solid var(--income-border)' }}>
            {formatAmount(filtInc.reduce((s, i) => s + i.amount, 0))}
          </div>
        }
      />
      <div style={{ padding: '12px 16px' }}>
        {/* 3-way mode toggle: Income vs Borrowed vs Repayment Rec */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 9, padding: 2, marginBottom: 10, border: '1px solid var(--border)', gap: 2 }}>
          <button
            type="button"
            onClick={() => { setIncMode('income'); setIName(''); setIAmount(''); setIsICustomName(false); }}
            style={{
              flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: incMode === 'income' ? 'var(--income)' : 'transparent',
              color: incMode === 'income' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Wallet size={12} />Income</span>
          </button>
          <button
            type="button"
            onClick={() => { setIncMode('borrowed'); setIName(''); setIAmount(''); setIsICustomName(false); }}
            style={{
              flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: incMode === 'borrowed' ? 'var(--person)' : 'transparent',
              color: incMode === 'borrowed' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><HandCoins size={12} />Borrowed</span>
          </button>
          <button
            type="button"
            onClick={() => { setIncMode('repaymentRec'); setIName(''); setIAmount(''); setIsICustomName(false); }}
            style={{
              flex: 1, padding: '5px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: incMode === 'repaymentRec' ? '#0891B2' : 'transparent',
              color: incMode === 'repaymentRec' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            ⮐ Repay Rec.
          </button>
        </div>

        {/* Person Dropdown for Repayment Rec. */}
        {incMode === 'repaymentRec' && !isICustomName ? (
          <div style={{ marginBottom: 7 }}>
            <select
              value={iName}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setIsICustomName(true);
                  setIName('');
                  setIAmount('');
                  setIsIFullPayment(false);
                  return;
                }
                setIName(val);
                setIsIFullPayment(false);
                const debt = stats.personDebts?.[val]?.netLent ?? 0;
                if (debt > 0) {
                  setIAmount(debt.toString());
                  setIsIFullPayment(true);
                } else {
                  setIAmount('');
                }
              }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 12,
                border: '1.5px solid #0891B2', background: 'var(--input-bg)', color: 'var(--text)',
                outline: 'none', fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              <option value="">
                {hasLentPersons ? '-- Select Person Who Repaid You --' : '-- No Active Debtors (Type Custom Name) --'}
              </option>
              {lentPersons.map(p => (
                <option key={p} value={p}>
                  {p} (Owes You: {formatAmount(stats.personDebts[p].netLent)})
                </option>
              ))}
              <option value="__custom__">Type a custom name…</option>
            </select>

            {iName && iName !== '__custom__' && (
              <div style={{
                marginTop: 4, padding: '5px 8px', borderRadius: 6,
                background: '#ECFEFF', border: '1px solid #A5F3FC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0891B2' }}>
                  Owes You: {formatAmount(stats.personDebts?.[iName]?.netLent ?? 0)}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#0891B2', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isIFullPayment}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsIFullPayment(checked);
                      if (checked) {
                        const fullAmt = stats.personDebts?.[iName]?.netLent ?? 0;
                        setIAmount(fullAmt.toString());
                      }
                    }}
                  />
                  Full Repayment
                </label>
              </div>
            )}
          </div>
        ) : null}

        {/* Name Input */}
        {(incMode !== 'repaymentRec' || isICustomName) && (
          <div style={{ position: 'relative', marginBottom: 7 }}>
            <PenLine size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="desktop-income-name" ref={iNameRef} type="text"
              placeholder={incMode === 'income' ? 'Source (Salary, Freelance...)' : 'Person Name'}
              value={iName}
              onChange={e => setIName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), iAmountRef.current?.focus())}
              autoComplete="off" style={{ ...inputStyle, paddingRight: incMode === 'repaymentRec' ? 70 : 12 }}
              {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
            />
            {incMode === 'repaymentRec' && (
              <button
                type="button"
                onClick={() => { setIsICustomName(false); setIName(''); setIAmount(''); }}
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
        <div style={{ position: 'relative', marginBottom: 7 }}>
          <IndianRupee size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            id="desktop-income-amount" ref={iAmountRef} type="text" placeholder="0.00" value={iAmount}
            onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setIAmount(v); }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveIncome())}
            inputMode="decimal" autoComplete="off" style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }}
            {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
          />
        </div>
        {/* Income Date */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Calendar size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="date"
            value={iDateInput}
            max={todayInputValue()}
            onChange={e => setIDateInput(e.target.value)}
            style={inputStyle}
            {...focusHandlers(incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')}
          />
        </div>
        <button
          id="desktop-btn-income" onClick={saveIncome}
          disabled={!iName.trim() || !iAmount || parseFloat(iAmount) <= 0}
          style={{
            width: '100%', padding: '9px', borderRadius: 10,
            fontSize: 12, fontWeight: 700,
            background: iName.trim() && iAmount && parseFloat(iAmount) > 0
              ? (incMode === 'income' ? 'var(--income)' : incMode === 'borrowed' ? 'var(--person)' : '#0891B2')
              : 'var(--surface2)',
            color: iName.trim() && iAmount && parseFloat(iAmount) > 0 ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {incMode === 'income' ? 'Add Income ↵' : incMode === 'borrowed' ? 'Add Borrowed Money ↵' : 'Add Repayment Rec. ↵'}
        </button>
      </div>

      {/* Combined List (Income + Borrowed + Repayment Rec) */}
      {(() => {
        const borrowedTxns = filtTxns.filter(t => t.type === 'person' && t.direction === 'borrowed');
        const combinedList = [
          ...filtInc.map(i => ({ ...i, isBorrowed: !!i.isBorrowed, isRepaymentRec: !!i.isRepaymentRec })),
          ...borrowedTxns.map(t => ({ ...t, isBorrowed: true })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
          <div style={{ maxHeight: 210, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
            {combinedList.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No entries this period</p>
              </div>
            ) : combinedList.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 5, fontWeight: 700,
                    background: entry.isRepaymentRec ? '#ECFEFF' : entry.isBorrowed ? 'var(--person-bg)' : 'var(--income-bg)',
                    color: entry.isRepaymentRec ? '#0891B2' : entry.isBorrowed ? 'var(--person)' : 'var(--income)',
                    flexShrink: 0,
                  }}>
                    {entry.isCarryForward ? '↪ Carry fwd' : entry.isRepaymentRec ? '⮐ Repay Rec.' : entry.isBorrowed ? 'Borrowed' : 'Income'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {entry.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: entry.isRepaymentRec ? '#0891B2' : entry.isBorrowed ? 'var(--person)' : 'var(--income)' }}>
                    +{formatAmount(entry.amount)}
                  </span>

                  {entry.isCarryForward && (
                    <span title="Computed from the previous month's remaining balance" style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'var(--surface2)' }}>auto</span>
                  )}
                  {/* Pencil Edit button for all Income entries */}
                  {onUpdateIncome && !entry.isCarryForward && (
                    <button
                      onClick={() => setEditingInc(entry)}
                      style={{ width: 20, height: 20, borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--income)'; e.currentTarget.style.background = 'var(--income-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                  {(onDeleteIncome || onDeleteTransaction) && !entry.isCarryForward && (
                    <button
                      onClick={() => {
                        if (income.some(i => i.id === entry.id)) {
                          setDeletingIncId(entry.id);
                        } else if (transactions.some(t => t.id === entry.id)) {
                          if (setDeletingTxnId) setDeletingTxnId(entry.id);
                          else if (onDeleteTransaction) onDeleteTransaction(entry.id);
                        } else {
                          setDeletingIncId(entry.id);
                        }
                      }}
                      style={{ width: 20, height: 20, borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </DCard>
  );
}
