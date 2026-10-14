// ─── Security events: reading them ───────────────────────────────
import { useEffect, useState } from 'react';
import { subscribeToSecurityEvents } from '../services/firestore';

/** Recent security events for the account. */
export function useSecurityEvents(uid) {
  const [events, setEvents] = useState([]);
  useEffect(() => (uid ? subscribeToSecurityEvents(uid, setEvents) : undefined), [uid]);
  return events;
}

/** Title and detail line for an event. */
export function eventText(e) {
  switch (e?.type) {
    case 'wrong_pins': return { title: `${e.count} wrong PINs`, sub: `on ${e.device}`, bad: true };
    case 'locked_out': return { title: 'App locked after too many wrong PINs', sub: `on ${e.device} — signing in again is needed`, bad: true };
    case 'lock_on': return { title: 'App lock turned on', sub: `on ${e.device}` };
    case 'lock_off': return { title: 'App lock turned off', sub: `on ${e.device}`, bad: true };
    case 'pin_changed': return { title: 'PIN changed', sub: `on ${e.device}` };
    case 'pin_reset_started': return { title: 'PIN reset after signing in again', sub: `on ${e.device}` };
    default: return { title: e?.type ?? 'Event', sub: e?.device ?? '' };
  }
}
