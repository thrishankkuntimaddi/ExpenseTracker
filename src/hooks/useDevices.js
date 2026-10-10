// ─── useDevices ──────────────────────────────────────────────────
// "Your devices" in Settings. Each install has a random id (localStorage);
// while the app is visible it writes lastSeen every few minutes, so other
// devices can show it as "open now".
import { useEffect, useState, useCallback } from 'react';
import { subscribeToDevices, touchDevice, removeDevice } from '../services/firestore';
import { background } from '../services/sync';
import { generateId } from '../utils/storage';
import { platform } from '../native';

export const DEVICE_ID_KEY = 'et_device_id';
const HEARTBEAT_MS = 4 * 60 * 1000;
export const OPEN_NOW_MS = 6 * 60 * 1000;   // a heartbeat plus slack
export const FORGET_AFTER_MS = 30 * 24 * 3600 * 1000;  // reinstalls / cleared app data leave old ids behind

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = generateId(); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch { return 'unknown-device'; }
}

/** "Chrome on macOS", "Pixel 8 (Android app)", "Desktop app on Windows", … */
export function describeDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', shell = platform) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  if (shell === 'android') {
    const model = /Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?[;)]/.exec(ua)?.[1]?.trim();
    return model && model !== 'K' ? `${model} (Android app)` : 'Android app';
  }
  if (shell === 'desktop') return `Desktop app on ${os}`;
  return `${browser} on ${os}`;
}

export function useDevices(uid) {
  const [devices, setDevices] = useState([]);
  const thisId = getDeviceId();

  useEffect(() => (uid ? subscribeToDevices(uid, setDevices) : undefined), [uid]);

  // Tidy up: a device not seen for 30 days is gone (reinstall, cleared data, old phone)
  useEffect(() => {
    if (!uid) return;
    const now = Date.now();
    devices.filter((d) => d.id !== thisId && d.lastSeen && now - d.lastSeen > FORGET_AFTER_MS)
      .forEach((d) => background(removeDevice(uid, d.id)));
  }, [uid, devices, thisId]);

  useEffect(() => {
    if (!uid) return undefined;
    const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      const kind = platform === 'web' ? (standalone ? 'installed web app' : 'browser') : 'app';
      background(touchDevice(uid, thisId, { name: describeDevice(), kind }));
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', beat); };
  }, [uid, thisId]);

  const remove = useCallback((id) => { if (uid) background(removeDevice(uid, id)); }, [uid]);

  return { devices, thisId, remove };
}
