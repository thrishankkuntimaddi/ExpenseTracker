// ─── useTrips ────────────────────────────────────────────────────
// Live trips + optimistic save/delete. Two kinds, one list:
//   • personal — users/{uid}/trips, a single document; every change
//     (new expense, settlement, close) is one upsert
//   • shared   — shared_trips/{id}, everyone on it sees it live; rows and
//     settlements are separate documents so several people can type at once
// Shared trips come out shaped like personal ones (expenses, settlements,
// meMemberId = whoever this account is on the trip) plus `shared: true`,
// `isOwner`, and the accounts on it.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { subscribeToTrips, upsertTrip, deleteTrip } from '../services/firestore';
import {
  subscribeToSharedTrips, subscribeToSharedTripItems, createSharedTrip, updateSharedTrip,
  saveSharedExpense, deleteSharedExpense, addSharedSettlement, deleteSharedSettlement, deleteSharedTrip,
  joinSharedTrip, linkFriendToTrip, unlinkAccount,
} from '../services/sharedTrips';
import { generateId } from '../utils/storage';
import { background } from '../services/sync';
import { displayNameOf } from '../app/shellContext';

// Fields of a shared trip only its creator writes
const META = ['name', 'startDate', 'endDate', 'currency', 'status', 'members', 'closedAt', 'archivedFrom', 'postedEntryIds'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function useTrips(user, reportError) {
  const uid = user?.uid;
  const [personal, setPersonal] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [items, setItems] = useState({});   // tripId → { expenses, settlements }
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = subscribeToTrips(uid, (t) => { setPersonal(t); setLoaded(true); });
    const unsubShared = subscribeToSharedTrips(uid, setSharedDocs);
    return () => { unsub(); unsubShared(); setLoaded(false); };
  }, [uid]);

  // One live listener per shared trip for its rows and settlements
  const listeners = useRef(new Map());
  useEffect(() => {
    const ids = new Set(sharedDocs.map((t) => t.id));
    listeners.current.forEach((unsub, id) => { if (!ids.has(id)) { unsub(); listeners.current.delete(id); } });
    ids.forEach((id) => {
      if (listeners.current.has(id)) return;
      listeners.current.set(id, subscribeToSharedTripItems(id, (data) => setItems((p) => ({ ...p, [id]: data }))));
    });
  }, [sharedDocs]);
  useEffect(() => () => { listeners.current.forEach((u) => u()); listeners.current.clear(); }, []);

  const shared = useMemo(() => sharedDocs.map((t) => ({
    ...t,
    shared: true,
    isOwner: t.ownerUid === uid,
    meMemberId: t.uidMember?.[uid],
    expenses: items[t.id]?.expenses ?? [],
    settlements: items[t.id]?.settlements ?? [],
    itemsLoaded: !!items[t.id],
  })), [sharedDocs, items, uid]);

  const trips = useMemo(() => [...shared, ...personal]
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')), [shared, personal]);

  const me = useMemo(() => ({ uid, name: displayNameOf(user), photo: user?.photoURL || '' }), [uid, user]);

  /* Personal: the whole trip in one write. Shared: only the trip's own fields
     (rows and settlements go through `ops`), and only for its creator. */
  const saveTrip = useCallback(async (trip) => {
    if (!uid) return null;
    if (trip.shared) {
      const current = sharedDocs.find((t) => t.id === trip.id);
      if (!current || current.ownerUid !== uid) return trip;
      const patch = {};
      META.forEach((k) => { if (!same(trip[k], current[k])) patch[k] = trip[k]; });
      // "This is me" on a shared trip is the creator's own account
      if (trip.meMemberId && trip.meMemberId !== current.uidMember?.[uid]) patch[`uidMember.${uid}`] = trip.meMemberId;
      if (!Object.keys(patch).length) return trip;
      setSharedDocs((p) => p.map((t) => (t.id === trip.id ? { ...t, ...Object.fromEntries(Object.entries(patch).filter(([k]) => !k.includes('.'))) } : t)));
      background(updateSharedTrip(trip.id, patch), (err) => reportError?.('save the trip', err));
      return trip;
    }
    const full = {
      status: 'open', members: [], expenses: [], settlements: [], createdAt: new Date().toISOString(),
      ...trip, id: trip.id || generateId(),
    };
    setPersonal((prev) => {
      const i = prev.findIndex((t) => t.id === full.id);
      return i === -1 ? [full, ...prev] : prev.map((t) => (t.id === full.id ? full : t));
    });
    background(upsertTrip(uid, full), (err) => reportError?.('save the trip', err));
    return full;
  }, [uid, sharedDocs, reportError]);

  const removeTrip = useCallback(async (id) => {
    if (!uid) return false;
    const sharedTrip = sharedDocs.find((t) => t.id === id);
    if (sharedTrip) {
      if (sharedTrip.ownerUid !== uid) return false;
      const prev = sharedDocs;
      setSharedDocs((p) => p.filter((t) => t.id !== id));
      background(deleteSharedTrip(id), (err) => { reportError?.('delete the trip', err); setSharedDocs(prev); });
      return true;
    }
    const prev = personal;
    setPersonal((p) => p.filter((t) => t.id !== id));
    background(deleteTrip(uid, id), (err) => { reportError?.('delete the trip', err); setPersonal(prev); });
    return true;
  }, [uid, personal, sharedDocs, reportError]);

  /* Row and settlement writes for a shared trip — one document each */
  const opsFor = useCallback((tripId) => ({
    saveRows: (upserts, deletes) => {
      setItems((p) => {
        const cur = p[tripId] ?? { expenses: [], settlements: [] };
        const gone = new Set(deletes);
        const byId = new Map(cur.expenses.filter((e) => !gone.has(e.id)).map((e) => [e.id, e]));
        upserts.forEach((r) => byId.set(r.id, { ...byId.get(r.id), ...r }));
        return { ...p, [tripId]: { ...cur, expenses: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) } };
      });
      upserts.forEach((r) => background(saveSharedExpense(tripId, r, uid), (err) => reportError?.('save the row', err)));
      deletes.forEach((id) => background(deleteSharedExpense(tripId, id), (err) => reportError?.('remove the row', err)));
    },
    addSettlement: (s) => background(addSharedSettlement(tripId, s, uid), (err) => reportError?.('mark the payment', err)),
    removeSettlement: (id) => background(deleteSharedSettlement(tripId, id), (err) => reportError?.('undo the payment', err)),
  }), [uid, reportError]);

  /** Personal → shared: returns the new trip id. */
  const shareTrip = useCallback(async (trip) => {
    const id = await createSharedTrip(trip, me);
    await deleteTrip(uid, trip.id);
    return id;
  }, [me, uid]);

  const join = useCallback((tripId, claim) => joinSharedTrip(tripId, me, claim), [me]);
  const linkFriend = useCallback((tripId, friend, memberId, members) => linkFriendToTrip(tripId, friend, memberId, members), []);
  const unlink = useCallback((trip, accountUid) => unlinkAccount(trip.id, accountUid, trip.memberUids ?? []), []);

  /** People from my other shared trips — one tap to add them to a new one. */
  const friends = useMemo(() => {
    const seen = new Map();
    sharedDocs.forEach((t) => Object.entries(t.people ?? {}).forEach(([fid, p]) => {
      if (fid !== uid && p?.name && !seen.has(fid)) seen.set(fid, { uid: fid, name: p.name, photo: p.photo });
    }));
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sharedDocs, uid]);

  return { trips, loaded, saveTrip, removeTrip, opsFor, shareTrip, join, linkFriend, unlink, friends, me };
}
