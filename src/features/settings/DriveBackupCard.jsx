// ─── Profile → Google Drive backup ───────────────────────────────
// Turn it on once (Google asks for Drive access), pick how often, and the
// app keeps the newest copies in "Expense Tracker backups" in your Drive.
// Restore any of them here — on this device or a new one.
import { useState } from 'react';
import { CardFrame } from './SettingsGroup';
import { HardDriveUpload, CloudUpload, History, ExternalLink, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { FREQUENCIES, driveToken, listBackups, downloadBackup, folderUrl, disconnectDrive } from '../../services/drive';
import { restoreBackup } from '../../services/firestore';
import { parseBackup, describeBackup } from '../../utils/backup';
import { timeAgo } from '../../services/sync';
import { platform } from '../../native';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function DriveBackupCard({ user, onPatchSettings, drive, bare = false }) {
  const { cfg, state, running, needsTap, run } = drive;
  const [msg, setMsg] = useState(null);           // { text, tone }
  const [list, setList] = useState(null);         // { folderId, files } once loaded
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const save = (patch) => onPatchSettings?.({ driveBackup: { ...cfg, ...patch } });

  async function turnOn() {
    setMsg(null);
    try {
      // Ask for Drive access right away, then make the first backup
      save({ enabled: true });
      await run({ interactive: true });
      setMsg({ text: 'Backed up to your Google Drive. The next ones happen on their own.', tone: 'income' });
    } catch (err) {
      setMsg({ text: err.message, tone: 'expense' });
      if (err?.code === 'cancelled' || err?.code === 'unsupported') save({ enabled: false });
    }
  }
  async function now() {
    setMsg(null);
    try { await run({ interactive: true }); setMsg({ text: 'Backed up just now.', tone: 'income' }); setList(null); } catch (err) { setMsg({ text: err.message, tone: 'expense' }); }
  }
  async function showList() {
    setMsg(null); setBusy(true);
    try { setList(await listBackups(await driveToken({ interactive: true, hint: user?.email }))); } catch (err) { setMsg({ text: err.message, tone: 'expense' }); } finally { setBusy(false); }
  }
  async function restore(file) {
    setRestoring(null); setBusy(true); setMsg(null);
    try {
      const text = await downloadBackup(await driveToken({ interactive: true, hint: user?.email }), file.id);
      const backup = parseBackup(text);
      await restoreBackup(user.uid, backup);
      setMsg({ text: `Restored ${describeBackup(backup)} from ${file.name}. Entries with the same id were replaced; nothing else was removed.`, tone: 'income' });
    } catch (err) { setMsg({ text: err.message, tone: 'expense' }); } finally { setBusy(false); }
  }

  return (
    <CardFrame bare={bare} id="group-drive" title="Google Drive backup">
        {restoring && (
          <ConfirmDeleteModal title={`Restore ${restoring.name}?`}
            message="Entries in the backup are written back to your account (same entries are replaced with the backed-up version). Nothing that isn’t in the backup is deleted."
            confirmLabel="Restore" ConfirmIcon={RotateCcw} onConfirm={() => restore(restoring)} onCancel={() => setRestoring(null)} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: cfg.enabled ? 'var(--savings)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HardDriveUpload size={16} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cfg.enabled ? 'Backing up to your Drive' : 'Back up to your own Google Drive'}</div>
            <div id="drive-status" style={{ fontSize: 11, color: state.error && cfg.enabled ? 'var(--expense)' : 'var(--text-muted)', marginTop: 1 }}>
              {running ? 'Backing up…'
                : state.error && cfg.enabled ? `Last try failed: ${state.error.message}`
                : state.lastAt ? `Last backup ${timeAgo(state.lastAt)}${state.lastDevice ? ` · ${state.lastDevice}` : ''}${state.lastFile?.size ? ` · ${fmtSize(state.lastFile.size)}` : ''}`
                : 'A copy only you hold — even if our servers had a problem, your data is in your Drive'}
            </div>
          </div>
          {cfg.enabled && (
            <button id="drive-toggle" className="toggle-track on" aria-pressed aria-label="Google Drive backup" onClick={() => { save({ enabled: false }); disconnectDrive(); }}>
              <span className="toggle-thumb" />
            </button>
          )}
        </div>

        {!cfg.enabled && (
          <>
            <p style={note}>Like WhatsApp: a full copy of everything — entries, trips, bills, settings — goes to a folder “Expense Tracker backups” in your Google Drive, on the schedule you pick. The app can only see the files it creates there.</p>
            <button id="drive-enable" onClick={turnOn} disabled={running} style={btn(true)}>
              {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CloudUpload size={14} />} Connect Google Drive
            </button>
          </>
        )}

        {cfg.enabled && (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <select id="drive-frequency" value={cfg.frequency} onChange={(e) => save({ frequency: e.target.value })} style={select} aria-label="How often">
                {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select id="drive-keep" value={cfg.keep} onChange={(e) => save({ keep: Number(e.target.value) })} style={select} aria-label="Copies to keep">
                {[3, 5, 10, 20, 30].map((n) => <option key={n} value={n}>Keep {n} copies</option>)}
              </select>
            </div>
            {needsTap && <p id="drive-due" style={{ ...note, color: 'var(--lent)' }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> A backup is due — tap Back up now{platform === 'web' ? ' (browsers need a tap to reach Google).' : '.'}</p>}
            {platform === 'web' && !needsTap && <p style={note}>On the website, a due backup waits for your tap. The Android and desktop apps back up by themselves.</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button id="drive-now" onClick={now} disabled={running} style={btn(true)}>
                {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CloudUpload size={14} />} Back up now
              </button>
              <button id="drive-list" onClick={showList} disabled={busy} style={btn(false)}><History size={14} /> Restore…</button>
            </div>
          </>
        )}

        {msg && <div role="status" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: `var(--${msg.tone})` }}>{msg.tone === 'income' ? <CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> : <AlertTriangle size={12} style={{ verticalAlign: -2 }} />} {msg.text}</div>}
        {busy && !list && <div style={{ marginTop: 10 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>}

        {list && (
          <div id="drive-backups" style={{ marginTop: 12, borderTop: '1px solid var(--border)' }}>
            {list.files.length === 0 && <p style={note}>No backups in your Drive yet.</p>}
            {list.files.slice(0, 15).map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>{new Date(f.createdTime).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtSize(Number(f.size) || 0)}</div>
                </div>
                <button onClick={() => setRestoring(f)} disabled={busy} style={btn(false)}><RotateCcw size={13} /> Restore</button>
              </div>
            ))}
            <a href={folderUrl(list.folderId)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              Open the folder in Google Drive <ExternalLink size={12} />
            </a>
          </div>
        )}
    </CardFrame>
  );
}

const note = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55, margin: '10px 0 0' };
const select = { padding: '8px 10px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', borderRadius: 10 };
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer',
  border: primary ? 'none' : '1.5px solid var(--border)', background: primary ? 'var(--savings)' : 'transparent', color: primary ? 'var(--on-accent, #fff)' : 'var(--text-secondary)',
  marginTop: primary ? 0 : 0,
});
