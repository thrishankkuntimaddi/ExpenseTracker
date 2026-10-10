import { useState, useRef } from 'react';
import {
  Download, Upload, Trash2, Info,
  ChevronRight, Moon, Sun, Monitor, FileSpreadsheet,
  Database, Palette, LogOut, RotateCcw, Smartphone, ArrowRightLeft, KeyRound, MailCheck,
  Cloud, CloudOff, RefreshCw, AlertTriangle, Laptop, X, UserX, Eraser,
} from 'lucide-react';
import { deleteAllUserData, bulkImport, exportAllUserData, restoreBackup } from '../../services/firestore';
import { parseBackup, describeBackup } from '../../utils/backup';
import { useSyncStatus, describeSync, timeAgo } from '../../services/sync';
import { OPEN_NOW_MS } from '../../hooks/useDevices';
import { csvToRecords } from '../../utils/importHelpers';
import { recordsToCSV } from '../../utils/exportHelpers';
import { getCarrySettings } from '../../utils/carryForward';
import { formatMonthLabel } from '../../utils/periodHelpers';
import { todayInputValue } from '../../utils/dateHelpers';
import RecentlyDeletedModal from '../../components/RecentlyDeletedModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import PWAInstallModal from '../../components/PWAInstallModal';

export default function SettingsTab({
  themePref = 'system', onThemePrefChange, onSignOut,
  settings, theme, user,
  transactions = [], income = [],
  recentlyDeleted = [],
  restoreDeletedItem,
  permanentlyDeleteRecentlyDeletedItem,
  emptyTrash,
  isStandalone,
  onTriggerInstall,
  onPatchSettings,
  onResetPassword, onResendVerification, onDeleteAccount,
  devices,
}) {
  const [feedback, setFeedback]       = useState(null);
  const carry = getCarrySettings(settings);
  const setCarry = (patch) => onPatchSettings?.({ carryForward: { ...carry, ...patch } });
  const [importing, setImporting]     = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [confirming, setConfirming]   = useState(null); // 'clear' | 'delete' | 'account' | 'signout' | { kind: 'pending', … }
  const [busyReset, setBusyReset]     = useState(false);
  const sync = useSyncStatus();
  const syncLine = describeSync(sync);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const fileInputRef = useRef(null);
  const csvInputRef  = useRef(null);
  const isMonoflow   = theme === 'monoflow';
  const hasPassword  = user?.providerData?.some((p) => p.providerId === 'password') ?? false;

  function showFeedback(msg, isError = false) {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 4000);
  }

  /* ── Reset ── */
  async function handleDeleteAll({ andAccount = false } = {}) {
    if (!user?.uid) { showFeedback('You must be logged in.', true); return; }
    setBusyReset(true);
    try {
      await deleteAllUserData(user.uid);
      if (andAccount) { await onDeleteAccount(); return; }   // reloads to the sign-in screen
      showFeedback('All your data was deleted from your account and every device.');
    } catch (err) {
      showFeedback(err.message, true);
      console.error('[Reset]', err);
    } finally { setBusyReset(false); }
  }

  async function handleSignOut(opts) {
    const res = await onSignOut(opts);
    if (res?.pending) setConfirming({ kind: 'pending', pending: res.pending, opts });
  }

  /* Full backup: every collection, read from the server (see exportAllUserData) */
  async function handleExport() {
    if (!user?.uid) { showFeedback('You must be logged in to export.', true); return; }
    setExporting(true);
    try {
      const backup = await exportAllUserData(user.uid, user.email);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `expense-tracker-backup-${todayInputValue()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showFeedback(`Backup saved: ${describeBackup(backup)}.`);
    } catch (err) {
      showFeedback(`Backup failed: ${err.message}`, true);
      console.error('[Export]', err);
    } finally { setExporting(false); }
  }

  function handleExportCSV() {
    const csv = recordsToCSV({ transactions, income }, settings?.categoryRules ?? {});
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM so Excel reads ₹ names correctly
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-${todayInputValue()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${transactions.length + income.length} rows to CSV (opens in Excel / Sheets).`);
  }

  /* ── Import helpers ──
     All imports go through bulkImport(): batched commits, and records keep
     stable ids so importing the same file twice overwrites instead of
     duplicating. Errors propagate so we never report a false success. */
  function readFile(e, onText) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => onText(ev.target.result);
    reader.onerror = () => showFeedback('Could not read the file.', true);
    reader.readAsText(file);
  }

  const OFFLINE_IMPORT = "You're offline. Importing needs a connection so every record reaches your account — try again when you're back online.";

  async function runImport(records, label) {
    if (!user?.uid) { showFeedback('You must be logged in to import.', true); return; }
    if (!navigator.onLine) { showFeedback(OFFLINE_IMPORT, true); return; }
    setImporting(true);
    try {
      await bulkImport(user.uid, records);
      showFeedback(`Imported ${records.transactions.length} transactions & ${records.income.length} income entries${label}.`);
    } catch (err) {
      showFeedback(`Import failed: ${err.message}. Some records may not have been saved — re-run the import to finish (it won't duplicate).`, true);
      console.error('[Import]', err);
    } finally { setImporting(false); }
  }

  function handleImport(e) {
    readFile(e, async (text) => {
      let backup;
      try { backup = parseBackup(text); } catch (err) { showFeedback(err.message, true); return; }
      if (!user?.uid) { showFeedback('You must be logged in to import.', true); return; }
      if (!navigator.onLine) { showFeedback(OFFLINE_IMPORT, true); return; }
      const skipped = Object.values(backup.skipped).reduce((a, b) => a + b, 0);
      setImporting(true);
      try {
        await restoreBackup(user.uid, backup);
        showFeedback(`Restored ${describeBackup(backup)}${backup.settings ? ' and your settings' : ''}`
          + (skipped ? ` (${skipped} invalid records skipped)` : '') + '.');
      } catch (err) {
        showFeedback(`Import failed: ${err.message}. Some records may not have been saved — re-run the import to finish (it won't duplicate).`, true);
        console.error('[Import]', err);
      } finally { setImporting(false); }
    });
  }

  function handleCSVImport(e) {
    readFile(e, (text) => {
      let records;
      try { records = csvToRecords(text); } catch (err) { showFeedback(err.message, true); return; }
      if (records.transactions.length + records.income.length === 0) {
        showFeedback('No valid rows found in CSV.', true); return;
      }
      runImport(records, records.skipped ? ` (${records.skipped} invalid rows skipped)` : '');
    });
  }

  async function handleInstallClick() {
    if (onTriggerInstall) {
      const res = await onTriggerInstall();
      if (!res.success && !res.native) {
        setShowInstallGuideModal(true);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  }

  return (
    <div className="tab-root">
      <div className="tab-header">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Settings</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Preferences, data & account</p>
      </div>

      <div className="tab-body">
        <div className="settings-layout">

          {/* ── Column 1 ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {feedback && (
              <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600, background: feedback.isError ? 'var(--expense-bg)' : 'var(--income-bg)', border: `1px solid ${feedback.isError ? 'var(--expense-border)' : 'var(--income-border)'}`, color: feedback.isError ? 'var(--expense)' : 'var(--income)' }}>
                {feedback.msg}
              </div>
            )}

            {/* ── Sync & devices ── */}
            <SectionLabel Icon={Cloud}>Sync</SectionLabel>
            <Card>
              <div id="sync-status" data-tone={syncLine.tone} style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--${SYNC_TONE[syncLine.tone]}-bg)` }}>
                  {syncLine.tone === 'offline' ? <CloudOff size={16} style={{ color: 'var(--text-muted)' }} />
                    : syncLine.tone === 'problem' ? <AlertTriangle size={16} style={{ color: 'var(--expense)' }} />
                    : syncLine.tone === 'busy' ? <RefreshCw size={16} style={{ color: 'var(--savings)', animation: 'spin 1.2s linear infinite' }} />
                    : <Cloud size={16} style={{ color: 'var(--income)' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: syncLine.tone === 'problem' ? 'var(--expense)' : 'var(--text)' }}>{syncLine.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{syncLine.detail}</div>
                </div>
              </div>
              <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your devices</div>
              {(devices?.devices ?? []).slice().sort((a, b) => (b.id === devices.thisId) - (a.id === devices.thisId) || (b.lastSeen ?? 0) - (a.lastSeen ?? 0)).map((d, i, all) => {
                const isThis = d.id === devices.thisId;
                const openNow = isThis || (d.lastSeen && Date.now() - d.lastSeen < OPEN_NOW_MS);
                return (
                  <div key={d.id} className="device-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i === all.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <Laptop size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{d.name || 'Unknown device'}{isThis && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · this device</span>}</div>
                      <div style={{ fontSize: 11, color: openNow ? 'var(--income)' : 'var(--text-muted)', marginTop: 1 }}>
                        {openNow ? 'Open now' : d.lastSeen ? `Last seen ${timeAgo(d.lastSeen)}` : 'Not seen yet'}{d.kind ? ` · ${d.kind}` : ''}
                      </div>
                    </div>
                    {!isThis && (
                      <button onClick={() => devices.remove(d.id)} aria-label={`Remove ${d.name} from this list`} title="Remove from this list (it reappears if that device opens the app)"
                        style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {!(devices?.devices ?? []).length && (
                <div style={{ padding: '6px 16px 14px', fontSize: 11, color: 'var(--text-muted)' }}>This device appears here once it has synced.</div>
              )}
            </Card>

            {/* ── Theme (per device) ── */}
            <SectionLabel Icon={Palette}>Appearance</SectionLabel>
            <Card>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: isMonoflow ? 'var(--accent-bg)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isMonoflow ? <Moon size={16} style={{ color: 'var(--accent)' }} /> : <Sun size={16} style={{ color: 'var(--person)' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Theme</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {themePref === 'system' ? `Following your device (${isMonoflow ? 'dark' : 'light'} now)` : isMonoflow ? 'Dark (MonoFlow)' : 'Light'} · this device only
                  </div>
                </div>
              </div>
              <div role="radiogroup" aria-label="Theme" style={{ padding: '8px 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                <ThemeChip id="theme-light"  Icon={Sun}     label="Light"  active={themePref === 'light'}  onClick={() => onThemePrefChange('light')} />
                <ThemeChip id="theme-dark"   Icon={Moon}    label="Dark"   active={themePref === 'dark'}   onClick={() => onThemePrefChange('dark')} />
                <ThemeChip id="theme-system" Icon={Monitor} label="System" active={themePref === 'system'} onClick={() => onThemePrefChange('system')} />
              </div>
            </Card>

            {/* ── Carry forward ── */}
            <SectionLabel Icon={ArrowRightLeft}>Month Carry Forward</SectionLabel>
            <Card>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowRightLeft size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Roll leftover into next month</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {carry.enabled
                        ? `From ${formatMonthLabel(carry.startMonth)}: each month's remaining balance appears as income in the next`
                        : 'Off — every month starts from zero'}
                    </div>
                  </div>
                </div>
                <button className={`toggle-track ${carry.enabled ? 'on' : ''}`} onClick={() => setCarry({ enabled: !carry.enabled })} aria-label="Toggle carry forward">
                  <span className="toggle-thumb" />
                </button>
              </div>
              {carry.enabled && (
                <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <span>First month that receives a carry</span>
                    <input
                      id="settings-carry-start"
                      type="month"
                      value={carry.startMonth}
                      onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setCarry({ startMonth: e.target.value }); }}
                      style={{ padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
                    <span>Also carry a deficit (negative leftover)</span>
                    <input type="checkbox" checked={!!carry.includeNegative} onChange={e => setCarry({ includeNegative: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  </label>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    The carried amount is computed live from the previous month, so a late edit to {formatMonthLabel(carry.startMonth === '2026-11' ? '2026-10' : carry.startMonth)} updates it automatically. It is shown as an <strong>auto</strong> line on the Income tab and counted in that month's income and balance.
                  </div>
                </div>
              )}
            </Card>

            {/* ── Data Management ── */}
            <SectionLabel Icon={Database}>Data Management</SectionLabel>
            <Card>
              <ActionRow id="btn-recently-deleted" Icon={RotateCcw} label="Recently Deleted" sub={`${recentlyDeleted.length} ${recentlyDeleted.length === 1 ? 'item' : 'items'} in trash — view or revert`} iconColor="var(--expense)" onClick={() => setShowTrashModal(true)} />
              <ActionRow id="btn-export" Icon={Download} label={exporting ? 'Preparing backup…' : 'Export Backup (JSON)'} sub="Everything: transactions, income, billings, trips, recurring, trash, settings" iconColor="var(--savings)" onClick={() => !exporting && handleExport()} />
              <ActionRow id="btn-export-csv" Icon={FileSpreadsheet} label="Export Spreadsheet (CSV)" sub="With categories — opens in Excel / Google Sheets; re-importable" iconColor="var(--income)" onClick={handleExportCSV} />
              <ActionRow id="btn-import" Icon={Upload}   label={importing ? 'Importing…' : 'Import Data'}   sub="Restore a JSON backup — safe to re-run, never duplicates"          iconColor="var(--accent)"  onClick={() => !importing && fileInputRef.current?.click()} />
              <ActionRow id="btn-csv"    Icon={FileSpreadsheet} label={importing ? 'Importing…' : 'Import CSV'}  sub="Import .csv file (date,name,amount,type) → cloud"    iconColor="var(--income)"  onClick={() => !importing && csvInputRef.current?.click()} lastRow />
              <input ref={fileInputRef} type="file" accept=".json"     style={{ display: 'none' }} onChange={handleImport}    />
              <input ref={csvInputRef}  type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSVImport} />
            </Card>

            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', marginBottom: 20, fontSize: 11, color: 'var(--accent)', lineHeight: 1.6 }}>
              <strong>CSV format:</strong> date,name,amount,type<br />
              Types: <code>expense</code> / <code>income</code> / <code>savings</code> / <code>person</code>
            </div>
          </div>

          {/* ── Column 2 ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ── Install App (Visible only when visiting website via browser, hidden when running in standalone installed app) ── */}
            {!isStandalone && (
              <>
                <SectionLabel Icon={Smartphone}>Mobile App</SectionLabel>
                <Card>
                  <ActionRow
                    id="btn-install-app"
                    Icon={Smartphone}
                    label="Install App"
                    sub="Add to home screen — works offline, opens like an app"
                    iconColor="var(--accent)"
                    onClick={handleInstallClick}
                    lastRow
                  />
                </Card>
              </>
            )}

            {/* ── Account ── */}
            <SectionLabel Icon={LogOut}>Account</SectionLabel>
            <Card>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{user?.email || 'Signed in'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {signInMethods(user)} · {hasPassword && !user?.emailVerified ? 'Email not verified yet' : 'Data synced to cloud'}
                </div>
              </div>
              {hasPassword && !user?.emailVerified && onResendVerification && (
                <ActionRow id="btn-resend-verification" Icon={MailCheck} label="Verify your email" sub="Resend the verification link"
                  iconColor="var(--savings)" onClick={() => onResendVerification()
                    .then(() => showFeedback(`Verification link sent to ${user.email}.`))
                    .catch((err) => showFeedback(`Couldn't send it: ${err.message}`, true))} />
              )}
              {hasPassword && onResetPassword && (
                <ActionRow id="btn-change-password" Icon={KeyRound} label="Change password" sub="We'll email you a secure link"
                  iconColor="var(--accent)" onClick={() => onResetPassword(user.email)
                    .then(() => showFeedback(`Password link sent to ${user.email}. Check spam too.`))
                    .catch(() => showFeedback("Couldn't send the link. Check your connection and try again.", true))} />
              )}
              <ActionRow
                id="btn-sign-out"
                Icon={LogOut}
                label="Sign Out"
                sub="You will need to sign in again"
                iconColor="var(--expense)"
                onClick={() => setConfirming('signout')}
                danger lastRow
              />
            </Card>

            {/* ── Reset ── */}
            <SectionLabel Icon={Trash2}>Reset</SectionLabel>
            <Card>
              <ActionRow id="btn-clear-device" Icon={Eraser} label="Clear this device" sub="Sign out and remove all ExpenseTracker data and preferences from this device. Your account keeps everything."
                iconColor="var(--lent)" onClick={() => setConfirming('clear')} />
              <ActionRow id="btn-delete-all" Icon={Trash2} label={busyReset ? 'Deleting…' : 'Delete all my data'} sub="Every transaction, income entry, billing, trip and setting — on all devices. Keeps your sign-in."
                iconColor="var(--expense)" onClick={() => !busyReset && setConfirming('delete')} danger />
              {onDeleteAccount && (
                <ActionRow id="btn-delete-account" Icon={UserX} label="Delete my account" sub="All your data, then the sign-in itself. You'd need to create a new account to come back."
                  iconColor="var(--expense)" onClick={() => !busyReset && setConfirming('account')} danger lastRow />
              )}
            </Card>

            {/* About */}
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <img
                src={import.meta.env.BASE_URL + 'Expense.png'}
                alt="Expense Tracker Logo"
                style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Expense Tracker v3.0</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Firebase · Real-time sync · PWA</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {confirming === 'clear' && (
        <ConfirmDeleteModal title="Clear this device?"
          message="You'll be signed out and this device's copy of your data, theme and device name are removed. Everything stays in your account — sign in again to get it back."
          confirmLabel="Clear & sign out" ConfirmIcon={Eraser}
          onConfirm={() => { setConfirming(null); handleSignOut({ forgetDevice: true }); }} onCancel={() => setConfirming(null)} />
      )}
      {confirming === 'delete' && (
        <ConfirmDeleteModal title="Delete all your data?"
          message="Every transaction, income entry, billing, trip, recurring rule, the trash and your settings are deleted from your account and all devices. This can't be undone — export a backup first if you might need it."
          confirmLabel="Delete everything"
          onConfirm={() => { setConfirming(null); handleDeleteAll(); }} onCancel={() => setConfirming(null)} />
      )}
      {confirming === 'account' && (
        <ConfirmDeleteModal title="Delete your account?"
          message="All your data is deleted, then your sign-in. This can't be undone — export a backup first if you might need it."
          confirmLabel="Delete account" ConfirmIcon={UserX}
          onConfirm={() => { setConfirming(null); handleDeleteAll({ andAccount: true }); }} onCancel={() => setConfirming(null)} />
      )}
      {confirming === 'signout' && (
        <ConfirmDeleteModal title="Sign out?" message="Your data stays safe in your account. This device's offline copy is cleared."
          confirmLabel="Sign out" ConfirmIcon={LogOut}
          onConfirm={() => { setConfirming(null); handleSignOut(); }} onCancel={() => setConfirming(null)} />
      )}
      {confirming?.kind === 'pending' && (
        <ConfirmDeleteModal title="Changes haven't uploaded yet"
          message={`${confirming.pending} change${confirming.pending === 1 ? ' is' : 's are'} saved only on this device${sync.online ? '' : ' (you’re offline)'}. Signing out now discards ${confirming.pending === 1 ? 'it' : 'them'}. Reconnect and wait for “Synced” in Settings to keep ${confirming.pending === 1 ? 'it' : 'them'}.`}
          confirmLabel="Sign out anyway" ConfirmIcon={LogOut}
          onConfirm={() => { const o = confirming.opts; setConfirming(null); handleSignOut({ ...o, force: true }); }} onCancel={() => setConfirming(null)} />
      )}
      <RecentlyDeletedModal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        recentlyDeleted={recentlyDeleted}
        onRestoreItem={restoreDeletedItem}
        onPermanentlyDeleteItem={permanentlyDeleteRecentlyDeletedItem}
        onEmptyTrash={emptyTrash}
      />

      <PWAInstallModal
        isOpen={showInstallGuideModal}
        onClose={() => setShowInstallGuideModal(false)}
      />

      <style>{`
        @media (min-width: 1024px) { .settings-layout { display: flex; align-items: flex-start; gap: 24px; } }
        @media (max-width: 1023px) { .settings-layout { display: block; } }
        .settings-row:hover { background: var(--surface2) !important; }
      `}</style>
    </div>
  );
}

function SectionLabel({ children, Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      {Icon && <Icon size={12} style={{ color: 'var(--text-muted)' }} />}
      <p className="section-label" style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

function Card({ children }) {
  return <div className="card" style={{ marginBottom: 16 }}>{children}</div>;
}

/* "Google", "Email & password" or both, from the linked providers. */
function signInMethods(user) {
  const ids = user?.providerData?.map((p) => p.providerId) ?? [];
  const names = [ids.includes('google.com') && 'Google', ids.includes('password') && 'Email & password'].filter(Boolean);
  return names.length ? `Signed in with ${names.join(' + ')}` : 'Signed in';
}

const SYNC_TONE = { ok: 'income', busy: 'savings', offline: 'surface2', problem: 'expense' };

function ActionRow({ id, Icon, label, sub, iconColor, onClick, danger, lastRow }) {
  return (
    <button id={id} onClick={onClick} className="settings-row"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: lastRow ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: danger ? 'var(--expense)' : 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}

function ThemeChip({ id, Icon, label, active, onClick }) {
  return (
    <button id={id} role="radio" aria-checked={active} onClick={onClick}
      style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Icon size={12} />{label}
    </button>
  );
}
