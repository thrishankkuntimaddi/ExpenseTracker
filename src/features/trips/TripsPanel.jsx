// ─── TripsPanel ───────────────────────────────────────────────────
// Group expense splitting ("Trips") inside Billings: list → detail.
import { useMemo, useState } from 'react';
import { Plus, Map, ArrowLeft, Lock, ChevronRight } from 'lucide-react';
import { useTrips } from '../../hooks/useTrips';
import { computeTripSummary } from '../../utils/split';
import { formatAmount, formatDateShort, dateInputToISO, isoToMonth, todayInputValue } from '../../utils/dateHelpers';
import { toKey } from '../../utils/recurring';
import TripModal from './TripModal';
import TripDetail from './TripDetail';
import TripCloseModal from './TripCloseModal';
import TripShareModal from './TripShareModal';

export default function TripsPanel({ user, onAddTransaction, onDeleteTransaction, reportError, headerExtra }) {
  const { trips, saveTrip, removeTrip } = useTrips(user?.uid, reportError);
  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null);       // 'new' | 'edit' | 'close' | 'share' | null
  const [showClosed, setShowClosed] = useState(false);

  const active = useMemo(() => trips.find((t) => t.id === activeId) ?? null, [trips, activeId]);
  const open = trips.filter((t) => t.status !== 'closed');
  const closed = trips.filter((t) => t.status === 'closed');

  async function closeTrip({ logShare, logLent, logBorrowed }) {
    const s = computeTripSummary(active);
    const dateKey = active.endDate && active.endDate <= todayInputValue() ? active.endDate : (active.startDate || todayInputValue());
    const date = dateInputToISO(dateKey), month = isoToMonth(date);
    const posted = [];
    const post = async (entry) => { if (await onAddTransaction?.(entry)) posted.push(entry.id); };
    if (logShare && s.myShare > 0) {
      await post({ id: `trip_${active.id}_share`, name: `Trip: ${active.name}`, amount: s.myShare, type: 'expense', category: 'travel', date, month, tripId: active.id });
    }
    if (logLent) for (const t of s.owedToMe) {
      await post({ id: `trip_${active.id}_lent_${t.from}`, name: t.fromName, amount: t.amount, type: 'person', direction: 'lent', note: `Trip: ${active.name}`, date, month, tripId: active.id });
    }
    if (logBorrowed) for (const t of s.iOwe) {
      await post({ id: `trip_${active.id}_borrowed_${t.to}`, name: t.toName, amount: t.amount, type: 'person', direction: 'borrowed', note: `Trip: ${active.name}`, date, month, tripId: active.id });
    }
    await saveTrip({ ...active, status: 'closed', closedAt: toKey(new Date()), postedEntryIds: posted });
    setModal(null);
  }

  async function reopenTrip() {
    for (const id of active.postedEntryIds ?? []) await onDeleteTransaction?.(id);
    await saveTrip({ ...active, status: 'open', closedAt: undefined, postedEntryIds: [] });
  }

  const header = (
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
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{active ? `${active.members?.length ?? 0} people` : 'Shared spending, settled fairly'}</p>
          </div>
        </div>
        {!active && (
          <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'var(--external-bg)', color: 'var(--external)', border: '1px solid var(--external-border)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <Plus size={13} /> New Trip
          </button>
        )}
      </div>
      {headerExtra}
    </div>
  );

  return (
    <div className="tab-root">
      {modal === 'new' && <TripModal onSave={async (t) => { const saved = await saveTrip(t); if (saved) setActiveId(saved.id); }} onClose={() => setModal(null)} />}
      {modal === 'edit' && active && <TripModal trip={active} onSave={saveTrip} onDelete={(id) => { removeTrip(id); setActiveId(null); }} onClose={() => setModal(null)} />}
      {modal === 'close' && active && <TripCloseModal trip={active} summary={computeTripSummary(active)} onConfirm={closeTrip} onClose={() => setModal(null)} />}
      {modal === 'share' && active && <TripShareModal trip={active} onClose={() => setModal(null)} />}

      {header}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
        {active ? (
          <TripDetail trip={active} onChange={saveTrip} onEdit={() => setModal('edit')} onShare={() => setModal('share')} onClose={() => setModal('close')} onReopen={reopenTrip} />
        ) : trips.length === 0 ? (
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Map size={24} style={{ color: 'var(--external)' }} /></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No trips yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 320 }}>
              Road trip, weekend away, a shared dinner. Add the people, log who paid for what, and get a fair "who pays whom" plan — couples can pay as one wallet.
            </div>
            <button onClick={() => setModal('new')} style={{ marginTop: 4, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--external)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Start a trip</button>
          </div>
        ) : (
          <>
            <TripList title={`Open · ${open.length}`} trips={open} onOpen={setActiveId} empty="No open trips." />
            {closed.length > 0 && (
              <>
                <button onClick={() => setShowClosed((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 14, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={12} /> Closed · {closed.length}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showClosed ? 'hide' : 'show'}</span>
                </button>
                {showClosed && <TripList trips={closed} onOpen={setActiveId} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TripList({ title, trips, onOpen, empty }) {
  return (
    <div>
      {title && <p className="section-label" style={{ marginBottom: 8 }}>{title}</p>}
      {trips.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 2px' }}>{empty}</div> : (
        <div className="card">
          {trips.map((t, i) => {
            const s = computeTripSummary(t);
            return (
              <button key={t.id} onClick={() => onOpen(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: i < trips.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--external-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Map size={16} style={{ color: 'var(--external)' }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t.members?.length ?? 0} people · {s.count} expense{s.count === 1 ? '' : 's'}{t.startDate ? ` · ${formatDateShort(t.startDate)}` : ''}
                    {s.count > 0 && <> · <span style={{ color: s.isSettled ? 'var(--income)' : 'var(--expense)', fontWeight: 600 }}>{s.isSettled ? 'settled' : `${formatAmount(s.outstanding)} to settle`}</span></>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatAmount(s.total)}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
