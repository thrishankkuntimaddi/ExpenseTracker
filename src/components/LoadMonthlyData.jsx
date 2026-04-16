// ─── Load Monthly Data — Manual Historical Import ─────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Calendar, FileText, ChevronDown } from 'lucide-react';
import { generateId } from '../utils/storage';
import { getCurrentMonthValue, formatMonthLabel } from '../utils/periodHelpers';

/* ── Generate list of importable months (Feb 2025 → last month) ── */
function getImportableMonths() {
  const months = [];
  const now = new Date();
  // Start from Feb 2025
  let year = 2025, month = 2; // 1-indexed

  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  while (true) {
    // Stop before current month
    if (year > currentYear) break;
    if (year === currentYear && month >= currentMonth) break;

    const mm = String(month).padStart(2, '0');
    months.push(`${year}-${mm}`);

    month++;
    if (month > 12) { month = 1; year++; }
  }

  return months.reverse(); // Most recent first
}

/* ── Parse text block: "Name Amount" per line ── */
function parseEntries(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Split on ANY run of whitespace so tabs / multiple spaces work
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) return null;
      // Last token = amount, everything before = name
      const amountStr = tokens[tokens.length - 1];
      const name      = tokens.slice(0, tokens.length - 1).join(' ').trim();
      const amount    = Math.round(parseFloat(amountStr) * 100) / 100; // keep 2dp, avoid float drift
      if (!name || isNaN(amount) || amount === 0) return null;
      return { name, amount };
    })
    .filter(Boolean);
}

