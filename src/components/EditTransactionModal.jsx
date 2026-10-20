// ─── EditTransactionModal ──────────────────────────────────────────
// Universal edit modal for expense / person / savings transactions.

import { useState } from 'react';
import { X, PenLine, Calendar, Check, Trash2, Flame } from 'lucide-react';
import CurrencySelect from './CurrencySelect';
import { rawOf } from '../utils/fx';
import { currencyOf } from '../utils/money';
import { TRANSACTION_TYPES, TYPE_META, PERSON_DIRECTIONS, savingsChoicesFor, getSavingsType } from '../utils/typeConfig';
import { isoToDateInput, dateInputToISO, isoToMonth, todayInputValue } from '../utils/dateHelpers';
import { inferCategory } from '../utils/categories';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import CategoryPicker from './CategoryPicker';
import Portal from './Portal';
import { useEscape } from '../hooks/useEscape';

export default function EditTransactionModal({ txn, onSave, onDelete, onClose, categoryRules = {}, onLearnCategory }) {
  useEscape(onClose);
  const [name, setName]           = useState(txn.name ?? '');
  const [category, setCategory]   = useState(txn.category ?? null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  // Edited in the currency it was entered in (not the converted figure)
  const raw = rawOf(txn);
  const [amount, setAmount]       = useState(String(raw.amount ?? ''));
  const [currency, setCurrency]   = useState(currencyOf(raw));
  const [dateInput, setDateInput] = useState(isoToDateInput(txn.date));
  const [type, setType]           = useState(txn.type ?? 'expense');
  const [direction, setDirection] = useState(txn.direction ?? 'lent');
  const [savingsType, setSavingsType] = useState(txn.savingsType ?? 'cash');
  const [platform, setPlatform]   = useState(txn.platform ?? '');
  const [waste, setWaste]         = useState(raw.wasteAmount > 0 ? String(raw.wasteAmount) : '');   // how much of it was wasted
  const [paidCash, setPaidCash]   = useState(txn.paidWith === 'cash');
  const isWithdrawal = txn.type === 'cash';     // cash taken out of the account: only name, amount, date
  const canPayCash = type === 'expense' || (type === 'person' && direction === 'given_gift');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const sel     = TRANSACTION_TYPES.find(t => t.key === type) ?? TRANSACTION_TYPES[0];
  const suggestedCategory = type === 'expense' ? inferCategory(name, categoryRules) : null;
  const effectiveCategory = type === 'expense' ? (category ?? suggestedCategory) : null;
  const amtNum  = parseFloat(amount);
  const canSave = name.trim() && !isNaN(amtNum) && amtNum > 0 && dateInput;

  function handleSave() {
    if (!canSave) return;
    const isoDate = dateInputToISO(dateInput);
    const { fx, ...base } = raw;
    const updated = {
      ...base,
      ...(currency === currencyOf(raw) && fx ? { fx } : {}),   // a new currency drops the old rate snapshot
      name:    name.trim(),
      amount:  amtNum,
      currency,
      type,
      date:    isoDate,
      month:   isoToMonth(isoDate),
    };
    if (type === 'person')   updated.direction = direction;
    if (canPayCash && paidCash) updated.paidWith = 'cash'; else delete updated.paidWith;
    if (type === 'expense') {
      updated.category = effectiveCategory;
      if (categoryTouched) onLearnCategory?.(updated.name, effectiveCategory);
      const w = parseFloat(waste);
      if (w > 0) updated.wasteAmount = Math.min(w, amtNum); else delete updated.wasteAmount;
    } else {
      delete updated.category;
      delete updated.wasteAmount;
    }
    if (type === 'savings') {
      updated.savingsType = savingsType;
      const st = getSavingsType(savingsType);
      if (st.hasPlatform && platform.trim()) updated.platform = platform.trim();
    }
    onSave(updated);
    onClose();
  }

  return (
    <Portal>
      <>
        {showDeleteConfirm && (
          <ConfirmDeleteModal
            title="Delete transaction?"
            message="It moves to Recently Deleted (Settings), where you can restore it."
            onConfirm={() => { onDelete(txn.id); onClose(); }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        <div style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 22, padding: '24px 24px 20px', maxWidth: 440, width: '100%',
            boxShadow: 'var(--shadow-md)',
            animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{isWithdrawal ? 'Edit cash withdrawal' : 'Edit Transaction'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Changes persist immediately</div>
              </div>
              <button onClick={onClose} style={{
                width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                <X size={15} />
              </button>
            </div>

            {/* Type picker */}
            {!isWithdrawal && <div style={{
              display: 'flex', background: 'var(--surface2)', borderRadius: 12,
              padding: 3, marginBottom: 14, border: '1px solid var(--border)',
            }}>
              {TRANSACTION_TYPES.map(t => (
                <button key={t.key} onClick={() => setType(t.key)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '8px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: type === t.key ? t.color : 'transparent',
                  color: type === t.key ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                  <t.Icon size={12} />{t.label}
                </button>
              ))}
            </div>}

            {/* Person direction */}
            {type === 'person' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {PERSON_DIRECTIONS.map(d => (
                  <button key={d.key} onClick={() => setDirection(d.key)} style={{
                    flex: 1, padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
                    background: direction === d.key ? d.color + '22' : 'transparent',
                    color: direction === d.key ? d.color : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <d.Icon size={13} />{d.label}
                  </button>
                ))}
              </div>
            )}

            {/* Savings type */}
            {type === 'savings' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Savings Type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {savingsChoicesFor(txn.savingsType).map(st => (
                    <button key={st.key} onClick={() => setSavingsType(st.key)} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                      background: savingsType === st.key ? st.color + '22' : 'transparent',
                      color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                      {st.label}
                    </button>
                  ))}
                </div>
                {getSavingsType(savingsType).hasPlatform && (
                  <input
                    type="text" placeholder="Platform (e.g. Angel One, Zerodha)"
                    value={platform} onChange={e => setPlatform(e.target.value)}
                    style={{
                      width: '100%', marginTop: 8, padding: '9px 12px',
                      borderRadius: 9, fontSize: 13,
                      border: '1.5px solid var(--border)',
                      background: 'var(--input-bg)', color: 'var(--text)',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                )}
              </div>
            )}

            {/* Name */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <PenLine size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text" placeholder="Description" value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 34, paddingRight: 12,
                  paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 14,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = sel.color}
                onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
              />
            </div>

            {type === 'expense' && (
              <div style={{ marginBottom: 12 }}>
                <CategoryPicker size="sm" value={effectiveCategory} suggested={suggestedCategory}
                  onChange={(c) => { setCategory(c); setCategoryTouched(true); }} />
              </div>
            )}

            {/* Amount */}
            <div style={{ position: 'relative', marginBottom: 10, display: 'flex', gap: 6 }}>
              <CurrencySelect compact value={currency} onChange={setCurrency} />
              <input
                type="text" inputMode="decimal" placeholder="0.00" value={amount}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
                style={{
                  width: '100%', paddingLeft: 12, paddingRight: 12,
                  paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 20, fontWeight: 700,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = sel.color}
                onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
              />
            </div>

            {/* Wasted — part or all of an expense you regret */}
            {type === 'expense' && (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Flame size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--expense)', pointerEvents: 'none' }} />
                <input
                  id="edit-waste" type="text" inputMode="decimal" placeholder="Wasted? How much (optional)" value={waste} aria-label="Wasted amount"
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setWaste(v); }}
                  style={{
                    width: '100%', paddingLeft: 34, paddingRight: 12,
                    paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 13,
                    border: '1.5px solid var(--input-border)',
                    background: 'var(--input-bg)', color: 'var(--text)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}

            {/* Paid with — cash spent in shops comes out of "cash in hand" */}
            {canPayCash && (
              <div role="radiogroup" aria-label="Paid with" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Paid with</span>
                {[[false, 'UPI / card'], [true, 'Cash']].map(([cash, label]) => (
                  <button key={label} type="button" role="radio" aria-checked={paidCash === cash} id={`edit-paid-${cash ? 'cash' : 'account'}`} onClick={() => setPaidCash(cash)}
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${paidCash === cash ? 'var(--accent)' : 'var(--border)'}`, background: paidCash === cash ? 'var(--accent-bg)' : 'transparent', color: paidCash === cash ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Date */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                max={todayInputValue()}
                style={{
                  width: '100%', paddingLeft: 34, paddingRight: 12,
                  paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 13,
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = sel.color}
                onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '11px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
                  background: 'var(--expense-bg)', color: 'var(--expense)',
                  border: '1px solid var(--expense-border)', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
                  background: 'var(--surface2)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{
                  flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
                  background: canSave ? sel.color : 'var(--surface2)',
                  color: canSave ? '#fff' : 'var(--text-muted)',
                  border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <Check size={14} />
                Save Changes
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes modalPop {
              from { opacity: 0; transform: scale(0.93) translateY(8px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      </>
    </Portal>
  );
}
