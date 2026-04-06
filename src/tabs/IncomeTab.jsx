import { useRef, useState } from 'react';
import { PenLine, IndianRupee, Wallet } from 'lucide-react';
import { generateId } from '../utils/storage';
import { formatAmount, groupByDay } from '../utils/dateHelpers';

export default function IncomeTab({ income, onAddIncome }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const nameRef = useRef(null);
  const amountRef = useRef(null);

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const grouped = groupByDay(income);

  function handleNameKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); }
  }
  function handleAmountKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
  }
  function handleAmountInput(e) {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val);
  }
  function save() {
    const trimName = name.trim();
    const parsedAmount = parseFloat(amount);
    if (!trimName || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    onAddIncome({ id: generateId(), name: trimName, amount: parsedAmount, type: 'income', date: new Date().toISOString() });
    setName('');
    setAmount('');
    nameRef.current?.focus();
  }

  const ACC = 'var(--income)';
  const ACC_BG = 'var(--income-bg)';
  const ACC_BORDER = 'var(--income-border)';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Income</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Track all your income sources</p>
      </div>

      {/* Total Income Hero Card */}
      <div className="mx-5 mb-4 rounded-2xl p-5" style={{ background: ACC, boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>Total Income</p>
            <p className="text-3xl font-bold text-white">{formatAmount(totalIncome)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Wallet size={24} color="#fff" />
          </div>
        </div>
      </div>

      {/* Entry Form Card */}
      <div className="mx-5 mb-4 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        {/* Name */}
        <div className="relative mb-3">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <PenLine size={15} />
          </div>
          <input
            id="income-input-name"
            ref={nameRef}
            type="text"
            placeholder="Source (e.g. Salary, Freelance…)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleNameKey}
            autoComplete="off"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
            style={{ background: '#fff', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            onFocus={e => (e.target.style.borderColor = ACC)}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        {/* Amount */}
        <div className="relative mb-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <IndianRupee size={15} />
          </div>
          <input
            id="income-input-amount"
            ref={amountRef}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountInput}
            onKeyDown={handleAmountKey}
            inputMode="decimal"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all duration-150"
            style={{ background: '#fff', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            onFocus={e => (e.target.style.borderColor = ACC)}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <button
          id="btn-save-income"
          onClick={save}
          disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
          className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: ACC, color: '#fff', minHeight: 48 }}
        >
          Add Income
        </button>
      </div>

      {/* Income List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {income.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: ACC_BG }}>
              <Wallet size={22} style={{ color: ACC }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No income added yet.</p>
          </div>
        ) : grouped.map(group => (
          <div key={group.label} className="mb-5">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{group.label}</span>
              <span className="text-sm font-bold" style={{ color: ACC }}>
                {formatAmount(group.entries.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              {group.entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{entry.name}</span>
                  <span className="text-sm font-bold" style={{ color: ACC }}>{formatAmount(entry.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
