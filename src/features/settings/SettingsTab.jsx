import { useState, useRef } from 'react';
import {
  Download, Upload, Trash2, Info,
  ChevronRight, Moon, Sun, FileSpreadsheet,
  Database, Palette, LogOut, Link, RefreshCw, CloudUpload,
} from 'lucide-react';
import { loadState, saveState, clearState, generateId } from '../../utils/storage';
import { migrateFromLocalStorage, updateSettings as fsUpdateSettings } from '../../services/firestore';
import { pushToSheet } from '../../services/googleSheets';

export default function SettingsTab({
  onDataChange, onLockChange, onThemeChange, onSignOut,
  settings, theme, user,
}) {
  const [feedback, setFeedback]       = useState(null);
  const [sheetUrl, setSheetUrl]       = useState(settings?.googleSheetUrl || '');
  const [migrating, setMigrating]     = useState(false);
  const fileInputRef = useRef(null);
  const csvInputRef  = useRef(null);
  const isMonoflow   = theme === 'monoflow';

  function showFeedback(msg, isError = false) {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 4000);
  }

  /* ── Data ── */
  function handleResetData() {
    if (!window.confirm('Reset ALL data? This cannot be undone.')) return;
    clearState();
    onDataChange({ transactions: [], income: [] });
    showFeedback('All data cleared.');
  }

  function handleExport() {
    const state = loadState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Exported successfully.');
  }

  function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        if (!Array.isArray(p.transactions) || !Array.isArray(p.income)) {
          showFeedback('Invalid JSON file.', true); return;
        }
        saveState(p);
        onDataChange({ transactions: p.transactions, income: p.income });
        showFeedback(`Imported ${p.transactions.length} transactions & ${p.income.length} income entries!`);
      } catch { showFeedback('Failed to parse JSON file.', true); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleCSVImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text  = ev.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { showFeedback('CSV is empty.', true); return; }
        const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const col = name => header.indexOf(name);
        const dateCol = col('date') !== -1 ? col('date') : col('Date');
        const nameCol = col('name') !== -1 ? col('name') : col('description') !== -1 ? col('description') : col('Description');
        const amtCol  = col('amount') !== -1 ? col('amount') : col('Amount');
        const typeCol = col('type') !== -1 ? col('type') : col('Type');
        if (amtCol === -1 || nameCol === -1) { showFeedback('CSV must have "name"/"description" and "amount" columns.', true); return; }
        const state = loadState();
        let added = 0;
        const newTxns = [], newInc = [];
        lines.slice(1).forEach(line => {
          const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const rawName = cols[nameCol] || '';
          const rawAmount = parseFloat(cols[amtCol] || '0');
          const rawType = (cols[typeCol] || 'expense').toLowerCase();
          const rawDate = dateCol !== -1 ? cols[dateCol] : new Date().toISOString().slice(0, 10);
          if (!rawName || isNaN(rawAmount) || rawAmount <= 0) return;
          let isoDate;
          try { const d = new Date(rawDate); isoDate = isNaN(d) ? new Date().toISOString() : d.toISOString(); }
          catch { isoDate = new Date().toISOString(); }
          const month = isoDate.slice(0, 7);
          const id = generateId();
          if (rawType === 'income') { newInc.push({ id, name: rawName, amount: rawAmount, type: 'income', date: isoDate, month }); }
          else { const type = ['savings', 'person', 'expense'].includes(rawType) ? rawType : 'expense'; newTxns.push({ id, name: rawName, amount: rawAmount, type, date: isoDate, month, wasteAmount: undefined }); }
          added++;
        });
        const mergedTxns = [...state.transactions, ...newTxns];
        const mergedInc  = [...state.income, ...newInc];
        saveState({ ...state, transactions: mergedTxns, income: mergedInc });
        onDataChange({ transactions: mergedTxns, income: mergedInc });
        showFeedback(`Imported ${added} records from CSV!`);
      } catch (err) { showFeedback('Failed to parse CSV.', true); console.error(err); }
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
      await fsUpdateSettings(user.uid, { ...settings, googleSheetUrl: sheetUrl.trim() });
      showFeedback('Google Sheet linked!');
    } catch { showFeedback('Failed to save sheet URL.', true); }
  }

  async function handleSyncSheet() {
    const result = await pushToSheet(sheetUrl, loadState());
    showFeedback(result.message || 'Coming soon — Google Sheets sync will be enabled in the next update.');
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
              <ActionRow id="btn-export" Icon={Download} label="Export Data"    sub="Download JSON backup"                            iconColor="var(--savings)" onClick={handleExport} />
              <ActionRow id="btn-import" Icon={Upload}   label="Import Data"    sub="Restore from JSON file"                          iconColor="var(--accent)"  onClick={() => fileInputRef.current?.click()} />
              <ActionRow id="btn-csv"    Icon={FileSpreadsheet} label="Link Excel Sheet" sub="Import from .csv file (date,name,amount,type)" iconColor="var(--income)"  onClick={() => csvInputRef.current?.click()} />
              <ActionRow id="btn-migrate" Icon={CloudUpload} label={migrating ? 'Migrating…' : 'Import Local → Cloud'} sub="One-time: push localStorage data to your cloud account" iconColor="var(--accent)" onClick={handleMigrate} />
              <ActionRow id="btn-reset"  Icon={Trash2}   label="Reset All Data" sub="Permanently clears everything"                  iconColor="var(--expense)" onClick={handleResetData} danger lastRow />
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
                <p className="section-label" style={{ marginBottom: 10 }}>Link Your Google Sheet</p>
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button id="btn-save-sheet" onClick={handleSaveSheetUrl} style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: 'var(--income)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Link Sheet
                  </button>
                  <button id="btn-sync-sheet" onClick={handleSyncSheet} style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <RefreshCw size={12} /> Sync Now
                  </button>
                </div>
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                  🔜 Full Google Sheets sync coming soon. Link your sheet now to be ready.
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
