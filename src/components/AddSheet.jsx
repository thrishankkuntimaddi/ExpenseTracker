// ─── AddSheet ────────────────────────────────────────────────────
// The "+" in the phone's bottom bar: one sheet to log anything — an
// expense, income, money with a person, or savings — from any page.
import { useState } from 'react';
import { X, IndianRupee, PenLine, Calendar } from 'lucide-react';
import { ADD_KINDS } from '../app/pages';
import Portal from './Portal';
import { useEscape } from '../hooks/useEscape';
import QuickAddForm from '../features/transactions/QuickAddForm';
import { generateId } from '../utils/storage';
import { todayInputValue, dateInputToISO, isoToMonth } from '../utils/dateHelpers';
import { incomeKindFlags } from '../utils/finance';


export default function AddSheet({ initialKind = 'expense', onClose, onSaved, onAdd, onAddIncome, ...data }) {
  const [kind, setKind] = useState(initialKind);
  useEscape(onClose);
  const saved = (entry) => { onSaved?.(entry); onClose(); };

  return (
    <Portal>
      <div data-no-swipe className="sheet-backdrop"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'sheetFade .15s ease' }}>
        <div role="dialog" aria-label="Add an entry" className="add-sheet" style={{
          width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)',
          borderRadius: '26px 26px 0 0', padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
          animation: 'sheetRise .24s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-dark)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Add</span>
            <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div role="tablist" aria-label="What are you adding?" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {ADD_KINDS.map(({ key, label, Icon, color, bg }) => {
              const on = kind === key;
              return (
                <button key={key} id={`add-kind-${key}`} role="tab" aria-selected={on} onClick={() => setKind(key)} className="add-kind"
                  style={{ padding: '10px 4px 8px', border: `1.5px solid ${on ? color : 'var(--border)'}`, background: on ? bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <Icon size={18} style={{ color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: on ? color : 'var(--text-secondary)' }}>{label}</span>
                </button>
              );
            })}
          </div>

          {kind === 'income'
            ? <IncomeForm onAddIncome={onAddIncome} onSaved={saved} />
            : <QuickAddForm key={kind} {...data} type={kind} onAdd={onAdd} onSaved={saved} />}
        </div>
      </div>
      <style>{`
        @keyframes sheetFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetRise { from { transform: translateY(32px); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
    </Portal>
  );
}

const INCOME_KINDS = [
  { key: 'income', label: 'Income', action: 'Add income' },
  { key: 'borrowed', label: 'Borrowed', action: 'Add borrowed money' },
  { key: 'repayment', label: 'Repaid to me', action: 'Add repayment' },
];

function IncomeForm({ onAddIncome, onSaved }) {
  const [mode, setMode] = useState('income');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const a = parseFloat(amount);
  const canSave = !!name.trim() && a > 0;

  function save() {
    if (!canSave) return;
    const isoDate = dateInputToISO(dateInput);
    const entry = { id: generateId(), name: name.trim(), amount: a, type: 'income', ...incomeKindFlags(mode), date: isoDate, month: isoToMonth(isoDate) };
    onAddIncome(entry);
    onSaved(entry);
  }
  const field = { width: '100%', padding: '11px 14px 11px 38px', fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' };
  const icon = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };

  return (
    <div className="income-quick-form">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {INCOME_KINDS.map((k) => (
          <button key={k.key} id={`income-kind-${k.key}`} onClick={() => setMode(k.key)}
            style={{ flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 700, border: `1.5px solid ${mode === k.key ? 'var(--income)' : 'var(--border)'}`, background: mode === k.key ? 'var(--income-bg)' : 'transparent', color: mode === k.key ? 'var(--income)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {k.label}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <PenLine size={14} style={icon} />
        <input id="income-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off"
          placeholder={mode === 'income' ? 'Source (Salary, Freelance…)' : mode === 'borrowed' ? 'Borrowed from…' : 'Who paid you back?'} style={field} />
      </div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IndianRupee size={14} style={icon} />
        <input id="income-amount" value={amount} inputMode="decimal" autoComplete="off" placeholder="0.00"
          onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          style={{ ...field, fontSize: 22, fontWeight: 700 }} />
      </div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Calendar size={14} style={icon} />
        <input type="date" value={dateInput} max={todayInputValue()} onChange={(e) => setDateInput(e.target.value)} style={{ ...field, fontSize: 13 }} />
      </div>
      <button id="btn-save-income" onClick={save} disabled={!canSave}
        style={{ width: '100%', padding: 13, fontSize: 14, fontWeight: 700, border: 'none', fontFamily: 'inherit', background: canSave ? 'var(--income)' : 'var(--surface2)', color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}>
        {INCOME_KINDS.find((k) => k.key === mode).action}
      </button>
    </div>
  );
}
