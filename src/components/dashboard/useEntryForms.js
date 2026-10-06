// ─── Desktop dashboard: entry-form state ─────────────────────────
// These hooks are called by DesktopDashboard (not by the cards) so the
// half-typed form survives switching to History / Billings / Settings and
// back — the cards themselves unmount when the dashboard view is hidden.
import { useState, useRef, useMemo } from 'react';
import { generateId } from '../../utils/storage';
import { todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { incomeKindFlags } from '../../utils/finance';
import { TRANSACTION_TYPES } from '../../utils/typeConfig';
import { inferCategory } from '../../utils/categories';
import { parseQuickEntry } from '../../utils/smartInput';

/* ── Quick entry: expense / person / savings ── */
export function useQuickEntryForm({ onAddTransaction, personDebts, categoryRules = {}, onLearnCategory }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [type, setType] = useState('expense');
  const [direction, setDirection] = useState('lent');
  const [savingsType, setSavingsType] = useState('cash');
  const [platform, setPlatform] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [isCustomName, setIsCustomName] = useState(false);

  const nameRef = useRef(null);
  const amountRef = useRef(null);

  const debtPersons = useMemo(() => {
    if (direction !== 'repaid') return [];
    return Object.keys(personDebts || {}).filter(p => (personDebts[p]?.netOwed ?? 0) > 0);
  }, [personDebts, direction]);

  const hasDebtPersons = debtPersons.length > 0;
  const isRepayDirection = type === 'person' && direction === 'repaid';
  const sel = TRANSACTION_TYPES.find(t => t.key === type);
  const suggestedCategory = type === 'expense' ? inferCategory(name, categoryRules) : null;
  const effectiveCategory = type === 'expense' ? (categoryTouched && category ? category : suggestedCategory) : null;
  const pickCategory = (c) => { setCategory(c); setCategoryTouched(true); };

  /** Enter in the name field: "chai 20" saves straight away, otherwise jump to amount. */
  function handleNameEnter() {
    if (!amount) {
      const parsed = parseQuickEntry(name);
      if (parsed) { saveEntry({ name: parsed.name, amount: String(parsed.amount) }); return; }
    }
    amountRef.current?.focus();
  }

  function saveEntry(override = {}) {
    const rawName = override.name ?? name, rawAmount = override.amount ?? amount;
    const n = rawName.trim(), a = parseFloat(rawAmount);
    if (!n || isNaN(a) || a <= 0) return;

    const isoDate = dateInputToISO(dateInput);
    if (type === 'expense') {
      const cat = categoryTouched && category ? category : inferCategory(n, categoryRules);
      if (categoryTouched) onLearnCategory?.(n, cat);
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'expense', category: cat,
        date: isoDate, month: isoToMonth(isoDate),
      });
    } else if (type === 'person') {
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'person',
        direction, date: isoDate, month: isoToMonth(isoDate),
      });
    } else if (type === 'savings') {
      onAddTransaction({
        id: generateId(), name: n, amount: a, type: 'savings',
        savingsType, platform, date: isoDate, month: isoToMonth(isoDate),
      });
    }

    setName(''); setAmount(''); setPlatform(''); setIsFullPayment(false); setIsCustomName(false);
    setCategory(null); setCategoryTouched(false);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  return {
    name, setName, amount, setAmount, dateInput, setDateInput,
    type, setType, direction, setDirection, savingsType, setSavingsType,
    platform, setPlatform, isFullPayment, setIsFullPayment, isCustomName, setIsCustomName,
    nameRef, amountRef, debtPersons, hasDebtPersons, isRepayDirection, sel, saveEntry,
    suggestedCategory, effectiveCategory, pickCategory, handleNameEnter,
  };
}

/* ── Income / borrowed / repayment received ── */
export function useIncomeEntryForm({ onAddIncome, personDebts }) {
  const [incMode, setIncMode] = useState('income'); // 'income' | 'borrowed' | 'repaymentRec'
  const [iName, setIName] = useState('');
  const [iAmount, setIAmount] = useState('');
  const [iDateInput, setIDateInput] = useState(todayInputValue());
  const [isICustomName, setIsICustomName] = useState(false);
  const [isIFullPayment, setIsIFullPayment] = useState(false);
  const iNameRef = useRef(null);
  const iAmountRef = useRef(null);

  const lentPersons = useMemo(
    () => Object.keys(personDebts || {}).filter(p => (personDebts[p]?.netLent ?? 0) > 0),
    [personDebts]
  );
  const hasLentPersons = lentPersons.length > 0;

  function saveIncome() {
    const n = iName.trim(), a = parseFloat(iAmount);
    if (!n || isNaN(a) || a <= 0 || !onAddIncome) return;

    const isoDate = dateInputToISO(iDateInput);
    onAddIncome({
      id: generateId(),
      name: n,
      amount: a,
      type: 'income',
      ...incomeKindFlags(incMode === 'repaymentRec' ? 'repayment' : incMode),
      date: isoDate,
      month: isoToMonth(isoDate),
    });
    setIName(''); setIAmount(''); setIDateInput(todayInputValue()); setIsICustomName(false); setIsIFullPayment(false);
    setTimeout(() => iNameRef.current?.focus(), 50);
  }

  return {
    incMode, setIncMode, iName, setIName, iAmount, setIAmount, iDateInput, setIDateInput,
    isICustomName, setIsICustomName, isIFullPayment, setIsIFullPayment,
    iNameRef, iAmountRef, lentPersons, hasLentPersons, saveIncome,
  };
}
