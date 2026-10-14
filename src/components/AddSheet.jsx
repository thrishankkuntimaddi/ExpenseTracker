// ─── AddSheet ────────────────────────────────────────────────────
// "+" on the phone bar: one sheet to log anything. On wide screens the
// same panel (AddPanel) sits inline on Home instead of in a window.
// Every kind starts the same way — what it's for (or who), with the
// keyboard already up — then the amount, then the details:
//   Expense  spent on something, or given to someone (no return expected)
//   Income   salary, family, anything that came in
//   Debt     lent · borrowed · got back · paid back (see utils/debts.js)
//   Savings  where it went, and optionally which goal it's for
// When you're looking at an earlier month, the date starts on that month.
import { createContext, useContext, useMemo, useState } from 'react';
import { X, IndianRupee, PenLine, Calendar, User, StickyNote, Flag } from 'lucide-react';
import { ADD_KINDS } from '../app/pages';
import Portal from './Portal';
import { useEscape } from '../hooks/useEscape';
import CategoryPicker from './CategoryPicker';
import { useShell } from '../app/shellContext';
import { generateId } from '../utils/storage';
import { formatAmount, todayInputValue, dateInputToISO, isoToMonth } from '../utils/dateHelpers';
import { incomeKindFlags } from '../utils/finance';
import { inferCategory, EMPTY_RULES } from '../utils/categories';
import { parseQuickEntry } from '../utils/smartInput';
import { SAVINGS_TYPES, getSavingsType } from '../utils/typeConfig';
import { DEBT_MOVES, DEBT_MOVE_KEYS, debtEntryFields, debtLedger } from '../utils/debts';
import { isGoalOpen } from '../utils/goals';

