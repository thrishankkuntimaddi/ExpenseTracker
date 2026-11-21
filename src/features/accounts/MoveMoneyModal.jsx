// ─── Move money between your own accounts ────────────────────────
// SBI → HDFC, an ATM withdrawal (bank → cash), a cash deposit, paying the
// credit-card bill (bank → card). Stored as the neutral 'cash' entry, so it
// never counts as spending or income — see utils/accounts.js.
import { useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import AccountPicker from '../../components/AccountPicker';
import { openAccounts, accountLabel, defaultAccountId } from '../../utils/accounts';
import { generateId } from '../../utils/storage';
import { todayInputValue, dateInputToISO, isoToMonth, formatAmount } from '../../utils/dateHelpers';
import { t as tr } from '../../i18n';

export default function MoveMoneyModal({ settings, balances, from: startFrom, to: startTo, onAdd, onClose }) {
  const open = openAccounts(settings);
  const [from, setFrom] = useState(startFrom ?? defaultAccountId(settings));
  const [to, setTo] = useState(startTo ?? open.find((a) => a.id !== (startFrom ?? defaultAccountId(settings)))?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const a = open.find((x) => x.id === from), b = open.find((x) => x.id === to);
  const n = Number(amount);
  const can = a && b && a.id !== b.id && n > 0;
  const balOf = (id) => balances?.accounts.find((x) => x.id === id)?.balance;
  const what = b?.kind === 'card' ? 'Card bill paid' : b?.kind === 'cash' ? 'Cash withdrawn' : a?.kind === 'cash' ? 'Cash deposited' : 'Moved';

  function save() {
    if (!can) return;
    const iso = dateInputToISO(date);
    onAdd({
      id: generateId(), type: 'cash', amount: n, accountId: a.id, toAccountId: b.id,
      name: `${accountLabel(a)} → ${accountLabel(b)}`, ...(note.trim() ? { note: note.trim() } : {}),
      date: iso, month: isoToMonth(iso),
    }, `${tr(what)} · ${formatAmount(n)}`);
    onClose();
  }

  return (
    <ModalShell title={tr('Move money')} subtitle={tr('Between your own accounts — not spending, not income')} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
        <PrimaryButton id="move-save" onClick={save} disabled={!can}><Check size={14} /> {can ? `${tr(what)} · ${formatAmount(n)}` : tr('Move')}</PrimaryButton>
      </>}>
      <AccountPicker id="move-from" label="From" value={from} onChange={(id) => { setFrom(id); if (id === to) setTo(open.find((x) => x.id !== id)?.id ?? ''); }} settings={settings} />
      {balOf(from) != null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>{tr('Now')} {formatAmount(balOf(from))}</div>}
      <ArrowDown size={16} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
      <AccountPicker id="move-to" label="To" value={to} onChange={setTo} settings={settings} exclude={from} />
      <Field label={tr('Amount')}>
        <input id="move-amount" inputMode="decimal" autoFocus value={amount} onChange={(e) => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="0" style={{ ...fieldStyle, fontSize: 18, fontWeight: 800 }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8 }}>
        <Field label={tr('Note')}><input id="move-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Optional')} style={fieldStyle} /></Field>
        <Field label={tr('Date')}><input type="date" value={date} max={todayInputValue()} onChange={(e) => e.target.value && setDate(e.target.value)} style={fieldStyle} /></Field>
      </div>
    </ModalShell>
  );
}