/* ── Distribute entries across days of a month ── */
function distributeByDay(entries, yearNum, monthNum) {
  if (!entries.length) return [];
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate(); // monthNum is 1-indexed → works for Date()
  const N = entries.length;
  const entriesPerDay = Math.ceil(N / daysInMonth);

  const result = [];
  let entryIdx = 0;

  for (let day = 1; day <= daysInMonth && entryIdx < N; day++) {
    const chunk = entries.slice(entryIdx, entryIdx + entriesPerDay);
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
    chunk.forEach(entry => {
      result.push({ ...entry, date: dateStr });
    });
    entryIdx += entriesPerDay;
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LoadMonthlyData({ onAddTransaction, onAddIncome, onClose }) {
  const months = getImportableMonths();
  const currentMonth = getCurrentMonthValue();

  const [selectedMonth,  setSelectedMonth]  = useState(months[0] || '');
  const [incomeText,     setIncomeText]     = useState('');
  const [expenseText,    setExpenseText]    = useState('');
  const [status,         setStatus]         = useState('idle'); // idle | importing | success | error
  const [errorMsg,       setErrorMsg]       = useState('');
  const [preview,        setPreview]        = useState(null);
  const overlayRef = useRef(null);

  /* ── Compute live preview ── */
  useEffect(() => {
    const incEntries = parseEntries(incomeText);
    const expEntries = parseEntries(expenseText);
    setPreview({
      income:  incEntries.length,
      expense: expEntries.length,
      total:   incEntries.length + expEntries.length,
      incTotal: incEntries.reduce((s, e) => s + e.amount, 0),
      expTotal: expEntries.reduce((s, e) => s + e.amount, 0),
    });
  }, [incomeText, expenseText]);

  /* ── Escape key closes ── */
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleImport = useCallback(async () => {
    setErrorMsg('');

    // Validate: must not be current month
    if (selectedMonth === currentMonth) {
      setErrorMsg('Cannot import data for the current month.');
      return;
    }

    const incEntries = parseEntries(incomeText);
    const expEntries = parseEntries(expenseText);

    if (incEntries.length === 0 && expEntries.length === 0) {
      setErrorMsg('Please enter at least one income or expense entry.');
      return;
    }

    const [yearStr, monthStr] = selectedMonth.split('-');
    const yearNum  = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const distributedIncome  = distributeByDay(incEntries,  yearNum, monthNum);
    const distributedExpense = distributeByDay(expEntries,  yearNum, monthNum);

    setStatus('importing');

    try {
      // Save income entries
      for (const entry of distributedIncome) {
        await onAddIncome({
          id:     generateId(),
          name:   entry.name,
          amount: entry.amount,
          type:   'income',
          date:   entry.date,
          month:  selectedMonth,
        });
      }

      // Save expense entries
      for (const entry of distributedExpense) {
        await onAddTransaction({
          id:     generateId(),
          name:   entry.name,
          amount: entry.amount,
          type:   'expense',
          date:   entry.date,
          month:  selectedMonth,
        });
      }

      setStatus('success');
    } catch (err) {
      console.error('[LoadMonthlyData] Import failed:', err);
      setErrorMsg('Import failed. Please try again.');
      setStatus('error');
    }
  }, [selectedMonth, incomeText, expenseText, currentMonth, onAddIncome, onAddTransaction]);

  const f = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  /* ── Styles ── */
  const textAreaStyle = {
    width: '100%',
    minHeight: 120,
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    border: '1.5px solid var(--input-border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.7,
    transition: 'border-color 0.15s',
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'lmd-fade-in 0.18s ease',
        }}
      >
        {/* ── Modal ── */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          width: '100%',
          maxWidth: 500,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'lmd-slide-up 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Header */}
          <div style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--accent-border)',
              }}>
                <Upload size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  Load Past Data
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  Import historical income &amp; expenses
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--expense-bg)'; e.currentTarget.style.color = 'var(--expense)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

            {/* Success state */}
            {status === 'success' ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '32px 16px', gap: 14, textAlign: 'center',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: 'var(--income-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--income-border)',
                }}>
                  <CheckCircle2 size={32} style={{ color: 'var(--income)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    Data Imported Successfully!
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                    {formatMonthLabel(selectedMonth)} data has been saved to Firestore.
                  </p>
                </div>
                <div style={{
                  display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
                }}>
                  {preview?.income > 0 && (
                    <span style={{ padding: '5px 12px', borderRadius: 20, background: 'var(--income-bg)', color: 'var(--income)', fontSize: 12, fontWeight: 700, border: '1px solid var(--income-border)' }}>
                      {preview.income} income entries
                    </span>
                  )}
                  {preview?.expense > 0 && (
                    <span style={{ padding: '5px 12px', borderRadius: 20, background: 'var(--expense-bg)', color: 'var(--expense)', fontSize: 12, fontWeight: 700, border: '1px solid var(--expense-border)' }}>
                      {preview.expense} expense entries
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setStatus('idle');
                      setIncomeText('');
                      setExpenseText('');
                      setSelectedMonth(months[0] || '');
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: 10,
                      fontSize: 13, fontWeight: 700,
                      background: 'var(--surface2)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Import Another
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '10px 18px', borderRadius: 10,
                      fontSize: 13, fontWeight: 700,
                      background: 'var(--accent)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Month Selector */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}>
                    <Calendar size={11} />
                    Select Month
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 14px',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        border: '1.5px solid var(--accent-border)',
                        background: 'var(--accent-bg)',
                        color: 'var(--accent)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        appearance: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {months.map(m => (
                        <option key={m} value={m}>{formatMonthLabel(m)}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      style={{
                        position: 'absolute', right: 12, top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--accent)', pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Format hint */}
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  marginBottom: 16,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                    <FileText size={10} style={{ display: 'inline', marginRight: 4 }} />
                    Format: <code style={{ background: 'var(--surface3)', padding: '1px 5px', borderRadius: 4 }}>Name Amount</code> — one per line
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                    Example: <span style={{ fontFamily: 'monospace' }}>Salary 25000</span> or <span style={{ fontFamily: 'monospace' }}>Tea 15</span>
                  </p>
                </div>

                {/* Income Input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--income)', display: 'inline-block' }} />
                      Income
                    </span>
                    {preview?.income > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--income)', background: 'var(--income-bg)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--income-border)', textTransform: 'none' }}>
                        {preview.income} entries · {f(preview.incTotal)}
                      </span>
                    )}
                  </label>
                  <textarea
                    placeholder={"Mom 1000\nSalary 25000\nFreelance 5000"}
                    value={incomeText}
                    onChange={e => setIncomeText(e.target.value)}
                    style={textAreaStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                  />
                </div>

                {/* Expense Input */}
                <div style={{ marginBottom: errorMsg ? 12 : 0 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--expense)', display: 'inline-block' }} />
                      Expenses
                    </span>
                    {preview?.expense > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--expense)', background: 'var(--expense-bg)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--expense-border)', textTransform: 'none' }}>
                        {preview.expense} entries · {f(preview.expTotal)}
                      </span>
                    )}
                  </label>
                  <textarea
                    placeholder={"Tea 10\nBus 20\nFood 100\nRent 8000"}
                    value={expenseText}
                    onChange={e => setExpenseText(e.target.value)}
                    style={textAreaStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--expense)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                  />
                </div>

                {/* Error message */}
                {errorMsg && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10, marginTop: 12,
                    background: 'var(--expense-bg)', border: '1.5px solid var(--expense-border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <AlertCircle size={14} style={{ color: 'var(--expense)', flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: 'var(--expense)', fontWeight: 600, margin: 0 }}>{errorMsg}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — only shown when not in success state */}
          {status !== 'success' && (
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex', gap: 10, flexShrink: 0,
              background: 'var(--surface)',
            }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  background: 'var(--surface2)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={status === 'importing' || (preview?.total === 0)}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10,
                  fontSize: 13, fontWeight: 800,
                  background: (status === 'importing' || preview?.total === 0)
                    ? 'var(--surface2)' : 'var(--accent)',
                  color: (status === 'importing' || preview?.total === 0)
                    ? 'var(--text-muted)' : '#fff',
                  border: 'none', cursor: (status === 'importing' || preview?.total === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (status !== 'importing' && preview?.total > 0) {
                    e.currentTarget.style.background = 'var(--accent-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (status !== 'importing' && preview?.total > 0) {
                    e.currentTarget.style.background = 'var(--accent)';
                  }
                }}
              >
                {status === 'importing' ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Import {preview?.total > 0 ? `${preview.total} Entries` : 'Data'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes lmd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lmd-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  );
}
