// ─── GoalModal ────────────────────────────────────────────────────
// A goal: how much, by when, how much a month, where the money is kept,
// and which day of the month to be reminded. Money is added from the goal
// ("Add money" → a savings entry for it). Older goals that counted savings
// by type / keyword keep that option.
import { useState } from 'react';
import { Check, Trash2, XCircle } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { SAVINGS_TYPES } from '../../utils/typeConfig';
import { toKey } from '../../utils/recurring';
import { endGoal } from '../../utils/goals';
import { ordinal } from '../../utils/report';
import { formatAmount } from '../../utils/dateHelpers';

const lastDayOf = (monthInput) => { const [y, m] = monthInput.split('-').map(Number); return toKey(new Date(y, m, 0)); };
const monthsBetween = (fromKey, toMonth) => {
  const [fy, fm] = fromKey.split('-').map(Number); const [ty, tm] = toMonth.split('-').map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
};

export default function GoalModal({ goal, onSave, onDelete, onClose }) {
  const today = toKey(new Date());
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.target != null ? String(goal.target) : '');
  const [byMonth, setByMonth] = useState(goal?.deadline ? goal.deadline.slice(0, 7) : '');
  const [monthly, setMonthly] = useState(goal?.monthly != null ? String(goal.monthly) : '');
  const [heldWith, setHeldWith] = useState(goal?.heldWith ?? '');
  const [remindDay, setRemindDay] = useState(goal?.remindDay ?? 1);
  const [startDate, setStartDate] = useState(goal?.startDate ?? today);
  const legacy = goal && !goal.linked;
  const [savingsType, setSavingsType] = useState(goal?.savingsType ?? '');
  const [keyword, setKeyword] = useState(goal?.keyword ?? '');
  const [confirm, setConfirm] = useState(null);   // 'delete' | 'close'

  const t = Number(target);
  const suggested = t > 0 && byMonth ? Math.ceil(t / monthsBetween(startDate, byMonth)) : null;
  const canSave = name.trim() && t > 0 && startDate && (!byMonth || lastDayOf(byMonth) >= startDate);

  function save() {
    if (!canSave) return;
    onSave({
      ...(goal ?? { linked: true, status: 'active' }),
      name: name.trim(), target: t, startDate,
      deadline: byMonth ? lastDayOf(byMonth) : undefined,
      monthly: Number(monthly) > 0 ? Number(monthly) : undefined,
      heldWith: heldWith.trim() || undefined,
      remindDay: Number(remindDay) || 1,
      ...(legacy ? { savingsType: savingsType || undefined, keyword: keyword.trim() || undefined } : {}),
    });
    onClose();
  }

  return (
    <>
      {confirm === 'delete' && (
        <ConfirmDeleteModal title="Delete this goal?" message="The money you put towards it stays in your savings — only the goal is removed."
          onConfirm={() => { onDelete(goal.id); onClose(); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'close' && (
        <ConfirmDeleteModal title="Close this goal?" message="It moves to Finished goals. You can reopen it any time."
          onConfirm={() => { onSave(endGoal(goal, 'closed', today)); onClose(); }} onCancel={() => setConfirm(null)} />
      )}
      <ModalShell
        title={goal ? 'Edit goal' : 'New goal'}
        subtitle="Put a share aside each month — wherever you keep it."
        onClose={onClose}
        footer={<>
          {goal && onDelete && <GhostButton danger onClick={() => setConfirm('delete')} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          {goal ? <GhostButton onClick={() => setConfirm('close')}><XCircle size={13} /> Close goal</GhostButton> : <GhostButton onClick={onClose}>Cancel</GhostButton>}
          <PrimaryButton onClick={save} disabled={!canSave} color="var(--savings)"><Check size={14} /> {goal ? 'Save' : 'Create goal'}</PrimaryButton>
        </>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
          <Field label="Goal">
            <input id="goal-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bike, emergency fund…" style={fieldStyle} autoFocus />
          </Field>
          <Field label="Amount">
            <input id="goal-target" type="text" inputMode="decimal" value={target} placeholder="100000" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setTarget(v); }} style={{ ...fieldStyle, fontWeight: 700 }} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Needed by (optional)">
            <input id="goal-by" type="month" value={byMonth} min={startDate.slice(0, 7)} onChange={(e) => setByMonth(e.target.value)} style={fieldStyle} />
          </Field>
          <Field label="Each month" hint={suggested ? `${formatAmount(suggested)} gets you there` : undefined}>
            <input id="goal-monthly" type="text" inputMode="decimal" value={monthly} placeholder={suggested ? String(suggested) : '20000'} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setMonthly(v); }} style={fieldStyle} />
          </Field>
        </div>
        <Field label="Kept with" hint="Cash at home, a person you trust, a bank account — change it any time with “Moved it”.">
          <input id="goal-held" type="text" value={heldWith} onChange={(e) => setHeldWith(e.target.value)} placeholder="e.g. Pritam, Cash, HDFC savings" style={fieldStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Remind me on the">
            <select value={remindDay} onChange={(e) => setRemindDay(Number(e.target.value))} style={fieldStyle}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
            </select>
          </Field>
          <Field label="Starting">
            <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} style={fieldStyle} />
          </Field>
        </div>
        {legacy && (
          <Field label="Also count these savings" hint="This goal was created before goals took their own money — it also counts matching savings entries.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <button type="button" onClick={() => setSavingsType('')} style={chip(savingsType === '')}>All savings</button>
              {SAVINGS_TYPES.map((st) => (
                <button key={st.key} type="button" onClick={() => setSavingsType(st.key)} style={chip(savingsType === st.key)}>{st.label}</button>
              ))}
            </div>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword (optional)" style={fieldStyle} />
          </Field>
        )}
      </ModalShell>
    </>
  );
}

const chip = (active) => ({
  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: `1.5px solid ${active ? 'var(--savings)' : 'var(--border)'}`, background: active ? 'var(--savings-bg)' : 'var(--surface2)',
  color: active ? 'var(--savings)' : 'var(--text-secondary)',
});
