// ─── App lock: state machine ─────────────────────────────────────
// One lock for the whole account (users/{uid}/security/lock), honoured on
// every device:
//   • locks when the app starts, after the chosen time away, after a long
//     idle on a computer, or when another device of yours says "lock"
//   • unlocks with the account PIN, this device's fingerprint/passkey, or an
//     approval from another of your devices that is open and unlocked
//   • wrong PINs are counted for the whole account: from the 5th the app
//     waits longer each time and your other devices (and email) are told;
//     the 10th means only signing in again unlocks it — nothing is erased
//   • "Forgot PIN": sign in again, set a new PIN; data is untouched
// While locked, the app's data listeners are not running and nothing of
// yours is on screen.
import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import {
  subscribeToLock, saveLock, addLockFailure, resetLockFailures, addSecurityEvent,
  subscribeToDevice, patchDevice,
} from '../services/firestore';
import { background } from '../services/sync';
import { getDeviceId, describeDevice } from '../hooks/useDevices';
import { checkPin, makePinRecord, lockoutFor, ALERT_AT, MAX_TRIES, shouldRelock, DEFAULT_LOCK_AFTER } from './pin';
import { verifyBiometric, biometricEnrolled } from './biometric';
import { platform } from '../native';

const CFG_KEY = (uid) => `et_lock_cfg_${uid}`;
const FAILS_KEY = 'et_lock_fails';             // { count, lastAt } — this device
const CMD_KEY = 'et_lock_cmd_done';            // last command timestamp handled here
const IDLE_MIN_MS = 5 * 60 * 1000;             // computers: lock after this long untouched (at least)
const REQUEST_TTL = 2 * 60 * 1000;             // an unlock request expires

const readJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const AppLockContext = createContext(null);
export const useAppLockContext = () => useContext(AppLockContext);

/** The lock config as last seen on this device (decides the first frame). */
export function cachedLockConfig(uid) {
  return uid ? readJson(CFG_KEY(uid), null) : null;
}

