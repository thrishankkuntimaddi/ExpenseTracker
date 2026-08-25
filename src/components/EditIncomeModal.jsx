// ─── EditIncomeModal ──────────────────────────────────────────────
// Edit modal for income entries.

import { useState } from 'react';
import { X, PenLine, IndianRupee, Calendar, Check, Trash2 } from 'lucide-react';
import { isoToDateInput, dateInputToISO, isoToMonth } from '../utils/dateHelpers';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export default function EditIncomeModal({ entry, onSave, onDelete, onClose }) {
  const [name, setName]           = useState(entry.name ?? '');
  const [amount, setAmount]       = useState(String(entry.amount ?? ''));
  const [dateInput, setDateInput] = useState(isoToDateInput(entry.date));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const amtNum  = parseFloat(amount);
  const canSave = name.trim() && !isNaN(amtNum) && amtNum > 0 && dateInput;

  function handleSave() {
    if (!canSave) return;
    const isoDate = dateInputToISO(dateInput);
    onSave({ ...entry, name: name.trim(), amount: amtNum, date: isoDate, month: isoToMonth(isoDate) });
    onClose();
  }

  return (
    <>
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title="Delete income entry?"
          message="This action cannot be undone."
          onConfirm={() => { onDelete(entry.id); onClose(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1.5px solid var(--income-border)',
          borderRadius: 22, padding: '24px 24px 20px', maxWidth: 420, width: '100%',
          boxShadow: 'var(--shadow-md)',
          animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Edit Income</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Update income entry</div>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <X size={15} />
            </button>
          </div>

          {/* Name */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <PenLine size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Source (Salary, Freelance…)" value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', paddingLeft: 34, paddingRight: 12,
                paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 14,
                border: '1.5px solid var(--input-border)', background: 'var(--input-bg)',
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--income)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>

          {/* Amount */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <IndianRupee size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" inputMode="decimal" placeholder="0.00" value={amount}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
              style={{
                width: '100%', paddingLeft: 34, paddingRight: 12,
                paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 20, fontWeight: 700,
                border: '1.5px solid var(--input-border)', background: 'var(--input-bg)',
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--income)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>

          {/* Date */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
              style={{
                width: '100%', paddingLeft: 34, paddingRight: 12,
                paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 13,
                border: '1.5px solid var(--input-border)', background: 'var(--input-bg)',
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--income)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              padding: '11px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: 'var(--expense-bg)', color: 'var(--expense)',
              border: '1px solid var(--expense-border)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
            }}>
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: canSave ? 'var(--income)' : 'var(--surface2)',
              color: canSave ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s',
            }}>
              <Check size={14} />Save Changes
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
  );
}