/** Today, or the last day of the month being viewed if that's earlier. */
function defaultDate(month) {
  const today = todayInputValue();
  if (!month || month >= today.slice(0, 7)) return today;
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

export default function AddSheet({ initialKind = 'expense', options = {}, onClose, onSaved, ...rest }) {
  const shell = useShell();
  useEscape(onClose);
  const saved = (entry) => { onSaved?.(entry); onClose(); };

  return (
    <Portal>
      <div data-no-swipe className={`sheet-backdrop${shell?.desktop ? ' sheet-centered' : ''}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'sheetFade .15s ease' }}>
        <div role="dialog" aria-label="Add an entry" className="add-sheet" style={{
          width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)',
          borderRadius: '26px 26px 0 0', padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
          animation: 'sheetRise .24s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div className="sheet-grip" style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-dark)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Add</span>
            <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>
          <AddPanel initialKind={initialKind} options={options} onSaved={saved} {...rest} />
        </div>
      </div>
      <style>{`
        @keyframes sheetFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetRise { from { transform: translateY(32px); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
    </Portal>
  );
}

// The first field takes focus when a form opens — except inline on Home,
// where it waits until you pick a kind or save one (no focus stolen on load).
const AutoFocus = createContext(true);

/** The kind tabs + the form. `inline`: lives on a page — stays open and clears after each save. */
export function AddPanel({ initialKind = 'expense', options = {}, onSaved, onAdd, onAddIncome, inline = false, compact = false, ...data }) {
  const shell = useShell();
  const [kind, setKindState] = useState(initialKind === 'person' ? 'debt' : initialKind);
  const [round, setRound] = useState(0);              // inline: a fresh form after each save
  const [engaged, setEngaged] = useState(!inline);
  const setKind = (k) => { setEngaged(true); setKindState(k); };
  const saved = (entry) => { onSaved?.(entry); if (inline) { setEngaged(true); setRound((r) => r + 1); } };
  const common = { onSaved: saved, startDate: defaultDate(shell?.month) };
  const key = `${kind}-${round}`;

  return (
    <AutoFocus.Provider value={engaged}>
    <div className={`add-panel${compact ? ' add-compact' : ''}`}>
      <div role="tablist" aria-label="What are you adding?" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: compact ? 12 : 16 }}>
        {ADD_KINDS.map(({ key: k, label, Icon, color, bg }) => {
          const on = kind === k;
          return (
            <button key={k} id={`add-kind-${k}`} role="tab" aria-selected={on} onClick={() => setKind(k)} className="add-kind"
              style={{ padding: compact ? '8px 4px' : '10px 4px 8px', border: `1.5px solid ${on ? color : 'var(--border)'}`, background: on ? bg : 'var(--surface2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? 7 : 5 }}>
              <Icon size={compact ? 16 : 18} style={{ color: on ? color : 'var(--text-secondary)' }} />
              <span style={{ fontSize: compact ? 12.5 : 11, fontWeight: 700, color: on ? color : 'var(--text-secondary)' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {kind === 'expense' && <ExpenseForm key={key} {...common} {...data} onAdd={onAdd} />}
      {kind === 'income' && <IncomeForm key={key} {...common} income={data.income} onAddIncome={onAddIncome} />}
      {kind === 'debt' && <DebtForm key={key} {...common} {...data} onAdd={onAdd} onAddIncome={onAddIncome} initialMove={options.move} initialName={options.name} />}
      {kind === 'savings' && <SavingsForm key={key} {...common} {...data} onAdd={onAdd} initialGoal={options.goalId} />}
    </div>
    </AutoFocus.Provider>
  );
}

/* ── Shared pieces ───────────────────────────────────────────── */
const field = { width: '100%', padding: '12px 14px 12px 40px', fontSize: 15, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' };
const iconAt = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };

/** The big amount field — right after what it's for. Enter saves. */
function AmountField({ value, onChange, tone, onEnter, id = 'add-amount' }) {
  return (
    <div className="add-amount" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', marginBottom: 12, border: `1.5px solid var(--${tone}-border, var(--border))`, background: `var(--${tone}-bg)` }}>
      <IndianRupee size={22} style={{ color: `var(--${tone})`, flexShrink: 0 }} />
      <input id={id} value={value} inputMode="decimal" autoComplete="off" enterKeyHint="done" placeholder="0" aria-label="Amount"
        onChange={(e) => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) onChange(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', boxShadow: 'none', outline: 'none', fontSize: 32, fontWeight: 800, color: `var(--${tone})`, fontFamily: 'inherit', padding: '6px 0', letterSpacing: '-0.02em' }} />
    </div>
  );
}

/** `first`: the field a form opens on (takes focus, Enter moves on to the amount). */
function TextField({ id, Icon = PenLine, value, onChange, placeholder, list, onEnter, inputRef, first = false }) {
  const autoFocus = useContext(AutoFocus) && first;
  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <Icon size={15} style={iconAt} />
      <input id={id} ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} list={list} autoComplete="off" autoFocus={autoFocus} enterKeyHint={first ? 'next' : 'done'}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }} style={field} />
    </div>
  );
}

function DateField({ value, onChange }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <Calendar size={15} style={iconAt} />
      <input type="date" aria-label="Date" value={value} max={todayInputValue()} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ ...field, fontSize: 13 }} />
    </div>
  );
}

/** Pill choices; `tone` colours the selected one (readable in light and dark). */
function Choice({ options, value, onChange, tone = 'accent', idPrefix, columns }) {
  return (
    <div role="radiogroup" style={{ display: columns ? 'grid' : 'flex', gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : undefined, flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {options.map((o) => {
        const on = value === o.key;
        const t = o.tone ?? tone;
        return (
          <button key={o.key} type="button" id={idPrefix ? `${idPrefix}-${o.key}` : undefined} role="radio" aria-checked={on} onClick={() => onChange(o.key)} className="add-choice"
            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', border: `1.5px solid ${on ? `var(--${t})` : 'var(--border)'}`, background: on ? `var(--${t}-bg)` : 'var(--surface2)', color: on ? `var(--${t})` : 'var(--text-secondary)' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SaveButton({ id, disabled, tone, onClick, children }) {
  return (
    <button id={id} type="button" onClick={onClick} disabled={disabled}
      style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 750, border: 'none', fontFamily: 'inherit', background: disabled ? 'var(--surface2)' : `var(--${tone})`, color: disabled ? 'var(--text-muted)' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

const amountOk = (a) => Number(a) > 0;
const stamp = (dateInput) => { const iso = dateInputToISO(dateInput); return { date: iso, month: isoToMonth(iso) }; };

/* ── Expense: spent, or given to someone ─────────────────────── */
function ExpenseForm({ transactions = [], settings, theme, onAdd, onLearnCategory, onSaved, startDate }) {
  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const [mode, setMode] = useState('spent');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(null);
  const [dateInput, setDateInput] = useState(startDate);
  const givenTo = useMemo(() => [...new Set(transactions.filter((t) => t.type === 'person' && t.direction === 'given_gift').map((t) => t.name?.trim()).filter(Boolean))], [transactions]);

  // "chai 20" typed in the name also works
  const parsed = !amount ? parseQuickEntry(name) : null;
  const finalName = (parsed?.name ?? name).trim();
  const finalAmount = parsed?.amount ?? Number(amount);
  const suggested = mode === 'spent' ? inferCategory(finalName, rules) : null;
  const can = !!finalName && amountOk(finalAmount);

  function save() {
    if (!can) return;
    const base = { id: generateId(), name: finalName.charAt(0).toUpperCase() + finalName.slice(1), amount: finalAmount, ...stamp(dateInput) };
    const entry = mode === 'given'
      ? { ...base, type: 'person', direction: 'given_gift' }
      : { ...base, type: 'expense', category: category ?? suggested };
    if (mode === 'spent' && category) onLearnCategory?.(finalName, category);
    onAdd(entry);
    onSaved(entry);
  }

  return (
    <div className="add-form add-form-expense">
      <Choice idPrefix="expense-mode" value={mode} onChange={setMode} tone="expense" columns={2}
        options={[{ key: 'spent', label: 'Spent' }, { key: 'given', label: 'Given to someone', tone: 'given' }]} />
      <TextField id="add-name" first Icon={mode === 'given' ? User : PenLine} value={name} onChange={setName}
        onEnter={() => (parsed ? save() : document.getElementById('add-amount')?.focus())}
        placeholder={mode === 'given' ? 'Given to whom? (no return expected)' : 'What for? — e.g. Groceries, Petrol'} list={mode === 'given' ? 'add-given-to' : undefined} />
      <AmountField value={amount} onChange={setAmount} tone={mode === 'given' ? 'given' : 'expense'} onEnter={save} />
      <datalist id="add-given-to">{givenTo.map((n) => <option key={n} value={n} />)}</datalist>
      {mode === 'spent' && (
        <div style={{ marginBottom: 12 }}>
          <CategoryPicker size="sm" value={category ?? suggested} suggested={suggested} onChange={setCategory} theme={theme} />
        </div>
      )}
      {mode === 'given' && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 2px 12px', lineHeight: 1.5 }}>
          Counted as spending. It isn’t a debt, so it won’t appear in Debts — use <strong>Debt → Lent</strong> if you expect it back.
        </p>
      )}
      <div className="add-foot">
        <DateField value={dateInput} onChange={setDateInput} />
        <SaveButton id="btn-save-entry" disabled={!can} tone={mode === 'given' ? 'given' : 'expense'} onClick={save}>
          {can ? `Add ${mode === 'given' ? 'gift' : 'expense'} · ${formatAmount(finalAmount)}` : mode === 'given' ? 'Add what you gave' : 'Add expense'}
        </SaveButton>
      </div>
    </div>
  );
}

/* ── Income ──────────────────────────────────────────────────── */
const INCOME_SOURCES = ['Salary', 'Parents', 'Freelance', 'Interest', 'Refund', 'Gift'];

function IncomeForm({ income = [], onAddIncome, onSaved, startDate }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [dateInput, setDateInput] = useState(startDate);
  // Your usual sources first
  const sources = useMemo(() => {
    const seen = {};
    income.forEach((i) => { if (!i.isBorrowed && !i.isRepaymentRec && !i.isCarryForward && i.name) seen[i.name.trim()] = (seen[i.name.trim()] ?? 0) + 1; });
    const mine = Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 5);
    return [...mine, ...INCOME_SOURCES.filter((s) => !mine.some((m) => m.toLowerCase() === s.toLowerCase()))].slice(0, 7);
  }, [income]);
  const can = !!name.trim() && amountOk(amount);

  function save() {
    if (!can) return;
    const entry = { id: generateId(), name: name.trim(), amount: Number(amount), type: 'income', ...incomeKindFlags('income'), ...stamp(dateInput) };
    onAddIncome(entry);
    onSaved(entry);
  }

  return (
    <div className="add-form add-form-income">
      <TextField id="income-name" first value={name} onChange={setName} onEnter={() => document.getElementById('add-amount')?.focus()} placeholder="From — Salary, Parents, Freelance…" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '-2px 0 12px' }}>
        {sources.map((s) => (
          <button key={s} type="button" onClick={() => { setName(s); document.getElementById('add-amount')?.focus(); }} className="add-choice"
            style={{ padding: '6px 11px', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${name === s ? 'var(--income)' : 'var(--border)'}`, background: name === s ? 'var(--income-bg)' : 'var(--surface2)', color: name === s ? 'var(--income)' : 'var(--text-secondary)' }}>
            {s}
          </button>
        ))}
      </div>
      <AmountField value={amount} onChange={setAmount} tone="income" onEnter={save} />
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-2px 2px 12px', lineHeight: 1.5 }}>Borrowed money, or money paid back to you? Use <strong>Debt</strong> — it’s counted as money in and tracked per person.</p>
      <div className="add-foot">
        <DateField value={dateInput} onChange={setDateInput} />
        <SaveButton id="btn-save-income" disabled={!can} tone="income" onClick={save}>{can ? `Add income · ${formatAmount(Number(amount))}` : 'Add income'}</SaveButton>
      </div>
    </div>
  );
}

/* ── Debt: lent · borrowed · got back · paid back ────────────── */
function DebtForm({ transactions = [], income = [], onAdd, onAddIncome, onSaved, startDate, initialMove = 'lent', initialName = '' }) {
  const [move, setMove] = useState(DEBT_MOVES[initialMove] ? initialMove : 'lent');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(startDate);
  const ledger = useMemo(() => debtLedger(transactions, income), [transactions, income]);
  // Who this move is likely about: people who owe you (got back), people you owe (paid back)
  const open = move === 'got_back' ? ledger.filter((p) => p.net > 0) : move === 'paid_back' ? ledger.filter((p) => p.net < 0) : ledger.filter((p) => !p.settled).concat(ledger.filter((p) => p.settled)).slice(0, 8);
  const meta = DEBT_MOVES[move];
  const can = !!name.trim() && amountOk(amount);

  function pick(p) {
    setName(p.name);
    if ((move === 'got_back' || move === 'paid_back') && !amount) setAmount(String(Math.abs(p.net)));
    document.getElementById('add-amount')?.focus();
  }

  function save() {
    if (!can) return;
    const { store, fields } = debtEntryFields(move);
    const entry = { id: generateId(), name: name.trim(), amount: Number(amount), ...fields, ...(note.trim() ? { note: note.trim() } : {}), ...stamp(dateInput) };
    if (store === 'income') onAddIncome(entry); else onAdd(entry);
    onSaved(entry);
  }

  return (
    <div className="add-form add-form-debt">
      <Choice idPrefix="debt-move" value={move} onChange={setMove} columns={4}
        options={DEBT_MOVE_KEYS.map((k) => ({ key: k, label: DEBT_MOVES[k].label, tone: DEBT_MOVES[k].tone }))} />
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 2px 10px' }}>{meta.hint}</p>
      <TextField id="debt-name" first Icon={User} value={name} onChange={setName} onEnter={() => document.getElementById('add-amount')?.focus()} list="debt-people"
        placeholder={move === 'lent' ? 'Lent to whom?' : move === 'borrowed' ? 'Borrowed from whom?' : move === 'got_back' ? 'Who paid you back?' : 'Paid back to whom?'} />
      <datalist id="debt-people">{ledger.map((p) => <option key={p.key} value={p.name} />)}</datalist>
      {open.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '-2px 0 12px', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {open.map((p) => (
            <button key={p.key} type="button" onClick={() => pick(p)} className="add-choice"
              style={{ flexShrink: 0, padding: '6px 11px', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${name === p.name ? `var(--${meta.tone})` : 'var(--border)'}`, background: name === p.name ? `var(--${meta.tone}-bg)` : 'var(--surface2)', color: name === p.name ? `var(--${meta.tone})` : 'var(--text-secondary)' }}>
              {p.name}{!p.settled && <span style={{ opacity: 0.75 }}> · {p.net > 0 ? 'owes' : 'owed'} {formatAmount(Math.abs(p.net))}</span>}
            </button>
          ))}
        </div>
      )}
      <AmountField value={amount} onChange={setAmount} tone={meta.tone} onEnter={save} />
      <TextField id="debt-note" Icon={StickyNote} value={note} onChange={setNote} onEnter={save} placeholder="Note (optional) — e.g. for the bike repair" />
      <div className="add-foot">
        <DateField value={dateInput} onChange={setDateInput} />
        <SaveButton id="btn-save-debt" disabled={!can} tone={meta.tone} onClick={save}>{can ? `${meta.label} · ${formatAmount(Number(amount))}` : `Add — ${meta.label.toLowerCase()}`}</SaveButton>
      </div>
    </div>
  );
}

/* ── Savings (optionally towards a goal) ─────────────────────── */
function SavingsForm({ settings, onAdd, onSaved, startDate, initialGoal }) {
  const goals = (settings?.goals ?? []).filter(isGoalOpen);
  const [amount, setAmount] = useState('');
  const [savingsType, setSavingsType] = useState('cash');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [goalId, setGoalId] = useState(goals.some((g) => g.id === initialGoal) ? initialGoal : '');
  const goal = goals.find((g) => g.id === goalId);
  const [heldWith, setHeldWith] = useState(goal?.heldWith ?? '');
  const [dateInput, setDateInput] = useState(startDate);
  const st = getSavingsType(savingsType);
  const finalName = name.trim() || (goal ? goal.name : st.label);
  const can = amountOk(amount);

  function chooseGoal(id) {
    const next = id === goalId ? '' : id;
    setGoalId(next);
    const g = goals.find((x) => x.id === next);
    if (g?.heldWith) setHeldWith(g.heldWith);
  }

  function save() {
    if (!can) return;
    const entry = {
      id: generateId(), type: 'savings', name: finalName, amount: Number(amount), savingsType, ...stamp(dateInput),
      ...(st.hasPlatform && platform.trim() ? { platform: platform.trim() } : {}),
      ...(goalId ? { goalId } : {}),
      ...(heldWith.trim() ? { heldWith: heldWith.trim() } : {}),
    };
    onAdd(entry);
    onSaved(entry);
  }

  return (
    <div className="add-form add-form-savings">
      <TextField id="savings-name" first value={name} onChange={setName} onEnter={() => document.getElementById('add-amount')?.focus()} placeholder={goal ? `${goal.name} (optional name)` : 'What for? (optional) — e.g. Nifty 50 SIP'} />
      <AmountField value={amount} onChange={setAmount} tone="savings" onEnter={save} />
      <Choice idPrefix="savings-type" value={savingsType} onChange={setSavingsType} tone="savings"
        options={SAVINGS_TYPES.map((s) => ({ key: s.key, label: s.label }))} />
      {goals.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 2px 6px' }}>For a goal?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {goals.map((g) => (
              <button key={g.id} type="button" id={`savings-goal-${g.id}`} onClick={() => chooseGoal(g.id)} className="add-choice"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${goalId === g.id ? 'var(--savings)' : 'var(--border)'}`, background: goalId === g.id ? 'var(--savings-bg)' : 'var(--surface2)', color: goalId === g.id ? 'var(--savings)' : 'var(--text-secondary)' }}>
                <Flag size={12} /> {g.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className={st.hasPlatform ? 'add-pair' : undefined}>
        {st.hasPlatform && <TextField id="savings-platform" value={platform} onChange={setPlatform} onEnter={save} placeholder="Platform — e.g. Angel One" />}
        <TextField id="savings-held" Icon={User} value={heldWith} onChange={setHeldWith} onEnter={save} placeholder="Kept with — cash, a person, a bank…" />
      </div>
      <div className="add-foot">
        <DateField value={dateInput} onChange={setDateInput} />
        <SaveButton id="btn-save-savings" disabled={!can} tone="savings" onClick={save}>{can ? `Save ${formatAmount(Number(amount))}${goal ? ` for ${goal.name}` : ''}` : 'Add savings'}</SaveButton>
      </div>
    </div>
  );
}
