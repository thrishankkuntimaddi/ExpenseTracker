// ─── Shared trips ─────────────────────────────────────────────────
// A trip several accounts work on together lives outside any one user:
//
//   shared_trips/{tripId}                 the trip: name, dates, people, wallets,
//                                         status — only its creator changes it
//     ├─ expenses/{expenseId}             one row of the sheet — written by the
//     │                                   person who paid (or their wallet
//     │                                   partner), or the creator
//     └─ settlements/{settlementId}       "Muza paid Preetham ₹1,000" — marked by
//                                         either side, or the creator
//
// The trip document also carries who is who:
//   ownerUid, memberUids[] (for "trips I'm in"), uidMember{uid: memberId},
//   memberUnit{memberId: unitId} (wallets, mirrored for the security rules),
//   people{uid: {name, photo}} (names and photos of the accounts on it).
//
// The trip id is long and random: the invite link carries it, and only
// someone holding the link can read the trip before joining.
import {
  doc, collection, deleteDoc, onSnapshot, query, where, serverTimestamp, setDoc,
  updateDoc, getDoc, getDocs, writeBatch, runTransaction, deleteField, arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { noteSnapshot, reportListenError } from "./sync";
import { unitIdOf } from "../utils/split";
import { generateId } from "../utils/storage";

export const SHARED_TRIPS = "shared_trips";
const tripRef    = (id)          => doc(db, SHARED_TRIPS, id);
const expRef     = (tripId, id)  => doc(db, SHARED_TRIPS, tripId, "expenses", id);
const setlRef    = (tripId, id)  => doc(db, SHARED_TRIPS, tripId, "settlements", id);
const expsRef    = (tripId)      => collection(db, SHARED_TRIPS, tripId, "expenses");
const setlsRef   = (tripId)      => collection(db, SHARED_TRIPS, tripId, "settlements");

/** 20 random characters — the invite link is the key to the trip. */
export function newSharedTripId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/* Firestore rejects undefined values */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** The wallet map the security rules check edits against. */
export function memberUnitMap(members = []) {
  return Object.fromEntries(members.map((m) => [m.id, unitIdOf(m)]));
}

function listen(target, what, onSnap) {
  try {
    return onSnapshot(target, (snap) => { noteSnapshot(snap.metadata); onSnap(snap); }, (err) => reportListenError(err, what));
  } catch (err) {
    reportListenError(err, what);
    return () => {};
  }
}

/** Trips this account is on (created or joined). */
export function subscribeToSharedTrips(uid, onData) {
  return listen(
    query(collection(db, SHARED_TRIPS), where("memberUids", "array-contains", uid)),
    "shared trips",
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/* A row listener can start a moment before the server has the trip (just
   shared, just joined) and be refused; try again a few times before
   reporting it. */
function listenWithRetry(target, what, onSnap) {
  let unsub = () => {}, timer = null, tries = 0, stopped = false;
  const start = () => {
    unsub = onSnapshot(target, (snap) => { tries = 0; noteSnapshot(snap.metadata); onSnap(snap); }, (err) => {
      if (stopped) return;
      if (err?.code === "permission-denied" && tries < 6) { tries += 1; timer = setTimeout(start, 800 * tries); return; }
      reportListenError(err, what);
    });
  };
  try { start(); } catch (err) { reportListenError(err, what); }
  return () => { stopped = true; clearTimeout(timer); unsub(); };
}

/** A trip's rows and settlements, live. Rows keep the order they were added in. */
export function subscribeToSharedTripItems(tripId, onData) {
  let expenses = null, settlements = null;
  const emit = () => { if (expenses && settlements) onData({ expenses, settlements }); };
  const byId = (a, b) => a.id.localeCompare(b.id);
  const u1 = listenWithRetry(expsRef(tripId), "trip expenses", (snap) => {
    expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byId);
    emit();
  });
  const u2 = listenWithRetry(setlsRef(tripId), "trip settlements", (snap) => {
    settlements = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byId);
    emit();
  });
  return () => { u1(); u2(); };
}

/** Read one trip before joining (the link is enough to read it). */
export async function getSharedTrip(id) {
  const snap = await getDoc(tripRef(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

const EXPENSE_FIELDS = ["title", "amount", "paidBy", "splitAmong", "date", "category"];
function expenseDoc(row, uid) {
  const out = {};
  EXPENSE_FIELDS.forEach((k) => { if (row[k] !== undefined) out[k] = row[k]; });
  out.title = String(out.title ?? "").slice(0, 200);
  out.amount = out.amount === "" || out.amount == null || !Number.isFinite(Number(out.amount)) ? null : Math.round(Number(out.amount) * 100) / 100;
  out.paidBy = out.paidBy || "";
  return { ...out, by: uid, updatedAt: serverTimestamp() };
}

/**
 * Turn a personal trip into a shared one: the trip moves to shared_trips
 * with every row and settlement, then the personal copy is removed.
 */
export async function createSharedTrip(trip, owner) {
  const id = newSharedTripId();
  const { expenses = [], settlements = [], id: _oldId, shared: _s, ...meta } = trip;
  const members = meta.members ?? [];
  const data = clean({
    ...meta,
    members,
    ownerUid: owner.uid,
    ownerName: owner.name,
    memberUids: [owner.uid],
    uidMember: { [owner.uid]: meta.meMemberId },
    people: { [owner.uid]: clean({ name: owner.name, photo: owner.photo || undefined }) },
    memberUnit: memberUnitMap(members),
    meMemberId: undefined,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  // The trip document first: the rules for its rows read it
  await setDoc(tripRef(id), data);
  const ops = [
    ...expenses.filter((e) => String(e.title ?? "").trim() || (e.amount !== "" && e.amount != null))
      .map((e) => (b) => b.set(expRef(id, e.id), expenseDoc(e, owner.uid))),
    ...settlements.map((s) => (b) => b.set(setlRef(id, s.id), clean({ ...s, id: undefined, by: owner.uid }))),
  ];
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
  return id;
}

/** Creator only: name, dates, people, wallets, status. */
export async function updateSharedTrip(id, patch) {
  const out = { ...patch, updatedAt: serverTimestamp() };
  if (patch.members) out.memberUnit = memberUnitMap(patch.members);
  Object.keys(out).forEach((k) => { if (out[k] === undefined) out[k] = deleteField(); });
  await updateDoc(tripRef(id), out);
}

export async function saveSharedExpense(tripId, row, uid) {
  await setDoc(expRef(tripId, row.id), expenseDoc(row, uid));
}
export async function deleteSharedExpense(tripId, id) {
  await deleteDoc(expRef(tripId, id));
}
export async function addSharedSettlement(tripId, s, uid) {
  const { id, ...rest } = s;
  await setDoc(setlRef(tripId, id), clean({ ...rest, by: uid }));
}
export async function deleteSharedSettlement(tripId, id) {
  await deleteDoc(setlRef(tripId, id));
}

/** Creator only: rows and settlements go first, then the trip. */
export async function deleteSharedTrip(id) {
  const [e, s] = await Promise.all([getDocs(expsRef(id)), getDocs(setlsRef(id))]);
  const refs = [...e.docs, ...s.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(tripRef(id));
}

/**
 * Join with the link: claim one of the trip's people ("I'm Muza") or come in
 * as someone new. Returns the member id this account now is.
 *   claim: { memberId } | { name }
 */
export async function joinSharedTrip(tripId, user, claim) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(tripRef(tripId));
    if (!snap.exists()) throw new Error("This trip no longer exists.");
    const t = snap.data();
    if (t.uidMember?.[user.uid]) return t.uidMember[user.uid];
    if (t.status !== "open") throw new Error("This trip is closed — ask its creator to reopen it.");
    const taken = new Set(Object.values(t.uidMember ?? {}));
    let members = t.members ?? [];
    let memberId = claim.memberId;
    if (memberId) {
      if (!members.some((m) => m.id === memberId)) throw new Error("That person is no longer on the trip.");
      if (taken.has(memberId)) throw new Error("Someone else already joined as that person.");
    } else {
      const name = String(claim.name ?? "").trim() || user.name;
      memberId = generateId();
      members = [...members, { id: memberId, name }];
    }
    tx.update(tripRef(tripId), {
      members,
      memberUids: [...(t.memberUids ?? []), user.uid],
      [`uidMember.${user.uid}`]: memberId,
      [`people.${user.uid}`]: clean({ name: user.name, photo: user.photo || undefined }),
      updatedAt: serverTimestamp(),
    });
    return memberId;
  });
}

/** Creator only: put a friend's account on the trip as one of its people. */
export async function linkFriendToTrip(tripId, friend, memberId, members) {
  await updateDoc(tripRef(tripId), clean({
    members,
    memberUnit: memberUnitMap(members),
    memberUids: arrayUnion(friend.uid),
    [`uidMember.${friend.uid}`]: memberId,
    [`people.${friend.uid}`]: clean({ name: friend.name, photo: friend.photo || undefined }),
    updatedAt: serverTimestamp(),
  }));
}

/** Creator only: take an account off the trip (its person and rows stay). */
export async function unlinkAccount(tripId, uid, memberUids) {
  await updateDoc(tripRef(tripId), {
    memberUids: memberUids.filter((u) => u !== uid),
    [`uidMember.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
