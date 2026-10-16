// ─── useDevices ──────────────────────────────────────────────────
// "Your devices" in Settings. Each install has a random id (localStorage);
// while the app is on screen it writes lastSeen every 90 seconds and says
// when it goes to the background, so other devices can show it as "Live".
// Other devices can send it commands (lock, sign out) through the same doc —
// see security/useAppLock.js.
import { useEffect, useState, useCallback } from 'react';
import { subscribeToDevices, touchDevice, removeDevice, patchDevice, noteDeviceSignIn } from '../services/firestore';
import { background } from '../services/sync';
import { generateId } from '../utils/storage';
import { platform } from '../native';

export const DEVICE_ID_KEY = 'et_device_id';
const HEARTBEAT_MS = 90 * 1000;
export const OPEN_NOW_MS = 3 * 60 * 1000;   // two heartbeats plus slack

/** On screen right now: visible and heard from in the last few minutes. */
export const isLive = (d, now = Date.now()) => d?.visible !== false && !!d?.lastSeen && now - d.lastSeen < OPEN_NOW_MS;
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

  // First sign-in on this device for this account → one "new device" alert
  // (checked once per device and account; nothing is read after that)
  useEffect(() => {
    if (!uid) return;
    const key = `et_known_${uid}`;
    try { if (localStorage.getItem(key)) return; } catch { return; }
    noteDeviceSignIn(uid, thisId, describeDevice())
      .then(() => { try { localStorage.setItem(key, '1'); } catch { /* storage unavailable */ } })
      .catch(() => { /* offline: try again next time */ });
  }, [uid, thisId]);

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
    const kind = platform === 'web' ? (standalone ? 'installed web app' : 'browser') : 'app';
    const beat = () => {
      const visible = document.visibilityState === 'visible';
      if (!visible && !navigator.onLine) return;
      background(touchDevice(uid, thisId, { name: describeDevice(), kind, platform, visible }));
    };
    const tick = () => { if (document.visibilityState === 'visible') beat(); };
    beat();
    const timer = setInterval(tick, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    // Leaving for good (tab closed, app quit): say so, so it stops showing as Live
    const bye = () => background(touchDevice(uid, thisId, { visible: false }));
    window.addEventListener('pagehide', bye);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
      window.removeEventListener('pagehide', bye);
      bye();      // locking or signing out unmounts the app: no longer live here
    };
  }, [uid, thisId]);

  /** Send a command to another device: 'lock' | 'signout'. */
  const command = useCallback((id, type) => {
    if (uid) background(patchDevice(uid, id, { command: { type, at: Date.now(), from: describeDevice(), fromId: thisId } }));
  }, [uid, thisId]);
  /** Answer another device's "unlock me" request. */
  const answerUnlock = useCallback((id, nonce, approved) => {
    if (uid) background(patchDevice(uid, id, { unlockApproval: { nonce, approved, at: Date.now(), by: describeDevice() } }));
  }, [uid]);

  return { devices, thisId, command, answerUnlock };
}
