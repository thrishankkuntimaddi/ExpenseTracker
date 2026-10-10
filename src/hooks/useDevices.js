// ─── useDevices ──────────────────────────────────────────────────
// "Your devices" in Settings. Each install has a random id (localStorage);
// while the app is visible it writes lastSeen every few minutes, so other
// devices can show it as "open now".
import { useEffect, useState, useCallback } from 'react';
import { subscribeToDevices, touchDevice, removeDevice } from '../services/firestore';
import { background } from '../services/sync';
import { generateId } from '../utils/storage';

export const DEVICE_ID_KEY = 'et_device_id';
const HEARTBEAT_MS = 4 * 60 * 1000;
export const OPEN_NOW_MS = 6 * 60 * 1000;   // a heartbeat plus slack

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = generateId(); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch { return 'unknown-device'; }
}

/** "Chrome on macOS", "Safari on iPhone", … from the user agent. */
export function describeDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

export function useDevices(uid) {
  const [devices, setDevices] = useState([]);
  const thisId = getDeviceId();

  useEffect(() => (uid ? subscribeToDevices(uid, setDevices) : undefined), [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      background(touchDevice(uid, thisId, { name: describeDevice(), kind: standalone ? 'installed web app' : 'browser' }));
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', beat); };
  }, [uid, thisId]);

  const remove = useCallback((id) => { if (uid) background(removeDevice(uid, id)); }, [uid]);

  return { devices, thisId, remove };
}
