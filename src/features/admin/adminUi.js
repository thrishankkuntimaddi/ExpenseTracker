// ─── Admin sees: shared styles and the server-job hook ───────────
import { useCallback, useEffect, useState } from 'react';
import { getGithubToken, saveGithubToken, runServerJob, serverJobRuns, cancelServerJob } from '../../services/liveConfig';

export const muted = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 };
export const btn = (tone = 'text-secondary', filled = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
  border: filled ? 'none' : '1px solid var(--border)', background: filled ? `var(--${tone})` : 'transparent', color: filled ? '#fff' : `var(--${tone})`,
});

/** { token, runs, busy, error, run(), refresh(), cancel(id), saveToken(t) } — owner only. */
export function useServerJob(enabled) {
  const [token, setToken] = useState(null);     // null: not loaded yet; '' none
  const [runs, setRuns] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const refresh = useCallback(async (tk) => {
    const t = tk ?? token;
    if (!t) return;
    try { setRuns(await serverJobRuns(t)); setError(null); } catch (e) { setError(e.message); }
  }, [token]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    getGithubToken().then((t) => { if (!live) return; setToken(t); if (t) serverJobRuns(t).then((r) => live && setRuns(r), (e) => live && setError(e.message)); }, () => live && setToken(''));
    return () => { live = false; };
  }, [enabled]);
  // While a run is queued or going, look again every 10 s
  const active = runs?.some((r) => r.status !== 'completed');
  useEffect(() => {
    if (!active || !token) return undefined;
    const t = setInterval(() => refresh(), 10000);
    return () => clearInterval(t);
  }, [active, token, refresh]);
  const run = async () => {
    setBusy(true); setError(null);
    try { await runServerJob(token); setTimeout(() => refresh(), 2500); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const cancel = async (id) => { try { await cancelServerJob(token, id); setTimeout(() => refresh(), 1500); } catch (e) { setError(e.message); } };
  const saveToken = async (t) => { await saveGithubToken(t); setToken(t.trim()); if (t.trim()) refresh(t.trim()); };
  return { token, runs, busy, error, run, refresh, cancel, saveToken, active };
}

