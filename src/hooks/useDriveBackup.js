// ─── Scheduled Google Drive backups ──────────────────────────────
// While the app is open (and a minute after it starts), checks whether a
// backup is due for the account (shared state: users/{uid}/drive_backup/state,
// so one of your devices backs up per period) and runs it silently where
// the platform allows — the Android and desktop apps. On the website a due
// backup waits for a tap ("Back up now"), since browsers need a click to
// reach Google.
import { useCallback, useEffect, useRef, useState } from 'react';
import { backupNow, backupDue, driveSettings, subscribeBackupState, noteBackupError } from '../services/drive';
import { describeDevice } from './useDevices';
import { platform } from '../native';

const CHECK_MS = 30 * 60 * 1000;
const START_DELAY_MS = 60 * 1000;

export function useDriveBackup({ uid, email, settings, loaded }) {
  const cfg = driveSettings(settings);
  const [state, setState] = useState({});
  const [running, setRunning] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const busy = useRef(false);
  const latest = useRef({ cfg, state });
  useEffect(() => { latest.current = { cfg, state }; });

  useEffect(() => (uid ? subscribeBackupState(uid, setState) : undefined), [uid]);

  const run = useCallback(async ({ interactive = true } = {}) => {
    if (!uid || busy.current) return null;
    busy.current = true; setRunning(true);
    try {
      const file = await backupNow({ uid, email, interactive, deviceName: describeDevice() });
      setNeedsTap(false);
      return file;
    } catch (err) {
      if (err?.code === 'consent-required') { setNeedsTap(true); if (interactive) throw err; return null; }
      if (err?.code === 'cancelled') { if (interactive) throw err; return null; }
      noteBackupError(uid, err?.message ?? 'Backup failed');
      if (interactive) throw err;
      return null;
    } finally { busy.current = false; setRunning(false); }
  }, [uid, email]);

  // The schedule
  useEffect(() => {
    if (!uid || !loaded || !cfg.enabled) return undefined;
    const check = () => {
      const { cfg: c, state: s } = latest.current;
      if (!navigator.onLine || document.visibilityState !== 'visible') return;
      if (!backupDue(c, s.lastAt)) return;
      if (platform === 'web') { setNeedsTap(true); return; }
      run({ interactive: false });
    };
    const first = setTimeout(check, START_DELAY_MS + Math.random() * 30e3);
    const every = setInterval(check, CHECK_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [uid, loaded, cfg.enabled, run]);

  return { cfg, state, running, needsTap: needsTap && backupDue(cfg, state.lastAt), run };
}
