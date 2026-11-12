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
import { savingsChoicesFor, getSavingsType } from '../../utils/typeConfig';
import CurrencySelect from '../../components/CurrencySelect';
import { rawOf } from '../../utils/fx';
import { getDisplayCurrency } from '../../utils/money';
import { INSURANCE_TYPES } from '../../utils/bills';

import { t as tr } from '../../i18n';
const KINDS = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)' },
  { key: 'savings', label: 'Savings', color: 'var(--savings)' },
  { key: 'income',  label: 'Income',  color: 'var(--income)'  },
];

export default function RecurringRuleModal({ rule, preset = null, categoryRules = {}, onSave, onDelete, onClose }) {
  const init = rawOf(rule) ?? preset;   // a new rule can start from a preset (Rent, SIP …); edited in its own currency
  const today = toKey(new Date());
  const [kind, setKind] = useState(init?.kind ?? 'expense');
  const [name, setName] = useState(init?.name ?? '');
  const [amount, setAmount] = useState(init?.amount != null ? String(init.amount) : '');
  const [currency, setCurrency] = useState(init?.currency ?? getDisplayCurrency());
  const [category, setCategory] = useState(init?.category ?? null);
  const [categoryTouched, setCategoryTouched] = useState(!!init?.category);
  const [savingsType, setSavingsType] = useState(init?.savingsType ?? 'sip');
  const [platform, setPlatform] = useState(init?.platform ?? '');
  const [frequency, setFrequency] = useState(init?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(init?.dayOfMonth ?? new Date().getDate()));
  const [weekday, setWeekday] = useState(init?.weekday ?? new Date().getDay());
  const [startDate, setStartDate] = useState(init?.startDate ?? today);
  const [endDate, setEndDate] = useState(init?.endDate ?? '');
  const [autoPost, setAutoPost] = useState(init?.autoPost ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Insurance: what it covers, with whom, and for how much
  const [insuranceType, setInsuranceType] = useState(init?.insuranceType ?? 'health');
  const [insurer, setInsurer] = useState(init?.insurer ?? '');
  const [policyNo, setPolicyNo] = useState(init?.policyNo ?? '');
  const [cover, setCover] = useState(init?.cover != null ? String(init.cover) : '');

  const suggested = kind === 'expense' ? inferCategory(name, categoryRules) : null;
  const effectiveCategory = categoryTouched && category ? category : suggested;
  const sel = KINDS.find((k) => k.key === kind);
  const insurance = kind === 'expense' && effectiveCategory === 'insurance';
  const amt = Number(amount);
  const dom = Number(dayOfMonth);
  const canSave = name.trim() && amt > 0 && startDate && (frequency !== 'monthly' || (dom >= 1 && dom <= 31)) && (!endDate || endDate >= startDate);

  function save() {
    if (!canSave) return;
    const next = {
      ...(rawOf(rule) ?? {}),
      kind, name: name.trim(), amount: amt, currency, frequency, startDate,
      endDate: endDate || undefined,
      autoPost,
      dayOfMonth: frequency === 'monthly' ? dom : undefined,
      weekday: frequency === 'weekly' ? Number(weekday) : undefined,
      category: kind === 'expense' ? effectiveCategory : undefined,
      savingsType: kind === 'savings' ? savingsType : undefined,
      platform: kind === 'savings' && getSavingsType(savingsType).hasPlatform && platform.trim() ? platform.trim() : undefined,
      ...(insurance
        ? { insuranceType, insurer: insurer.trim() || null, policyNo: policyNo.trim() || null, cover: Number(cover) > 0 ? Number(cover) : null }
        : { insuranceType: null, insurer: null, policyNo: null, cover: null }),
    };
    onSave(next);
    onClose();
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          title={tr("Delete this recurring rule?")}
          message="Entries already logged from it are kept. Only future occurrences stop."
          onConfirm={() => { onDelete(rule.id); onClose(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <ModalShell
        title={rule ? tr("Edit Recurring") : tr("New Recurring Entry")}
        subtitle={tr("Rent, EMI, SIP, salary, subscriptions — logged on schedule.")}
        onClose={onClose}
        footer={<>
          {rule && onDelete && <GhostButton danger onClick={() => setConfirmDelete(true)} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          <GhostButton onClick={onClose}>{tr("Cancel")}</GhostButton>
          <PrimaryButton onClick={save} disabled={!canSave} color={sel.color}><Check size={14} /> {rule ? tr("Save changes") : tr("Create rule")}</PrimaryButton>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
          <Field label={tr("Name")}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? tr("Salary") : kind === 'savings' ? tr("Nifty 50 SIP") : tr("House rent")} style={fieldStyle} autoFocus />
          </Field>
          <Field label={tr("Amount")}>
            <div style={{ display: 'flex', gap: 4 }}>
              <CurrencySelect compact value={currency} onChange={setCurrency} />
              <input type="text" inputMode="decimal" value={amount} placeholder="0" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }} style={{ ...fieldStyle, fontWeight: 700, minWidth: 0 }} />
            </div>
          </Field>
        </div>

        {kind === 'expense' && (
          <CategoryPicker size="sm" value={effectiveCategory} suggested={suggested} onChange={(c) => { setCategory(c); setCategoryTouched(true); }} />
        )}

        {insurance && (
          <div id="rule-insurance" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INSURANCE_TYPES.map((t) => (
                <button key={t.key} type="button" id={`rule-ins-${t.key}`} onClick={() => setInsuranceType(t.key)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1.5px solid ${insuranceType === t.key ? 'var(--expense)' : 'var(--border)'}`,
                  background: insuranceType === t.key ? 'var(--expense-bg)' : 'transparent', color: insuranceType === t.key ? 'var(--expense)' : 'var(--text-secondary)',
                }}>{t.label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label={tr("Insurer")}>
                <input id="rule-insurer" type="text" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder={tr("Star Health, LIC, Acko…")} style={fieldStyle} />
              </Field>
              <Field label={tr("Cover (sum insured)")}>
                <input id="rule-cover" type="text" inputMode="decimal" value={cover} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setCover(v); }} placeholder="500000" style={fieldStyle} />
              </Field>
            </div>
            <Field label={tr("Policy number (optional)")}>
              <input type="text" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder={tr("For claims and renewals")} style={fieldStyle} />
            </Field>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{tr("Set “Starts” to the renewal date. With Bills reminders on, you get a heads-up a week before it renews.")}</p>
          </div>
        )}

        {kind === 'savings' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tr("Savings type")}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {savingsChoicesFor(init?.savingsType).map((st) => (
                <button key={st.key} type="button" onClick={() => setSavingsType(st.key)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1.5px solid ${savingsType === st.key ? st.color : 'var(--border)'}`,
                  background: savingsType === st.key ? st.color + '22' : 'transparent', color: savingsType === st.key ? st.color : 'var(--text-secondary)',
                }}>{st.label}</button>
              ))}
            </div>
            {getSavingsType(savingsType).hasPlatform && (
              <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder={tr("Platform (e.g. Zerodha, Groww)")} style={{ ...fieldStyle, marginTop: 8 }} />
            )}
          </div>
        )}

        {/* Schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: frequency === 'monthly' || frequency === 'weekly' ? '1fr 1fr' : '1fr', gap: 8 }}>
          <Field label={tr("Repeats")}>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={fieldStyle}>
              {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          {frequency === 'monthly' && (
            <Field label={tr("Day of month")} hint={dom > 28 ? tr("Shorter months use their last day.") : undefined}>
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} style={fieldStyle} />
            </Field>
          )}
          {frequency === 'weekly' && (
            <Field label={tr("Weekday")}>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={fieldStyle}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label={tr("Starts")}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
          </Field>
          <Field label={tr("Ends (optional)")}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{autoPost ? tr("Logs automatically") : tr("Ask me each time")}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {autoPost ? tr("Posted silently on the due date when you open the app.") : tr("Shows a one-tap “Log / Skip” card when due — good for amounts that vary.")}
            </div>
          </div>
          <span className={`toggle-track ${autoPost ? 'on' : ''}`} style={{ pointerEvents: 'none' }}><span className="toggle-thumb" /></span>
        </button>
      </ModalShell>
    </>
  );
}
