// ─── JoinTripModal ────────────────────────────────────────────────
// Opened from an invite link (or a pasted link / code): shows the trip and
// asks "which one are you?" — a name the creator already typed, or a new
// person. After joining, the trip sits in Trips like any other.
import { useEffect, useState } from 'react';
import { LogIn, Loader2, UserPlus, Crown } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { getSharedTrip } from '../../services/sharedTrips';
import { formatDateShort } from '../../utils/dateHelpers';

export default function JoinTripModal({ tripId, me, onJoin, onOpen, onClose }) {
  const [state, setState] = useState({ loading: true });
  const [pick, setPick] = useState('');
  const [newName, setNewName] = useState(me?.name?.split(/\s+/)[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getSharedTrip(tripId)
      .then((trip) => {
        if (!live) return;
        setState({ trip });
        // Preselect the name that matches this account's first name
        const taken = new Set(Object.values(trip?.uidMember ?? {}));
        const open = (trip?.members ?? []).filter((m) => !taken.has(m.id));
        const first = (me?.name ?? '').trim().split(/\s+/)[0]?.toLowerCase();
        const match = open.find((m) => m.name.trim().toLowerCase() === first);
        setPick(match ? match.id : open.length ? '' : 'new');
      })
      .catch((err) => { if (live) setState({ error: err?.code === 'permission-denied' ? 'This invite isn’t valid any more.' : 'Couldn’t load the trip — check your connection.' }); });
    return () => { live = false; };
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const trip = state.trip;
  const already = trip && me && trip.uidMember?.[me.uid];
  const taken = new Set(Object.values(trip?.uidMember ?? {}));
  const open = (trip?.members ?? []).filter((m) => !taken.has(m.id));
  async function join() {
    setBusy(true); setError('');
    try {
      await onJoin(tripId, pick === 'new' ? { name: newName.trim() || me?.name } : { memberId: pick });
      onOpen(tripId);
    } catch (err) {
      setError(err?.message || 'Couldn’t join — try again.');
      setBusy(false);
    }
  }

  return (
    <ModalShell title={trip ? `Join “${trip.name}”` : 'Join a trip'} subtitle={trip ? 'Add what you spend; everyone sees who owes whom.' : undefined} onClose={onClose}
      footer={trip && !already && trip.status === 'open' ? <>
        <GhostButton onClick={onClose}>Not now</GhostButton>
        <PrimaryButton onClick={join} disabled={busy || !pick || (pick === 'new' && !newName.trim())} color="var(--external)">
          {busy ? <Loader2 size={14} className="spin" /> : <LogIn size={14} />} Join trip
        </PrimaryButton>
      </> : trip && already ? <PrimaryButton onClick={() => onOpen(tripId)} color="var(--external)">Open the trip</PrimaryButton> : null}
    >
      {state.loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}><Loader2 size={14} className="spin" /> Loading the trip…</div>}
      {state.error && <div style={{ fontSize: 13, color: 'var(--expense)' }}>{state.error}</div>}
      {!state.loading && !state.error && !trip && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This trip no longer exists — its creator may have deleted it.</div>}
      {trip && (
        <>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--external-bg)', border: '1px solid var(--external-border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text)' }}><Crown size={12} style={{ color: 'var(--external)' }} /> {trip.ownerName || 'A friend'} invited you</div>
            {trip.startDate ? `${formatDateShort(trip.startDate)}${trip.endDate ? ` – ${formatDateShort(trip.endDate)}` : ''} · ` : ''}{(trip.members ?? []).length} people
          </div>
          {already ? (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>You’re already on this trip.</div>
          ) : trip.status !== 'open' ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This trip is closed. Ask {trip.ownerName || 'its creator'} to reopen it if you need to join.</div>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Which one are you?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {open.map((m) => (
                  <button key={m.id} type="button" onClick={() => setPick(m.id)} className="trip-chip"
                    style={{ padding: '7px 13px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${pick === m.id ? 'var(--external)' : 'var(--border)'}`, background: pick === m.id ? 'var(--external-bg)' : 'var(--surface2)', color: 'var(--text)' }}>
                    {m.name}
                  </button>
                ))}
                <button type="button" onClick={() => setPick('new')} className="trip-chip"
                  style={{ padding: '7px 13px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px dashed ${pick === 'new' ? 'var(--external)' : 'var(--border)'}`, background: pick === 'new' ? 'var(--external-bg)' : 'transparent', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <UserPlus size={13} /> I’m not listed
                </button>
              </div>
              {pick === 'new' && (
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your name on the trip" aria-label="Your name on the trip" style={{ ...fieldStyle, marginTop: 8 }} />
              )}
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: 'var(--expense)' }}>{error}</div>}
        </>
      )}
    </ModalShell>
  );
}
