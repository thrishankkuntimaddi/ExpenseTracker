// ─── TripModal ────────────────────────────────────────────────────
// Create / edit a trip: name, dates, who came, which one is you, and who
// pays together (a couple, a family) so they settle as one wallet.
import { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import ModalShell, { Field, PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';

export default function TripModal({ trip, onSave, onDelete, onClose }) {
  const [name, setName] = useState(trip?.name ?? '');
  const [startDate, setStartDate] = useState(trip?.startDate ?? toKey(new Date()));
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');
  const [members, setMembers] = useState(() => (trip?.members?.length ? trip.members.map((m) => ({ ...m })) : [{ id: generateId(), name: 'Me' }]));
  const [meId, setMeId] = useState(trip?.meMemberId ?? (trip?.members?.length ? null : null));
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const effectiveMe = meId ?? (members.length === 1 ? members[0].id : null);
  const validMembers = members.filter((m) => m.name.trim());
  const canSave = name.trim() && startDate && validMembers.length >= 2 && (!endDate || endDate >= startDate);

  function addMember(raw) {
    const names = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setMembers((p) => [...p, ...names.map((n) => ({ id: generateId(), name: n }))]);
    setNewName('');
  }
  function removeMember(id) {
    setMembers((p) => p.filter((m) => m.id !== id));
    if (meId === id) setMeId(null);
  }
  function setPaysWith(id, otherId) {
    setMembers((p) => {
      const other = p.find((m) => m.id === otherId);
      if (!other) return p.map((m) => (m.id === id ? { ...m, groupId: undefined } : m));
      const gid = other.groupId ?? generateId();
      return p.map((m) => (m.id === id || m.id === otherId ? { ...m, groupId: gid } : m));
    });
  }

  function save() {
    if (!canSave) return;
    // Drop empty names and groups with a single member left in them
    const cleaned = validMembers.map((m) => ({ ...m, name: m.name.trim() }));
    const counts = {};
    cleaned.forEach((m) => { if (m.groupId) counts[m.groupId] = (counts[m.groupId] ?? 0) + 1; });
    const final = cleaned.map((m) => (m.groupId && counts[m.groupId] > 1 ? m : { id: m.id, name: m.name }));
    onSave({
      ...(trip ?? {}),
      name: name.trim(), startDate, endDate: endDate || undefined,
      members: final,
      meMemberId: final.some((m) => m.id === effectiveMe) ? effectiveMe : undefined,
    });
    onClose();
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal title="Delete this trip?" message="All its expenses and settlements are removed. Entries already logged to your ledger stay."
          onConfirm={() => { onDelete(trip.id); onClose(); }} onCancel={() => setConfirmDelete(false)} />
      )}
      <ModalShell
        title={trip ? 'Edit Trip' : 'New Trip'} subtitle="Who came, and who pays as one wallet." onClose={onClose} maxWidth={500}
        footer={<>
          {trip && onDelete && <GhostButton danger onClick={() => setConfirmDelete(true)} style={{ flex: '0 0 auto', padding: '11px 14px' }}><Trash2 size={13} /></GhostButton>}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={!canSave} color="var(--external)"><Check size={14} /> {trip ? 'Save changes' : 'Create trip'}</PrimaryButton>
        </>}
      >
        <Field label="Trip name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa road trip" style={fieldStyle} autoFocus />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="From"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} /></Field>
          <Field label="To (optional)"><input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={fieldStyle} /></Field>
        </div>

        <Field label={`People (${validMembers.length})`} hint="Tick who you are. “Pays with” joins two people into one wallet — their spending and dues are combined.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map((m) => {
              const others = members.filter((o) => o.id !== m.id && o.name.trim());
              const partner = m.groupId ? members.find((o) => o.id !== m.id && o.groupId === m.groupId) : null;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <input type="radio" name="me" title="This is me" checked={effectiveMe === m.id} onChange={() => setMeId(m.id)} style={{ accentColor: 'var(--external)', width: 16, height: 16, flexShrink: 0 }} />
                  <input type="text" value={m.name} placeholder="Name" onChange={(e) => setMembers((p) => p.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                    style={{ ...fieldStyle, flex: '1 1 110px', padding: '8px 10px' }} />
                  <select value={partner?.id ?? ''} onChange={(e) => setPaysWith(m.id, e.target.value)} title="Pays with"
                    style={{ ...fieldStyle, flex: '0 1 130px', padding: '8px 8px', fontSize: 12 }}>
                    <option value="">Pays alone</option>
                    {others.map((o) => <option key={o.id} value={o.id}>Pays with {o.name.trim()}</option>)}
                  </select>
                  <button type="button" onClick={() => removeMember(m.id)} aria-label="Remove" disabled={members.length <= 1}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={newName} placeholder="Add names — comma separated" onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(newName); } }}
                style={{ ...fieldStyle, flex: 1, padding: '8px 10px' }} />
              <button type="button" onClick={() => addMember(newName)} style={{ padding: '0 12px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </Field>
      </ModalShell>
    </>
  );
}