export function useAppLock(user, { onRemoteSignOut } = {}) {
  const uid = user?.uid ?? null;
  const deviceId = getDeviceId();
  const deviceName = describeDevice();
  const [cfg, setCfg] = useState(() => cachedLockConfig(uid) ?? {});
  const [locked, setLocked] = useState(() => !!cachedLockConfig(uid)?.enabled);
  const [reason, setReason] = useState('start');
  const [localFails, setLocalFails] = useState(() => readJson(FAILS_KEY, { count: 0, lastAt: 0 }));
  const [request, setRequest] = useState(null);       // { nonce, at, status: 'waiting'|'denied' }
  const [now, setNow] = useState(() => Date.now());
  const cfgRef = useRef(cfg);
  const lockedRef = useRef(locked);
  const hiddenAt = useRef(null);
  const firstSnap = useRef(true);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  const lock = useCallback((why = 'manual') => {
    if (!cfgRef.current?.enabled) return false;
    setReason(why);
    setLocked(true);
    return true;
  }, []);

  // Other devices show this one as "Locked" while it is
  useEffect(() => {
    if (!uid || !cfg.enabled) return;
    background(patchDevice(uid, deviceId, { locked, ...(locked ? { visible: false } : {}) }));
  }, [uid, deviceId, locked, cfg.enabled]);

  /* ── The shared config ── */
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToLock(uid, (data) => {
      const next = data ?? {};
      const before = cachedLockConfig(uid);
      setCfg(next);
      writeJson(CFG_KEY(uid), { enabled: !!next.enabled, lockAfter: next.lockAfter ?? DEFAULT_LOCK_AFTER, pinHash: next.pinHash, salt: next.salt, iterations: next.iterations, length: next.length, fails: next.fails ?? 0, lastFailAt: next.lastFailAt ?? 0 });
      // A device that didn't know about the lock yet (first sign-in here) locks at once
      if (firstSnap.current) {
        firstSnap.current = false;
        if (next.enabled && !before) { setReason('start'); setLocked(true); }
      }
      if (!next.enabled) setLocked(false);
    });
  }, [uid]);

  /* ── Time away / idle ── */
  useEffect(() => {
    if (!uid) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      if (shouldRelock(cfgRef.current, hiddenAt.current)) lock('away');
      hiddenAt.current = null;
    };
    document.addEventListener('visibilitychange', onVis);
    // Computers and the website stay "visible" on an unattended desk: lock when idle too
    let idleTimer = null;
    const idleMs = () => Math.max(IDLE_MIN_MS, (cfgRef.current?.lockAfter ?? DEFAULT_LOCK_AFTER) * 1000);
    const poke = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => lock('idle'), idleMs()); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    if (platform !== 'android') { events.forEach((e) => window.addEventListener(e, poke, { passive: true })); poke(); }
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      events.forEach((e) => window.removeEventListener(e, poke));
      clearTimeout(idleTimer);
    };
  }, [uid, lock]);

  /* ── Commands to this device: lock, sign out, unlock approvals ── */
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToDevice(uid, deviceId, (d) => {
      const cmd = d?.command;
      const done = Number(localStorage.getItem(CMD_KEY) || 0);
      if (cmd?.at && cmd.at > done && Date.now() - cmd.at < 7 * 86400e3) {
        try { localStorage.setItem(CMD_KEY, String(cmd.at)); } catch { /* storage unavailable */ }
        background(patchDevice(uid, deviceId, { command: null }));
        if (cmd.type === 'lock') lock('remote');
        if (cmd.type === 'signout') onRemoteSignOut?.(cmd);
      }
      const req = requestRef.current;
      if (req && d?.unlockApproval?.nonce === req.nonce) {
        background(patchDevice(uid, deviceId, { unlockRequest: null, unlockApproval: null }));
        if (d.unlockApproval.approved) { finishUnlock('approved'); }
        else setRequest({ ...req, status: 'denied' });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishUnlock is stable enough (state setters)
  }, [uid, deviceId, lock, onRemoteSignOut]);

  /* ── Unlocking ── */
  const serverFails = cfg.fails ?? 0;
  const fails = Math.max(localFails.count, serverFails);
  const lastFailAt = Math.max(localFails.lastAt || 0, cfg.lastFailAt || 0);
  const waitUntil = fails ? lastFailAt + lockoutFor(fails) : 0;
  const needsSignIn = fails >= MAX_TRIES;
  // Tick while a wait is running so the countdown moves
  useEffect(() => {
    if (!locked || !(waitUntil > Date.now()) || !isFinite(waitUntil)) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked, waitUntil]);

  function finishUnlock() {
    setLocked(false);
    setRequest(null);
    hiddenAt.current = null;
    setLocalFails({ count: 0, lastAt: 0 });
    writeJson(FAILS_KEY, { count: 0, lastAt: 0 });
    if (uid && (cfgRef.current?.fails ?? 0) > 0) background(resetLockFailures(uid));
  }

  const unlockWithPin = useCallback(async (pin) => {
    if (needsSignIn) return { ok: false, needsSignIn: true };
    if (waitUntil > Date.now()) return { ok: false, wait: waitUntil - Date.now() };
    if (await checkPin(pin, cfgRef.current)) { finishUnlock(); return { ok: true }; }
    const next = { count: fails + 1, lastAt: Date.now() };
    setLocalFails(next);
    writeJson(FAILS_KEY, next);
    if (uid) {
      background(addLockFailure(uid, deviceName));
      if (next.count === ALERT_AT || next.count === MAX_TRIES) {
        background(addSecurityEvent(uid, { type: next.count >= MAX_TRIES ? 'locked_out' : 'wrong_pins', count: next.count, device: deviceName, deviceId }));
      }
    }
    return { ok: false, fails: next.count, wait: lockoutFor(next.count) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fails, waitUntil, needsSignIn, deviceName, deviceId]);

  const unlockWithBiometric = useCallback(async () => {
    if (needsSignIn || !biometricEnrolled()) return false;
    const ok = await verifyBiometric();
    if (ok) finishUnlock();
    return ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSignIn]);

  /** Ask an open, unlocked device of yours to let this one in. */
  const requestUnlock = useCallback(() => {
    if (!uid) return;
    const nonce = crypto.getRandomValues(new Uint32Array(2)).join('');
    const at = Date.now();
    setRequest({ nonce, at, status: 'waiting' });
    background(patchDevice(uid, deviceId, { unlockRequest: { nonce, at, name: deviceName }, unlockApproval: null }));
  }, [uid, deviceId, deviceName]);
  const cancelRequest = useCallback(() => {
    setRequest(null);
    if (uid) background(patchDevice(uid, deviceId, { unlockRequest: null }));
  }, [uid, deviceId]);
  useEffect(() => {
    if (!request || request.status !== 'waiting') return undefined;
    const t = setTimeout(() => setRequest((r) => (r && r.nonce === request.nonce ? { ...r, status: 'expired' } : r)), REQUEST_TTL);
    return () => clearTimeout(t);
  }, [request]);

  /** After signing in again ("Forgot PIN" or too many tries): the old PIN is cleared and a new one is required. */
  const afterReauth = useCallback(async () => {
    setLocalFails({ count: 0, lastAt: 0 });
    writeJson(FAILS_KEY, { count: 0, lastAt: 0 });
    if (uid) {
      background(resetLockFailures(uid));
      background(addSecurityEvent(uid, { type: 'pin_reset_started', device: deviceName, deviceId }));
    }
    setReason('reset');      // the lock screen now asks for a new PIN
  }, [uid, deviceName, deviceId]);

  /* ── Settings ── */
  const setPin = useCallback(async (pin, { lockAfter } = {}) => {
    if (!uid) return;
    const record = await makePinRecord(pin);
    const wasEnabled = !!cfgRef.current?.enabled;
    await saveLock(uid, { enabled: true, ...record, lockAfter: lockAfter ?? cfgRef.current?.lockAfter ?? DEFAULT_LOCK_AFTER, fails: 0 });
    background(addSecurityEvent(uid, { type: wasEnabled ? 'pin_changed' : 'lock_on', device: deviceName, deviceId }));
    finishUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, deviceName, deviceId]);

  const turnOff = useCallback(async () => {
    if (!uid) return;
    await saveLock(uid, { enabled: false, pinHash: null, salt: null, iterations: null, length: null, fails: 0 });
    background(addSecurityEvent(uid, { type: 'lock_off', device: deviceName, deviceId }));
    setLocked(false);
  }, [uid, deviceName, deviceId]);

  const setLockAfter = useCallback((s) => { if (uid) background(saveLock(uid, { lockAfter: s })); }, [uid]);

  return {
    enabled: !!cfg.enabled, cfg, locked, reason, fails, needsSignIn, now,
    wait: Math.max(0, waitUntil - now), request,
    lock, unlockWithPin, unlockWithBiometric, requestUnlock, cancelRequest, afterReauth,
    setPin, turnOff, setLockAfter, checkPin: (pin) => checkPin(pin, cfgRef.current),
    deviceId, deviceName,
  };
}
