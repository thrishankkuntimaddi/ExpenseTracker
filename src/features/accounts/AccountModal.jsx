// ─── Add / edit an account ───────────────────────────────────────
// Kind (bank · cash · credit card), which bank, a nickname, the last 4
// digits, what it's for (Salary, Savings, Bills … or your own word), a
// colour, and the balance right now — what the bank app shows. For a card:
// what's due now, and the limit.
import { useState } from 'react';
import { Check, Trash2, Archive } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { ACCOUNT_KINDS, ACCOUNT_TAGS, ACCOUNT_COLORS, BANKS } from '../../utils/accounts';
import { KIND_ICON } from '../../components/accountChoice';
import { t as tr } from '../../i18n';

const chip = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'var(--surface2)', color: on ? 'var(--accent)' : 'var(--text-secondary)',
});

/**
 * account: the account being edited (with .balance), or null for a new one.
 * onSave({ ...fields }, balanceNow | null, makeDefault)
 */
export default function AccountModal({ account, isDefault = false, color: newColor = 1, dark = false, canRemove, removeLabel, onSave, onRemove, onClose }) {
  const editing = !!account;
  const [kind, setKind] = useState(account?.kind ?? 'bank');
  const [bank, setBank] = useState(account?.bank ?? '');
  // The starter "Bank · UPI" isn't a name anyone chose: start empty so the bank becomes it
  const [name, setName] = useState(account?.starter ? '' : account?.name ?? '');
  const [last4, setLast4] = useState(account?.last4 ?? '');
  const [tag, setTag] = useState(account?.tag ?? '');
  const [color, setColor] = useState(Number(account?.color) || newColor);
  const [limit, setLimit] = useState(account?.limit ? String(account.limit) : '');
  const shown = account ? (account.kind === 'card' ? -account.balance : account.balance) : null;
  const [balance, setBalance] = useState(shown != null ? String(Math.round(shown * 100) / 100) : '');
  const [makeDefault, setMakeDefault] = useState(isDefault);
  const [custom, setCustom] = useState(account?.tag && !ACCOUNT_TAGS.includes(account.tag));

  // "indian bank" → "Indian Bank": the bank as it's usually written
  const canonical = BANKS.find((b) => b.toLowerCase() === bank.trim().toLowerCase()) ?? bank.trim();
  const typed = bank.trim().toLowerCase();
  const suggestions = typed === canonical.toLowerCase() && BANKS.includes(canonical) ? []
    : (typed ? BANKS.filter((b) => b.toLowerCase().includes(typed)) : BANKS).slice(0, 8);
  const finalName = name.trim() || (kind === 'cash' ? 'Cash' : [canonical, last4 ? `••${last4}` : ''].filter(Boolean).join(' '));
  const num = balance.trim() === '' ? null : Number(balance.replace(/,/g, ''));
  const can = !!finalName && (num == null || Number.isFinite(num));
  const changed = num != null && (shown == null || Math.abs(num - shown) >= 0.005);

  function save() {
    if (!can) return;
    const fields = {
      kind, name: finalName, color,
      bank: kind === 'cash' ? '' : canonical, last4: kind === 'cash' ? '' : last4, tag: tag.trim(),
      limit: kind === 'card' && Number(limit) > 0 ? Number(limit) : null,
    };
    // A card's balance is stored negative: what you owe
    const bal = changed || !editing ? (num ?? 0) * (kind === 'card' ? -1 : 1) : null;
    onSave(fields, bal, makeDefault);
    onClose();
  }

  return (
    <ModalShell title={editing ? tr('Edit account') : tr('Add an account')} subtitle={tr('A bank, your cash, or a credit card')} onClose={onClose}
      footer={<>
        {editing && canRemove && (
          <GhostButton id="acct-remove" danger onClick={() => { onRemove(); onClose(); }} style={{ flex: '0 0 auto', padding: '11px 14px' }}>
            {removeLabel === 'delete' ? <Trash2 size={13} /> : <Archive size={13} />}
          </GhostButton>
        )}
        <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>
        <PrimaryButton id="acct-save" onClick={save} disabled={!can}><Check size={14} /> {editing ? tr('Save') : tr('Add account')}</PrimaryButton>
      </>}>
      <div role="radiogroup" aria-label={tr('Kind')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(ACCOUNT_KINDS).map(([k, m]) => {
          const Icon = KIND_ICON[k];
          return <button key={k} type="button" role="radio" aria-checked={kind === k} id={`acct-kind-${k}`} onClick={() => setKind(k)} style={chip(kind === k)}><Icon size={13} /> {tr(m.label)}</button>;
        })}
      </div>

      {kind !== 'cash' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 8 }}>
          <Field label={tr('Bank')}>
            <input id="acct-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="HDFC, SBI, Canara…" autoComplete="off" style={fieldStyle} autoFocus={!editing} />
          </Field>
          <Field label={tr('Last 4')}>
            <input id="acct-last4" inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={tr('Optional')} style={fieldStyle} />
          </Field>
        </div>
      )}
      {kind !== 'cash' && suggestions.length > 0 && (
        <div id="acct-bank-suggest" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginTop: -4 }}>
          {suggestions.map((b) => <button key={b} type="button" onClick={() => setBank(b)} style={{ ...chip(false), flexShrink: 0 }}>{b}</button>)}
        </div>
      )}

      <Field label={tr('Name')} hint={tr('Optional — shown on chips and lists')}>
        <input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={finalName || (kind === 'card' ? 'HDFC Millennia' : 'SBI Salary')} style={fieldStyle} />
      </Field>

      <Field label={tr('What it’s for')} hint={tr('Optional — e.g. HDFC for salary, SBI for savings, Indian Bank for bills')}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ACCOUNT_TAGS.map((tg) => (
            <button key={tg} type="button" id={`acct-tag-${tg}`} onClick={() => { setCustom(false); setTag(tag === tg ? '' : tg); }} style={chip(!custom && tag === tg)}>{tr(tg)}</button>
          ))}
          <button type="button" id="acct-tag-custom" onClick={() => { setCustom(true); if (ACCOUNT_TAGS.includes(tag)) setTag(''); }} style={chip(custom)}>{tr('Other…')}</button>
        </div>
        {custom && <input id="acct-tag-text" value={tag} onChange={(e) => setTag(e.target.value.slice(0, 24))} placeholder={tr('e.g. Rent, Kids, Travel')} style={{ ...fieldStyle, marginTop: 8 }} />}
      </Field>

      <Field label={kind === 'card' ? tr('Due right now') : tr('Balance right now')} hint={editing
        ? tr('Change it to match your bank app — entries from today on keep counting from there.')
        : kind === 'card' ? tr('What you owe on the card today. 0 if it’s clear.') : tr('What your bank app shows today. Entries from now on move it.')}>
        <input id="acct-balance" inputMode="decimal" value={balance} onChange={(e) => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^-?\d*\.?\d{0,2}$/.test(v)) setBalance(v); }} placeholder="0" style={{ ...fieldStyle, fontSize: 16, fontWeight: 750 }} />
      </Field>

      {kind === 'card' && (
        <Field label={tr('Credit limit')} hint={tr('Optional')}>
          <input id="acct-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} placeholder="1,00,000" style={fieldStyle} />
        </Field>
      )}

      <Field label={tr('Colour')}>
        <div role="radiogroup" aria-label={tr('Colour')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCOUNT_COLORS[dark ? 'dark' : 'light'].map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={color === i + 1} aria-label={`${tr('Colour')} ${i + 1}`} id={`acct-color-${i + 1}`} onClick={() => setColor(i + 1)}
              style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', border: 'none', boxShadow: color === i + 1 ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none' }} />
          ))}
        </div>
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 650, color: 'var(--text)', cursor: 'pointer' }}>
        <input id="acct-default" type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
        {tr('Use for new entries by default')}
      </label>
    </ModalShell>
  );
}
