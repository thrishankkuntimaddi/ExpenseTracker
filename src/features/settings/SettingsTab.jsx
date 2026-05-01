import { useState, useRef, useEffect } from 'react';
import {
  Download, Upload, Trash2, Info,
  ChevronRight, Moon, Sun, FileSpreadsheet,
  Database, Palette, LogOut, Link, RefreshCw, CloudUpload, ArrowDownToLine,
} from 'lucide-react';
import { clearState, generateId } from '../../utils/storage';
import { migrateFromLocalStorage, updateSettings as fsUpdateSettings, deleteAllUserData, purgeCarryForwardData } from '../../services/firestore';
import { pushToSheet, pullFromSheet, validateSheet, checkServerHealth } from '../../services/googleSheets';

export default function SettingsTab({
  onDataChange, onThemeChange, onSignOut,
  settings, theme, user,
  transactions = [], income = [],
  addTransaction, addIncome,
}) {
  const [feedback, setFeedback]       = useState(null);
  const [sheetUrl, setSheetUrl]       = useState(settings?.googleSheetUrl || '');
  const [migrating, setMigrating]     = useState(false);
  const [importing, setImporting]     = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [pulling, setPulling]         = useState(false);
  const [serverOnline, setServerOnline] = useState(null); // null=unchecked, true, false
  const fileInputRef = useRef(null);
  const csvInputRef  = useRef(null);
  const isMonoflow   = theme === 'monoflow';

  /* ── Check if the proxy server is reachable on mount ── */
  useEffect(() => {
    checkServerHealth().then(setServerOnline);
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
      // Delete every document from Firestore, then clear the local cache
      await deleteAllUserData(user.uid);
      clearState();
      onDataChange({ transactions: [], income: [] });
      showFeedback('All data deleted from cloud and local cache.');
    } catch (err) {
      showFeedback('Reset failed. See console.', true);
      console.error('[Reset]', err);
    }
  }

  async function handlePurgeCarryForward() {
    if (!user?.uid) { showFeedback('You must be logged in.', true); return; }
    try {
      const count = await purgeCarryForwardData(user.uid);
      if (count === 0) showFeedback('No carry-forward entries found — already clean!');
      else showFeedback(`Removed ${count} carry-forward ${count === 1 ? 'entry' : 'entries'} from cloud.`);
    } catch (err) {
      showFeedback('Purge failed. See console.', true);
      console.error('[PurgeCarryForward]', err);
    }
  }

  // FIX: reads from live React state (transactions / income props), NOT localStorage cache
  function handleExport() {
    const payload = { transactions, income, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${transactions.length} transactions & ${income.length} income entries.`);
  }

  // FIX: calls addTransaction / addIncome so data goes straight to Firestore
  function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!addTransaction || !addIncome) { showFeedback('Import unavailable — please reload.', true); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const p = JSON.parse(ev.target.result);
        if (!Array.isArray(p.transactions) || !Array.isArray(p.income)) {
          showFeedback('Invalid JSON file.', true); return;
        }
        setImporting(true);
        // Write every record to Firestore via the hook (handles optimistic UI + real write)
        await Promise.all([
          ...p.transactions.map((txn) => addTransaction(txn)),
          ...p.income.map((entry) => addIncome(entry)),
        ]);
        showFeedback(`Imported ${p.transactions.length} transactions & ${p.income.length} income entries to cloud!`);
      } catch (err) {
        showFeedback('Failed to parse or import JSON file.', true);
        console.error('[Import JSON]', err);
      } finally { setImporting(false); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // FIX: calls addTransaction / addIncome so CSV data goes straight to Firestore
  function handleCSVImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!addTransaction || !addIncome) { showFeedback('Import unavailable — please reload.', true); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text  = ev.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { showFeedback('CSV is empty.', true); return; }
        const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const col = (name) => header.indexOf(name);
        const dateCol = col('date') !== -1 ? col('date') : col('Date');
        const nameCol = col('name') !== -1 ? col('name') : col('description') !== -1 ? col('description') : col('Description');
        const amtCol  = col('amount') !== -1 ? col('amount') : col('Amount');
        const typeCol = col('type') !== -1 ? col('type') : col('Type');
        if (amtCol === -1 || nameCol === -1) {
          showFeedback('CSV must have "name"/"description" and "amount" columns.', true); return;
        }
        let added = 0;
        const newTxns = [], newInc = [];
        lines.slice(1).forEach(line => {
          const cols     = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const rawName  = cols[nameCol] || '';
          const rawAmount = parseFloat(cols[amtCol] || '0');
          const rawType  = (cols[typeCol] || 'expense').toLowerCase();
          const rawDate  = dateCol !== -1 ? cols[dateCol] : new Date().toISOString().slice(0, 10);
          if (!rawName || isNaN(rawAmount) || rawAmount <= 0) return;
          let isoDate;
          try { const d = new Date(rawDate); isoDate = isNaN(d) ? new Date().toISOString() : d.toISOString(); }
          catch { isoDate = new Date().toISOString(); }
          const month = isoDate.slice(0, 7);
          const id    = generateId();
          if (rawType === 'income') {
            newInc.push({ id, name: rawName, amount: rawAmount, type: 'income', date: isoDate, month });
          } else {
            const type = ['savings', 'person', 'expense'].includes(rawType) ? rawType : 'expense';
            newTxns.push({ id, name: rawName, amount: rawAmount, type, date: isoDate, month });
          }
          added++;
        });
        if (added === 0) { showFeedback('No valid rows found in CSV.', true); return; }
        setImporting(true);
        // Write every parsed record to Firestore via the hook
        await Promise.all([
          ...newTxns.map((txn) => addTransaction(txn)),
          ...newInc.map((entry) => addIncome(entry)),
        ]);
        showFeedback(`Imported ${added} records from CSV to cloud!`);
      } catch (err) {
        showFeedback('Failed to parse or import CSV.', true);
        console.error('[Import CSV]', err);
      } finally { setImporting(false); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ── Migrate localStorage → Firestore ── */
  async function handleMigrate() {
    if (!user?.uid) { showFeedback('You must be logged in to migrate.', true); return; }
    if (!window.confirm('Import all localStorage data into your cloud account?')) return;
    setMigrating(true);
    try {
      const result = await migrateFromLocalStorage(user.uid);
      showFeedback(`Migrated ${result.transactions} transactions & ${result.income} income entries to cloud!`);
    } catch (err) {
      showFeedback('Migration failed. See console.', true);
      console.error(err);
    } finally { setMigrating(false); }
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
    if (!addTransaction || !addIncome) { showFeedback('Please reload the app.', true); return; }
    setPulling(true);
    try {
      const result = await pullFromSheet(sheetUrl);
      if (!result.success) { showFeedback(result.message, true); return; }
      // Write every pulled record to Firestore via the hook
      await Promise.all([
        ...result.transactions.map((t) => addTransaction(t)),
        ...result.income.map((i) => addIncome(i)),
      ]);
      showFeedback(result.message);
      setServerOnline(true);
    } catch (err) {
      showFeedback(`Pull failed: ${err.message}`, true);
    } finally { setPulling(false); }
  }

  /* ── Theme ── */
  function toggleTheme() { onThemeChange(isMonoflow ? 'light' : 'monoflow'); }

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
              <ActionRow id="btn-export" Icon={Download} label="Export Data"    sub={`Download JSON — ${transactions.length} txns, ${income.length} income`} iconColor="var(--savings)" onClick={handleExport} />
              <ActionRow id="btn-import" Icon={Upload}   label={importing ? 'Importing…' : 'Import Data'}   sub="Restore from JSON backup file (writes to cloud)"          iconColor="var(--accent)"  onClick={() => !importing && fileInputRef.current?.click()} />
              <ActionRow id="btn-csv"    Icon={FileSpreadsheet} label={importing ? 'Importing…' : 'Import CSV'}  sub="Import .csv file (date,name,amount,type) → cloud"    iconColor="var(--income)"  onClick={() => !importing && csvInputRef.current?.click()} />
              <ActionRow id="btn-migrate" Icon={CloudUpload} label={migrating ? 'Migrating…' : 'Import Local → Cloud'} sub="One-time: push localStorage data to your cloud account" iconColor="var(--accent)" onClick={handleMigrate} />
              <ActionRow id="btn-purge-cf" Icon={RefreshCw} label="Remove Legacy Carry Forward" sub="One-time: delete old carry-forward income entries from cloud" iconColor="var(--person)" onClick={handlePurgeCarryForward} />
              <ActionRow id="btn-reset"  Icon={Trash2}   label="Reset All Data" sub="Permanently deletes all cloud + local data"      iconColor="var(--expense)" onClick={handleResetData} danger lastRow />
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Info size={18} style={{ color: 'var(--savings)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Expense Tracker v3.0</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Firebase · Real-time sync · PWA</div>
              </div>
            </div>
          </div>

        </div>
      </div>

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
