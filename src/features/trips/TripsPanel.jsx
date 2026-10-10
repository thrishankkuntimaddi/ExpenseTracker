// ─── TripsPanel ───────────────────────────────────────────────────
// Group expense splitting ("Trips & Splits") inside Billings. Same shape as
// the billing sessions: active list → history → archived, each with
// share / edit / archive / delete, and a detail workspace.
import { useMemo, useState } from 'react';
import { Plus, ArrowLeft, Unlock } from 'lucide-react';
import { useTrips } from '../../hooks/useTrips';
import { computeTripSummary } from '../../utils/split';
import { dateInputToISO, isoToMonth, todayInputValue } from '../../utils/dateHelpers';
import { toKey } from '../../utils/recurring';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import TripModal from './TripModal';
import TripDetail from './TripDetail';
import TripCloseModal from './TripCloseModal';
import TripShareModal from './TripShareModal';
import TripsList from './components/TripsList';

export default function TripsPanel({ user, onAddTransaction, onDeleteTransaction, reportError, headerExtra }) {
  const { trips, saveTrip, removeTrip } = useTrips(user?.uid, reportError);
  const [activeId, setActiveId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [sharingTrip, setSharingTrip] = useState(null);
  const [closingTrip, setClosingTrip] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [reopening, setReopening] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = useMemo(() => trips.find((t) => t.id === activeId) ?? null, [trips, activeId]);
  const activeTrips   = trips.filter((t) => t.status !== 'closed' && t.status !== 'archived');
  const closedTrips   = trips.filter((t) => t.status === 'closed');
  const archivedTrips = trips.filter((t) => t.status === 'archived');

  async function deleteTripById(id) { await removeTrip(id); if (activeId === id) setActiveId(null); }
  const archiveTrip   = (t) => saveTrip({ ...t, status: 'archived', archivedFrom: t.status ?? 'open' });
  const unarchiveTrip = (t) => saveTrip({ ...t, status: t.archivedFrom === 'closed' || t.closedAt ? 'closed' : 'open', archivedFrom: undefined });

  async function closeTrip(trip, { logShare, logLent, logBorrowed }) {
    const s = computeTripSummary(trip);
    const dateKey = trip.endDate && trip.endDate <= todayInputValue() ? trip.endDate : (trip.startDate || todayInputValue());
    const date = dateInputToISO(dateKey), month = isoToMonth(date);
    const posted = [];
    const post = async (entry) => { if (await onAddTransaction?.(entry)) posted.push(entry.id); };
    if (logShare && s.myShare > 0) {
      await post({ id: `trip_${trip.id}_share`, name: `Trip: ${trip.name}`, amount: s.myShare, type: 'expense', category: 'travel', date, month, tripId: trip.id });
    }
    if (logLent) for (const t of s.owedToMe) {
      await post({ id: `trip_${trip.id}_lent_${t.from}`, name: t.fromName, amount: t.amount, type: 'person', direction: 'lent', note: `Trip: ${trip.name}`, date, month, tripId: trip.id });
    }
    if (logBorrowed) for (const t of s.iOwe) {
      await post({ id: `trip_${trip.id}_borrowed_${t.to}`, name: t.toName, amount: t.amount, type: 'person', direction: 'borrowed', note: `Trip: ${trip.name}`, date, month, tripId: trip.id });
    }
    await saveTrip({ ...trip, status: 'closed', closedAt: toKey(new Date()), postedEntryIds: posted });
    setClosingTrip(null);
  }

  async function reopenTrip(trip) {
    for (const id of trip.postedEntryIds ?? []) await onDeleteTransaction?.(id);
    await saveTrip({ ...trip, status: 'open', closedAt: undefined, postedEntryIds: [] });
  }

  return (
    <div className="tab-root">
      {newOpen && <TripModal onSave={async (t) => { const saved = await saveTrip(t); if (saved) setActiveId(saved.id); }} onClose={() => setNewOpen(false)} />}
      {editingTrip && <TripModal trip={editingTrip} onSave={saveTrip} onDelete={deleteTripById} onClose={() => setEditingTrip(null)} />}
      {closingTrip && <TripCloseModal trip={closingTrip} summary={computeTripSummary(closingTrip)} onConfirm={(opts) => closeTrip(closingTrip, opts)} onClose={() => setClosingTrip(null)} />}
      {sharingTrip && <TripShareModal trip={sharingTrip} onClose={() => setSharingTrip(null)} />}
      {reopening && (
        <ConfirmDeleteModal title={`Reopen “${reopening.name}”?`}
          message={(reopening.postedEntryIds?.length ?? 0) > 0
            ? `The ${reopening.postedEntryIds.length} ${reopening.postedEntryIds.length === 1 ? 'entry' : 'entries'} it logged to your ledger move to Recently Deleted. Closing it again logs fresh ones.`
            : 'You can edit its rows again and close it later.'}
          confirmLabel="Reopen" ConfirmIcon={Unlock}
          onConfirm={() => { const t = reopening; setReopening(null); reopenTrip(t); }} onCancel={() => setReopening(null)} />
      )}
      {deletingId && (
        <ConfirmDeleteModal title="Delete this trip?" message="All its rows and settlements are removed. Entries already posted to your ledger stay."
          onConfirm={() => { const id = deletingId; setDeletingId(null); deleteTripById(id); }} onCancel={() => setDeletingId(null)} />
      )}

      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: headerExtra ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {active && (
              <button onClick={() => setActiveId(null)} aria-label="Back" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active ? active.name : 'Trips & Splits'}</h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{active ? `${active.members?.length ?? 0} people · ${active.status === 'closed' ? 'closed' : active.status === 'archived' ? 'archived' : 'open'}` : 'Shared spending, settled fairly'}</p>
            </div>
          </div>
          {!active && (
            <button onClick={() => setNewOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              <Plus size={13} /> New
            </button>
          )}
        </div>
        {headerExtra}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
        {active ? (
          <TripDetail
            trip={active} onChange={saveTrip}
            onEdit={() => setEditingTrip(active)} onShare={() => setSharingTrip(active)}
            onClose={() => setClosingTrip(active)} onReopen={() => setReopening(active)} onDelete={deleteTripById}
          />
        ) : (
          <TripsList
            activeTrips={activeTrips} closedTrips={closedTrips} archivedTrips={archivedTrips}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showArchived={showArchived} setShowArchived={setShowArchived}
            onOpen={setActiveId} onShare={setSharingTrip} onEdit={setEditingTrip} onDelete={setDeletingId}
            onArchive={archiveTrip} onUnarchive={unarchiveTrip} onNew={() => setNewOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
