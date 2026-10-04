import { useState, useRef, useEffect } from 'react';
import {
  Download, Upload, Trash2, Info,
  ChevronRight, Moon, Sun, FileSpreadsheet,
  Database, Palette, LogOut, Link, RefreshCw, ArrowDownToLine, RotateCcw, Smartphone,
} from 'lucide-react';
import { updateSettings as fsUpdateSettings, deleteAllUserData, bulkImport } from '../../services/firestore';
import { pushToSheet, pullFromSheet, validateSheet, checkServerHealth, SHEETS_SYNC_AVAILABLE } from '../../services/googleSheets';
import { csvToRecords, prepareSheetRecords } from '../../utils/importHelpers';
import { todayInputValue } from '../../utils/dateHelpers';
import RecentlyDeletedModal from '../../components/RecentlyDeletedModal';
import PWAInstallModal from '../../components/PWAInstallModal';

export default function SettingsTab({
  onThemeChange, onSignOut,
  settings, theme, user,
  transactions = [], income = [],
  recentlyDeleted = [],
  restoreDeletedItem,
  permanentlyDeleteRecentlyDeletedItem,
  emptyTrash,
  isStandalone,
  onTriggerInstall,
}) {
  const [feedback, setFeedback]       = useState(null);
  const [sheetUrl, setSheetUrl]       = useState(settings?.googleSheetUrl || '');
  const [importing, setImporting]     = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [pulling, setPulling]         = useState(false);
  const [serverOnline, setServerOnline] = useState(null); // null=unchecked, true, false
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const fileInputRef = useRef(null);
  const csvInputRef  = useRef(null);
  const isMonoflow   = theme === 'monoflow';

  /* ── Check if the proxy server is reachable on mount ── */
  useEffect(() => {
    if (SHEETS_SYNC_AVAILABLE) checkServerHealth().then(setServerOnline);
  }, []);

  function showFeedback(msg, isError = false) {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 4000);
  }

  /* ── Data ── */
  async function handleResetData() {
    if (!window.confirm('Reset ALL data? This cannot be undone.')) return;
    if (!user?.uid) { showFeedback('You must be logged in to reset.', true); return; }
    try {
      // Deletes transactions, income, billings and trash (batched).
      // The live listeners update the UI and the offline cache.
      await deleteAllUserData(user.uid);
      showFeedback('All data deleted.');
    } catch (err) {
      showFeedback('Reset failed. See console.', true);
      console.error('[Reset]', err);
    }
  }

  // FIX: reads from live React state (transactions / income props), NOT localStorage cache
  function handleExport() {
    const payload = { transactions, income, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-${todayInputValue()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${transactions.length} transactions & ${income.length} income entries.`);
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

  async function runImport(records, label) {
    if (!user?.uid) { showFeedback('You must be logged in to import.', true); return; }
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
    readFile(e, (text) => {
      let p;
      try { p = JSON.parse(text); } catch { showFeedback('Invalid JSON file.', true); return; }
      if (!Array.isArray(p.transactions) || !Array.isArray(p.income)) {
        showFeedback('Invalid JSON file.', true); return;
      }
      // Mirrors validEntry() in firestore.rules so one bad row can't fail a whole batch
      const valid = (r) => r && typeof r.id === 'string' && r.id && !r.id.includes('/')
        && Number.isFinite(Number(r.amount))
        && typeof r.date === 'string' && r.date.length <= 40
        && typeof r.name === 'string' && r.name.trim() && r.name.length <= 500;
      const transactions = p.transactions.filter(valid).map((r) => ({ ...r, amount: Number(r.amount) }));
      const income       = p.income.filter(valid).map((r) => ({ ...r, amount: Number(r.amount) }));
      const skipped = p.transactions.length + p.income.length - transactions.length - income.length;
      runImport({ transactions, income }, skipped ? ` (${skipped} invalid rows skipped)` : '');
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

  /* ── Google Sheets ── */
  async function handleSaveSheetUrl() {
    if (!sheetUrl.trim()) { showFeedback('Please enter a sheet URL.', true); return; }
    try {
      // Save URL to Firestore settings
      await fsUpdateSettings(user.uid, { ...settings, googleSheetUrl: sheetUrl.trim() });
      // Validate access (non-blocking)
      const v = await validateSheet(sheetUrl.trim());
      if (v.success) {
        showFeedback(`✅ Linked to "${v.title}" — ${v.sheets.length} tab(s) found.`);
      } else {
        showFeedback('Sheet URL saved. Share the sheet with your service account email to enable sync.', false);
      }
    } catch { showFeedback('Failed to save sheet URL.', true); }
  }

  async function handleSyncSheet() {
    if (!sheetUrl.trim()) { showFeedback('Enter your Google Sheet URL first.', true); return; }
    setSyncing(true);
    try {
      const result = await pushToSheet(sheetUrl, { transactions, income });
      showFeedback(result.message, !result.success);
      if (result.success) setServerOnline(true);
    } catch (err) {
      showFeedback(`Push failed: ${err.message}`, true);
    } finally { setSyncing(false); }
  }

  async function handlePullSheet() {
    if (!sheetUrl.trim()) { showFeedback('Enter your Google Sheet URL first.', true); return; }
    setPulling(true);
    try {
      const result = await pullFromSheet(sheetUrl);
      if (!result.success) { showFeedback(result.message, true); return; }
      // Stable ids from sheet position; rows pulled before are skipped
      const existingIds = new Set([...transactions, ...income].map((r) => r.id));
      const records = prepareSheetRecords(result, existingIds);
      await bulkImport(user.uid, records);
      showFeedback(`✅ Pulled ${records.transactions.length} transactions + ${records.income.length} income entries`
        + (records.duplicates ? ` (${records.duplicates} already imported, skipped)` : ''));
      setServerOnline(true);
    } catch (err) {
      showFeedback(`Pull failed: ${err.message}`, true);
    } finally { setPulling(false); }
  }

  /* ── Theme ── */
  function toggleTheme() { onThemeChange(isMonoflow ? 'light' : 'monoflow'); }

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

            {/* ── Theme ── */}
            <SectionLabel Icon={Palette}>Appearance</SectionLabel>
            <Card>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isMonoflow ? 'var(--accent-bg)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isMonoflow ? <Moon size={16} style={{ color: 'var(--accent)' }} /> : <Sun size={16} style={{ color: 'var(--person)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{isMonoflow ? 'MonoFlow (Dark)' : 'Light Theme'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{isMonoflow ? 'Dark, gold-accented MonoFlow theme' : 'Clean white light theme'}</div>
                  </div>
                </div>
                <button className={`toggle-track ${isMonoflow ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle theme">
                  <span className="toggle-thumb" />
                </button>
              </div>
              <div style={{ padding: '8px 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                <ThemeChip label="Light"    active={!isMonoflow}  onClick={() => onThemeChange('light')}    />
                <ThemeChip label="MonoFlow" active={isMonoflow}   onClick={() => onThemeChange('monoflow')} />
              </div>
            </Card>

            {/* ── Data Management ── */}
            <SectionLabel Icon={Database}>Data Management</SectionLabel>
            <Card>
              <ActionRow id="btn-recently-deleted" Icon={RotateCcw} label="Recently Deleted" sub={`${recentlyDeleted.length} ${recentlyDeleted.length === 1 ? 'item' : 'items'} in trash — view or revert`} iconColor="var(--expense)" onClick={() => setShowTrashModal(true)} />
              <ActionRow id="btn-export" Icon={Download} label="Export Data"    sub={`Download JSON — ${transactions.length} txns, ${income.length} income`} iconColor="var(--savings)" onClick={handleExport} />
              <ActionRow id="btn-import" Icon={Upload}   label={importing ? 'Importing…' : 'Import Data'}   sub="Restore from JSON backup file (writes to cloud)"          iconColor="var(--accent)"  onClick={() => !importing && fileInputRef.current?.click()} />
              <ActionRow id="btn-csv"    Icon={FileSpreadsheet} label={importing ? 'Importing…' : 'Import CSV'}  sub="Import .csv file (date,name,amount,type) → cloud"    iconColor="var(--income)"  onClick={() => !importing && csvInputRef.current?.click()} />
              <ActionRow id="btn-reset"  Icon={Trash2}   label="Reset All Data" sub="Permanently deletes all transactions, income, billings and trash"      iconColor="var(--expense)" onClick={handleResetData} danger lastRow />
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

            {/* ── Google Sheets ── */}
            <SectionLabel Icon={FileSpreadsheet}>Google Sheets</SectionLabel>
            {!SHEETS_SYNC_AVAILABLE ? (
              <Card>
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Google Sheets sync needs the companion sync server, which isn&apos;t configured for this deployment.
                  Run the app locally with <code>npm run server</code>, or build with <code>VITE_SHEETS_PROXY_URL</code> set
                  to a hosted proxy. CSV and JSON import/export above work everywhere.
                </div>
              </Card>
            ) : (
            <Card>
              <div style={{ padding: 16 }}>

                {/* Server status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, padding: '7px 12px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: serverOnline === null ? '#94A3B8' : serverOnline ? '#22C55E' : '#EF4444',
                    boxShadow:  serverOnline ? '0 0 6px #22C55E88' : 'none',
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {serverOnline === null ? 'Checking proxy server…'
                      : serverOnline ? 'Proxy server online'
                      : 'Proxy server offline — run: cd server && npm start'}
                  </span>
                </div>

                <p className="section-label" style={{ marginBottom: 10 }}>Your Google Sheet URL</p>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Link size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="settings-sheet-url"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    style={{ width: '100%', paddingLeft: 34, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 12, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                    onBlur={e  => (e.target.style.borderColor = 'var(--input-border)')}
                  />
                </div>

                {/* Link + Sync Now row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    id="btn-save-sheet"
                    onClick={handleSaveSheetUrl}
                    style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: 'var(--income)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Save &amp; Validate
                  </button>
                  <button
                    id="btn-sync-sheet"
                    onClick={handleSyncSheet}
                    disabled={syncing || !sheetUrl.trim()}
                    style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                    {syncing ? 'Pushing…' : '↑ Push to Sheet'}
                  </button>
                </div>

                {/* Pull row */}
                <button
                  id="btn-pull-sheet"
                  onClick={handlePullSheet}
                  disabled={pulling || !sheetUrl.trim()}
                  style={{ width: '100%', padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: pulling ? 'var(--surface2)' : 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowDownToLine size={12} />
                  {pulling ? 'Pulling from sheet…' : '↓ Pull from Sheet → Firestore'}
                </button>

                {/* Info box */}
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>How it works</strong>
                  <span>↑ <strong>Push</strong> writes all your Firebase data to an <em>ExpenseTracker</em> tab (safe — never touches your existing data).</span><br />
                  <span>↓ <strong>Pull</strong> reads columns A/B (income) + paired expense columns D/E, F/G … dynamically, and saves to Firestore.</span><br />
                  <span style={{ marginTop: 4, display: 'block' }}>Share your sheet with the <strong>service account email</strong> in <code style={{ background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>server/.env</code>.</span>
                </div>
              </div>
            </Card>
            )}

            {/* ── Install App (Visible only when visiting website via browser, hidden when running in standalone installed app) ── */}
            {!isStandalone && (
              <>
                <SectionLabel Icon={Smartphone}>Mobile App</SectionLabel>
                <Card>
                  <ActionRow
                    id="btn-install-app"
                    Icon={Smartphone}
                    label="Install App"
                    sub="Add to home screen for native mobile app experience"
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Firebase Auth · Data synced to cloud</div>
              </div>
              <ActionRow
                id="btn-sign-out"
                Icon={LogOut}
                label="Sign Out"
                sub="You will need to sign in again"
                iconColor="var(--expense)"
                onClick={() => { if (window.confirm('Sign out?')) onSignOut(); }}
                danger lastRow
              />
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

function ThemeChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}
