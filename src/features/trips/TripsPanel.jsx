// ─── TripsPanel ───────────────────────────────────────────────────
// Group expense splitting ("Trips & Splits"). An overview (active trips,
// history, archived) and a detail workspace per trip.
// Trips are personal until their creator invites friends; then everyone on
// the trip sees it live, adds their own spending and marks payments.
import { useEffect, useMemo, useState } from 'react';
import { Plus, ArrowLeft, Unlock, LogIn } from 'lucide-react';
import { useTrips } from '../../hooks/useTrips';
import { computeTripSummary } from '../../utils/split';
import { dateInputToISO, isoToMonth, todayInputValue } from '../../utils/dateHelpers';
import { toKey } from '../../utils/recurring';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import TripModal from './TripModal';
import TripDetail from './TripDetail';
import TripCloseModal from './TripCloseModal';
import TripShareModal from './TripShareModal';
import TripInviteModal from './TripInviteModal';
import JoinTripModal from './JoinTripModal';
import TripsList from './components/TripsList';
import BackButton from '../../components/BackButton';
import ProfileButton from '../../components/ProfileButton';
import HelpButton from '../../tour/HelpButton';
import { pendingInvite, clearPendingInvite, parseInvite } from './invite';

export default function TripsPanel({ user, onAddTransaction, onDeleteTransaction, reportError, headerExtra }) {
  const { trips, saveTrip, removeTrip, opsFor, shareTrip, join, linkFriend, friends, me } = useTrips(user, reportError);
  const [activeId, setActiveId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [sharingTrip, setSharingTrip] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [closingTrip, setClosingTrip] = useState(null);
  const [loggingTrip, setLoggingTrip] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [reopening, setReopening] = useState(null);
  const [showHistory, setShowHistory] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  // An invite link opened this app (or one was pasted): "which one are you?"
  const [joinId, setJoinId] = useState(() => pendingInvite());
  const [askCode, setAskCode] = useState(false);
  useEffect(() => { if (joinId) clearPendingInvite(); }, [joinId]);

  const active = useMemo(() => trips.find((t) => t.id === activeId) ?? null, [trips, activeId]);
  const inviting = useMemo(() => trips.find((t) => t.id === invitingId) ?? null, [trips, invitingId]);
  const activeTrips   = trips.filter((t) => t.status !== 'closed' && t.status !== 'archived');
  const closedTrips   = trips.filter((t) => t.status === 'closed');
  const archivedTrips = trips.filter((t) => t.status === 'archived');

  async function deleteTripById(id) { await removeTrip(id); if (activeId === id) setActiveId(null); }
  const archiveTrip   = (t) => saveTrip({ ...t, status: 'archived', archivedFrom: t.status ?? 'open' });
  const unarchiveTrip = (t) => saveTrip({ ...t, status: t.archivedFrom === 'closed' || t.closedAt ? 'closed' : 'open', archivedFrom: undefined });

  /** My part of the trip into my own ledger (deterministic ids: repeating never doubles). */
  async function postToLedger(trip, { logShare, logLent, logBorrowed }) {
    const s = computeTripSummary(trip);
    const dateKey = trip.endDate && trip.endDate <= todayInputValue() ? trip.endDate : (trip.startDate || todayInputValue());
    const date = dateInputToISO(dateKey), month = isoToMonth(date);
    const posted = [];
    // Ledger entries keep the trip's currency (converted for totals at the trip's date)
    const post = async (entry) => { if (await onAddTransaction?.({ ...entry, ...(trip.currency ? { currency: trip.currency } : {}) })) posted.push(entry.id); };
    if (logShare && s.myShare > 0) {
      await post({ id: `trip_${trip.id}_share`, name: `Trip: ${trip.name}`, amount: s.myShare, type: 'expense', category: 'travel', date, month, tripId: trip.id });
    }
    if (logLent) for (const t of s.owedToMe) {
      await post({ id: `trip_${trip.id}_lent_${t.from}`, name: t.fromName, amount: t.amount, type: 'person', direction: 'lent', note: `Trip: ${trip.name}`, date, month, tripId: trip.id });
    }
    if (logBorrowed) for (const t of s.iOwe) {
      await post({ id: `trip_${trip.id}_borrowed_${t.to}`, name: t.toName, amount: t.amount, type: 'person', direction: 'borrowed', note: `Trip: ${trip.name}`, date, month, tripId: trip.id });
    }
    return posted;
  }

  async function closeTrip(trip, opts) {
    const posted = await postToLedger(trip, opts);
    await saveTrip({ ...trip, status: 'closed', closedAt: toKey(new Date()), postedEntryIds: posted });
    setClosingTrip(null);
  }

  async function reopenTrip(trip) {
    for (const id of trip.postedEntryIds ?? []) await onDeleteTransaction?.(id);
    await saveTrip({ ...trip, status: 'open', closedAt: undefined, postedEntryIds: [] });
  }

  async function makeShared(trip) {
    const id = await shareTrip(trip);
    if (activeId === trip.id) setActiveId(id);
    setInvitingId(id);
  }

  const canManage = (t) => !t.shared || t.isOwner;
  const subtitle = (t) => {
    const status = t.status === 'closed' ? 'closed' : t.status === 'archived' ? 'archived' : 'open';
    const joined = Object.keys(t.uidMember ?? {}).length;
    return t.shared
      ? `${t.members?.length ?? 0} people · ${joined} joined · ${status}${t.isOwner ? '' : ` · by ${t.ownerName ?? 'a friend'}`}`
      : `${t.members?.length ?? 0} people · ${status}`;
  };

  return (
    <div className="tab-root">
      {newOpen && <TripModal onSave={async (t) => { const saved = await saveTrip(t); if (saved) setActiveId(saved.id); }} onClose={() => setNewOpen(false)} />}
      {editingTrip && <TripModal trip={editingTrip} onSave={saveTrip} onDelete={deleteTripById} onClose={() => setEditingTrip(null)} />}
      {closingTrip && <TripCloseModal trip={closingTrip} summary={computeTripSummary(closingTrip)} onConfirm={(opts) => closeTrip(closingTrip, opts)} onClose={() => setClosingTrip(null)} />}
      {loggingTrip && <TripCloseModal mode="member" trip={loggingTrip} summary={computeTripSummary(loggingTrip)} onConfirm={async (opts) => { await postToLedger(loggingTrip, opts); setLoggingTrip(null); }} onClose={() => setLoggingTrip(null)} />}
      {sharingTrip && <TripShareModal trip={sharingTrip} onClose={() => setSharingTrip(null)} />}
      {inviting && <TripInviteModal trip={inviting} friends={friends} onMakeShared={makeShared} onLinkFriend={(t, f, mid, members) => linkFriend(t.id, f, mid, members).catch((err) => reportError?.('add your friend', err))} onClose={() => setInvitingId(null)} />}
      {joinId && <JoinTripModal tripId={joinId} me={me} onJoin={join} onOpen={(id) => { setJoinId(null); setActiveId(id); }} onClose={() => setJoinId(null)} />}
      {askCode && <JoinCodeModal onJoin={(id) => { setAskCode(false); setJoinId(id); }} onClose={() => setAskCode(false)} />}
      {reopening && (
        <ConfirmDeleteModal title={`Reopen “${reopening.name}”?`}
          message={(reopening.postedEntryIds?.length ?? 0) > 0
            ? `The ${reopening.postedEntryIds.length} ${reopening.postedEntryIds.length === 1 ? 'entry' : 'entries'} it logged to your ledger move to Recently Deleted. Closing it again logs fresh ones.`
            : reopening.shared ? 'Everyone on the trip can edit their rows again.' : 'You can edit its rows again and close it later.'}
          confirmLabel="Reopen" ConfirmIcon={Unlock}
          onConfirm={() => { const t = reopening; setReopening(null); reopenTrip(t); }} onCancel={() => setReopening(null)} />
      )}
      {deletingId && (
        <ConfirmDeleteModal title="Delete this trip?" message={trips.find((t) => t.id === deletingId)?.shared ? 'It disappears for everyone on it. Entries already posted to ledgers stay.' : 'All its rows and settlements are removed. Entries already posted to your ledger stay.'}
          onConfirm={() => { const id = deletingId; setDeletingId(null); deleteTripById(id); }} onCancel={() => setDeletingId(null)} />
      )}

      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: headerExtra ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {!active && <BackButton />}
            {active && (
              <button onClick={() => setActiveId(null)} aria-label="Back" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active ? active.name : 'Trips & Splits'}</h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{active ? subtitle(active) : 'Shared spending, settled fairly'}</p>
            </div>
          </div>
          {!active && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button id="trip-join" onClick={() => setAskCode(true)} style={headerBtn(false)}><LogIn size={13} /> Join</button>
              <button onClick={() => setNewOpen(true)} style={headerBtn(true)}><Plus size={13} /> New</button>
              <HelpButton page="trips" />
              <ProfileButton />
            </div>
          )}
        </div>
        {headerExtra}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
        {active ? (
          <TripDetail
            key={active.id}
            trip={active} onChange={saveTrip} ops={active.shared ? opsFor(active.id) : null}
            onShare={() => setSharingTrip(active)} onInvite={() => setInvitingId(active.id)}
            onClose={() => setClosingTrip(active)} onReopen={() => setReopening(active)} onDelete={deleteTripById}
            onLogMine={() => setLoggingTrip(active)}
          />
        ) : (
          <TripsList
            trips={trips} activeTrips={activeTrips} closedTrips={closedTrips} archivedTrips={archivedTrips}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showArchived={showArchived} setShowArchived={setShowArchived}
            canManage={canManage}
            onOpen={setActiveId} onShare={setSharingTrip} onEdit={setEditingTrip} onDelete={setDeletingId}
            onArchive={archiveTrip} onUnarchive={unarchiveTrip} onNew={() => setNewOpen(true)} onJoin={() => setAskCode(true)}
          />
        )}
      </div>
    </div>
  );
}

const headerBtn = (primary) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  background: primary ? 'var(--external-bg)' : 'var(--surface2)', color: primary ? 'var(--external)' : 'var(--text-secondary)', border: `1px solid ${primary ? 'var(--external-border)' : 'var(--border)'}`,
});

/* Paste the invite link (or just its code) — for the apps, where a scanned
   link opens the browser instead */
function JoinCodeModal({ onJoin, onClose }) {
  const [text, setText] = useState('');
  const id = parseInvite(text);
  return (
    <ModalShell title="Join a trip" subtitle="Paste the invite link a friend sent you." onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => id && onJoin(id)} disabled={!id} color="var(--external)"><LogIn size={14} /> Continue</PrimaryButton>
      </>}
    >
      <input type="text" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && id) onJoin(id); }}
        placeholder="https://…/ExpenseTracker/?trip=…" aria-label="Invite link or code" style={fieldStyle} />
      <div style={{ fontSize: 11, color: text && !id ? 'var(--expense)' : 'var(--text-muted)' }}>
        {text && !id ? 'That doesn’t look like a trip invite.' : 'Got a QR code instead? Scan it with your phone’s camera — it opens the same page.'}
      </div>
    </ModalShell>
  );
}
