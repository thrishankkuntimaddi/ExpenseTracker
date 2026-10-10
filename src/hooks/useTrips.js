// ─── useTrips ────────────────────────────────────────────────────
// Live trips + optimistic save/delete. A trip is a single document, so
// every change (new expense, settlement, close) is one upsert.
import { useState, useEffect, useCallback } from 'react';
import { subscribeToTrips, upsertTrip, deleteTrip } from '../services/firestore';
import { generateId } from '../utils/storage';
import { background } from '../services/sync';

export function useTrips(uid, reportError) {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = subscribeToTrips(uid, (t) => { setTrips(t); setLoaded(true); });
    return () => { unsub(); setLoaded(false); };
  }, [uid]);

  const saveTrip = useCallback(async (trip) => {
    if (!uid) return null;
    const full = {
      status: 'open', members: [], expenses: [], settlements: [], createdAt: new Date().toISOString(),
      ...trip, id: trip.id || generateId(),
    };
    setTrips((prev) => {
      const i = prev.findIndex((t) => t.id === full.id);
      return i === -1 ? [full, ...prev] : prev.map((t) => (t.id === full.id ? full : t));
    });
    background(upsertTrip(uid, full), (err) => reportError?.('save the trip', err));
    return full;
  }, [uid, reportError]);

  const removeTrip = useCallback(async (id) => {
    if (!uid) return false;
    const prev = trips;
    setTrips((p) => p.filter((t) => t.id !== id));
    background(deleteTrip(uid, id), (err) => { reportError?.('delete the trip', err); setTrips(prev); });
    return true;
  }, [uid, trips, reportError]);

  return { trips, loaded, saveTrip, removeTrip };
}
