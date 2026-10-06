// ─── GoalModal ────────────────────────────────────────────────────
import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { SAVINGS_TYPES } from '../../utils/typeConfig';
import { toKey } from '../../utils/recurring';

export default function GoalModal({ goal, onSave, onDelete, onClose }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.target != null ? String(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [startDate, setStartDate] = useState(goal?.startDate ?? toKey(new Date()));
  const [savingsType, setSavingsType] = useState(goal?.savingsType ?? '');
  const [keyword, setKeyword] = useState(goal?.keyword ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const t = Number(target);
  const canSave = name.trim() && t > 0 && startDate && (!deadline || deadline >= startDate);

  function save() {
    if (!canSave) return;
    onSave({
      ...(goal ?? {}),
      name: name.trim(), target: t, startDate,
      deadline: deadline || undefined,
      savingsType: savingsType || undefined,
      keyword: keyword.trim() || undefined,
    });
    onClose();
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal title="Delete this goal?" message="Your savings entries are untouched — only the goal is removed."
          onConfirm={() => { onDelete(goal.id); onClose(); }} onCancel={() => setConfirmDelete(false)} />
      )}
      <ModalShell
        title={goal ? 'Edit Goal' : 'New Savings Goal'}
        subtitle="Progress is counted from matching savings entries — nothing to log twice."
        onClose={onClose}
        footer={<>
          {goal && onDelete && <GhostButton danger onClick={() => setConfirmDelete(true)} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={!canSave} color="var(--savings)"><Check size={14} /> {goal ? 'Save changes' : 'Create goal'}</PrimaryButton>
        </>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
          <Field label="Goal">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" style={fieldStyle} autoFocus />
          </Field>
          <Field label="Target">
            <input type="text" inputMode="decimal" value={target} placeholder="100000" onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setTarget(v); }} style={{ ...fieldStyle, fontWeight: 700 }} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Count savings from">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
          </Field>
          <Field label="Deadline (optional)">
            <input type="date" value={deadline} min={startDate} onChange={(e) => setDeadline(e.target.value)} style={fieldStyle} />
          </Field>
        </div>
        <Field label="Which savings count?" hint="Pick a type and/or a word that appears in the entry name or platform.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={() => setSavingsType('')} style={chip(savingsType === '', 'var(--savings)')}>All savings</button>
            {SAVINGS_TYPES.map((st) => (
              <button key={st.key} type="button" onClick={() => setSavingsType(st.key)} style={chip(savingsType === st.key, st.color)}>{st.label}</button>
            ))}
          </div>
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword, e.g. “Nifty” or “Zerodha” (optional)" style={fieldStyle} />
        </Field>
      </ModalShell>
    </>
  );
}

const chip = (active, color) => ({
  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: `1.5px solid ${active ? color : 'var(--border)'}`, background: active ? color + '22' : 'transparent',
  color: active ? color : 'var(--text-secondary)',
});
