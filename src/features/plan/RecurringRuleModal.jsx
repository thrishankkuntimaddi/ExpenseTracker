// ─── RecurringRuleModal ───────────────────────────────────────────
// Create / edit a recurring rule (rent, SIP, salary, Netflix …).
import { useState } from 'react';
import { Check, Trash2, Zap } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import CategoryPicker from '../../components/CategoryPicker';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { inferCategory } from '../../utils/categories';
import { FREQUENCIES, WEEKDAYS, toKey } from '../../utils/recurring';
import { SAVINGS_TYPES, getSavingsType } from '../../utils/typeConfig';

const KINDS = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)' },
  { key: 'savings', label: 'Savings', color: 'var(--savings)' },
  { key: 'income',  label: 'Income',  color: 'var(--income)'  },
];

export default function RecurringRuleModal({ rule, categoryRules = {}, onSave, onDelete, onClose }) {
  const today = toKey(new Date());
  const [kind, setKind] = useState(rule?.kind ?? 'expense');
  const [name, setName] = useState(rule?.name ?? '');
  const [amount, setAmount] = useState(rule?.amount != null ? String(rule.amount) : '');
  const [category, setCategory] = useState(rule?.category ?? null);
  const [categoryTouched, setCategoryTouched] = useState(!!rule?.category);
  const [savingsType, setSavingsType] = useState(rule?.savingsType ?? 'sip');
  const [platform, setPlatform] = useState(rule?.platform ?? '');
  const [frequency, setFrequency] = useState(rule?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(rule?.dayOfMonth ?? new Date().getDate()));
  const [weekday, setWeekday] = useState(rule?.weekday ?? new Date().getDay());
  const [startDate, setStartDate] = useState(rule?.startDate ?? today);
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [autoPost, setAutoPost] = useState(rule?.autoPost ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const suggested = kind === 'expense' ? inferCategory(name, categoryRules) : null;
  const effectiveCategory = categoryTouched && category ? category : suggested;
  const sel = KINDS.find((k) => k.key === kind);
  const amt = Number(amount);
  const dom = Number(dayOfMonth);
  const canSave = name.trim() && amt > 0 && startDate && (frequency !== 'monthly' || (dom >= 1 && dom <= 31)) && (!endDate || endDate >= startDate);

  function save() {
    if (!canSave) return;
    const next = {
      ...(rule ?? {}),
      kind, name: name.trim(), amount: amt, frequency, startDate,
      endDate: endDate || undefined,
      autoPost,
      dayOfMonth: frequency === 'monthly' ? dom : undefined,
      weekday: frequency === 'weekly' ? Number(weekday) : undefined,
      category: kind === 'expense' ? effectiveCategory : undefined,
      savingsType: kind === 'savings' ? savingsType : undefined,
      platform: kind === 'savings' && getSavingsType(savingsType).hasPlatform && platform.trim() ? platform.trim() : undefined,
    };
    onSave(next);
    onClose();
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete this recurring rule?"
          message="Entries already logged from it are kept. Only future occurrences stop."
          onConfirm={() => { onDelete(rule.id); onClose(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <ModalShell
        title={rule ? 'Edit Recurring' : 'New Recurring Entry'}
        subtitle="Rent, EMI, SIP, salary, subscriptions — logged on schedule."
        onClose={onClose}
        footer={<>
          {rule && onDelete && <GhostButton danger onClick={() => setConfirmDelete(true)} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={!canSave} color={sel.color}><Check size={14} /> {rule ? 'Save changes' : 'Create rule'}</PrimaryButton>
        </>}
      >
        {/* Kind */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 12, padding: 3, border: '1px solid var(--border)' }}>
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => setKind(k.key)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: kind === k.key ? k.color : 'transparent', color: kind === k.key ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s',
            }}>{k.label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
          <Field label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? 'Salary' : kind === 'savings' ? 'Nifty 50 SIP' : 'House rent'} style={fieldStyle} autoFocus />
          </Field>
          <Field label="Amount">
            <input type="text" inputMode="decimal" value={amount} placeholder="0" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }} style={{ ...fieldStyle, fontWeight: 700 }} />
          </Field>
        </div>

        {kind === 'expense' && (
          <CategoryPicker size="sm" value={effectiveCategory} suggested={suggested} onChange={(c) => { setCategory(c); setCategoryTouched(true); }} />
        )}

        {kind === 'savings' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Savings type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SAVINGS_TYPES.map((st) => (
                <button key={st.key} type="button" onClick={() => setSavingsType(st.key)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                  background: savingsType === st.key ? st.color + '22' : 'transparent', color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                }}>{st.label}</button>
              ))}
            </div>
            {getSavingsType(savingsType).hasPlatform && (
              <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Platform (e.g. Zerodha, Groww)" style={{ ...fieldStyle, marginTop: 8 }} />
            )}
          </div>
        )}

        {/* Schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: frequency === 'monthly' || frequency === 'weekly' ? '1fr 1fr' : '1fr', gap: 8 }}>
          <Field label="Repeats">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={fieldStyle}>
              {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          {frequency === 'monthly' && (
            <Field label="Day of month" hint={dom > 28 ? 'Shorter months use their last day.' : undefined}>
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} style={fieldStyle} />
            </Field>
          )}
          {frequency === 'weekly' && (
            <Field label="Weekday">
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={fieldStyle}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Starts">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
          </Field>
          <Field label="Ends (optional)">
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={fieldStyle} />
          </Field>
        </div>

        {/* Auto-post */}
        <button type="button" onClick={() => setAutoPost((v) => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, textAlign: 'left',
          border: `1.5px solid ${autoPost ? 'var(--accent-border)' : 'var(--border)'}`, background: autoPost ? 'var(--accent-bg)' : 'var(--surface2)',
          cursor: 'pointer', fontFamily: 'inherit', width: '100%',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: autoPost ? 'var(--accent)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
            <Zap size={14} style={{ color: autoPost ? '#fff' : 'var(--text-muted)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{autoPost ? 'Logs automatically' : 'Ask me each time'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {autoPost ? 'Posted silently on the due date when you open the app.' : 'Shows a one-tap “Log / Skip” card when due — good for amounts that vary.'}
            </div>
          </div>
          <span className={`toggle-track ${autoPost ? 'on' : ''}`} style={{ pointerEvents: 'none' }}><span className="toggle-thumb" /></span>
        </button>
      </ModalShell>
    </>
  );
}
