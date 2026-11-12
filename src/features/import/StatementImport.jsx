// ─── Import a bank statement ─────────────────────────────────────
// Pick a CSV / Excel / PDF statement → (password, if the bank set one) →
// check the list (names cleaned, categories guessed, entries you already
// have unticked) → add them. Read on this device; nothing is uploaded.
// Importing the same statement again updates the same entries.
import { useMemo, useRef, useState } from 'react';
import { FileUp, Lock, Loader2, Check, AlertCircle } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { useShell } from '../../app/shellContext';
import { readStatementFile, PasswordNeeded } from '../../utils/statementFiles';
import { linesToItems, itemsToRecords, summarise } from '../../utils/statementParse';
import { CATEGORIES, EMPTY_RULES } from '../../utils/categories';
import { formatMoneyCompact } from '../../utils/money';
import { bulkImport } from '../../services/firestore';
import { t as tr } from '../../i18n';

const money = (n) => formatMoneyCompact(n);
const KIND = { expense: { label: 'Expense', tone: 'expense' }, income: { label: 'Money in', tone: 'income' }, cash: { label: 'Cash', tone: 'lent' } };

// `preset` (bank linking): { lines, title, subtitle, onSaved } — skip the file, review these lines
export default function StatementImport({ transactions = [], income = [], settings, onAddTransaction, onAddIncome, onClose, preset }) {
  const shell = useShell();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const [step, setStep] = useState(preset ? 'review' : 'pick');   // pick | password | reading | review | saving | done
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState(() => (preset ? linesToItems(preset.lines, { transactions, income, rules, source: 'bank' }) : []));
  const [showDupes, setShowDupes] = useState(false);
  const [saved, setSaved] = useState(null);

  async function read(f, pw) {
    setStep('reading'); setError('');
    try {
      const { lines } = await readStatementFile(f, pw);
      if (!lines.length) { setError(tr('Couldn’t find transactions in this file. Try the CSV or Excel download from your bank’s website.')); setStep('pick'); return; }
      setItems(linesToItems(lines, { transactions, income, rules }));
      setStep('review');
    } catch (e) {
      if (e instanceof PasswordNeeded) { setStep('password'); setError(e.wrong ? tr('That password didn’t open it.') : ''); return; }
      setError(e?.message ?? tr('Couldn’t read that file.')); setStep('pick');
    }
  }
  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setPassword(''); read(f); } };

  const visible = useMemo(() => items.filter((i) => showDupes || !i.duplicate), [items, showDupes]);
  const sum = summarise(items);
  const update = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const allOn = visible.length > 0 && visible.every((i) => i.include);

  async function save() {
    setStep('saving');
    const records = itemsToRecords(items);
    try {
      if (shell?.user?.uid && !shell.user.isDemo) await bulkImport(shell.user.uid, records);
      else { for (const t of records.transactions) await onAddTransaction?.(t); for (const i of records.income) await onAddIncome?.(i); }
      setSaved(records.transactions.length + records.income.length);
      await preset?.onSaved?.();
      setStep('done');
    } catch {
      setError(tr('Couldn’t save — check your connection and try again.')); setStep('review');
    }
  }

  const footer = step === 'review' ? (
    <>
      <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
      <PrimaryButton onClick={save} disabled={!sum.count}><Check size={14} /> {`${tr('Add')} ${sum.count}`}</PrimaryButton>
    </>
  ) : step === 'done' ? <PrimaryButton onClick={onClose}>{tr('Done')}</PrimaryButton> : null;

  return (
    <ModalShell title={preset?.title ?? tr('Import a bank statement')} subtitle={preset?.subtitle ?? tr('CSV, Excel or PDF — read on this device, never uploaded')} onClose={onClose} maxWidth={640} footer={footer}>
      <input ref={input} type="file" accept=".csv,.txt,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={pick} />
      {error && <div role="alert" style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--expense-bg)', color: 'var(--expense)', fontSize: 12.5, fontWeight: 600 }}><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>}

      {step === 'pick' && (
        <div style={{ textAlign: 'center', padding: '18px 8px' }}>
          <button id="stmt-pick" onClick={() => input.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            <FileUp size={16} /> {tr('Choose a statement')}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '14px auto 0', maxWidth: 420 }}>
            {tr('Download it from your bank’s app or net banking (Statements → Download). PDFs from the bank’s email work too — enter the password it came with.')}
          </p>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={(e) => { e.preventDefault(); if (password) read(file, password); }} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}><Lock size={15} /> {tr('This statement is password-protected.')}</div>
          <input id="stmt-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr('Statement password')} style={fieldStyle} />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{tr('Banks usually use part of your name and date of birth — the email it came with says how.')}</div>
          <PrimaryButton onClick={() => password && read(file, password)} disabled={!password}>{tr('Open')}</PrimaryButton>
        </form>
      )}

      {(step === 'reading' || step === 'saving') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 28, color: 'var(--text-secondary)', fontSize: 13 }}>
          <Loader2 size={18} className="spin" /> {step === 'reading' ? tr('Reading the statement…') : tr('Adding entries…')}
        </div>
      )}

      {step === 'review' && (
        <>
          <div id="stmt-summary" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span><strong style={{ color: 'var(--expense)' }}>{money(sum.out)}</strong> {tr('spent')}</span>
            {sum.cash > 0 && <span><strong style={{ color: 'var(--lent)' }}>{money(sum.cash)}</strong> {tr('cash taken out')}</span>}
            <span><strong style={{ color: 'var(--income)' }}>{money(sum.in)}</strong> {tr('came in')}</span>
            {sum.duplicates > 0 && (
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={showDupes} onChange={(e) => setShowDupes(e.target.checked)} />
                {sum.duplicates} {tr('already in the app — show them')}
              </label>
            )}
          </div>
          <div id="stmt-list" style={{ border: '1px solid var(--border)', maxHeight: '52vh', overflow: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
              <input type="checkbox" checked={allOn} onChange={(e) => { const on = e.target.checked; setItems((l) => l.map((i) => (showDupes || !i.duplicate ? { ...i, include: on } : i))); }} />
              {visible.length} {tr('entries')}
            </label>
            {visible.map((i) => (
              <div key={i.id} className="stmt-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderTop: '1px solid var(--border)', opacity: i.include ? 1 : 0.5 }}>
                <input type="checkbox" checked={i.include} onChange={(e) => update(i.id, { include: e.target.checked })} aria-label={`Include ${i.name}`} />
                <div style={{ minWidth: 0 }}>
                  <input value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} aria-label="Name"
                    style={{ width: '100%', border: 'none', background: 'transparent', boxShadow: 'none', padding: 0, fontSize: 13, fontWeight: 650, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{new Date(i.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <select value={i.kind} onChange={(e) => update(i.id, { kind: e.target.value })} aria-label="Kind"
                      style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--border)', background: `var(--${KIND[i.kind].tone}-bg)`, color: `var(--${KIND[i.kind].tone})`, fontFamily: 'inherit' }}>
                      {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{tr(v.label)}</option>)}
                    </select>
                    {i.kind === 'expense' && (
                      <select value={i.category ?? 'other'} onChange={(e) => update(i.id, { category: e.target.value })} aria-label="Category"
                        style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                        {CATEGORIES.filter((c) => c.key !== 'responsibility').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    )}
                    {i.duplicate && <span style={{ color: 'var(--lent)', fontWeight: 700 }}>{tr('already added')}</span>}
                  </div>
                </div>
                <strong style={{ fontSize: 13, color: i.kind === 'income' ? 'var(--income)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{i.kind === 'income' ? '+' : ''}{money(i.amount)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '22px 8px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{saved} {tr('entries added')}</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>{tr('Importing the same statement again updates these instead of adding them twice.')}</p>
        </div>
      )}
    </ModalShell>
  );
}
