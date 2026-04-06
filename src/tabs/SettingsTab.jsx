import { useState, useRef } from 'react';
import { Download, Upload, Trash2, Lock, Unlock, Info, ChevronRight } from 'lucide-react';
import { loadState, saveState, clearState } from '../utils/storage';

export default function SettingsTab({ onDataChange, onLockChange, settings }) {
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback]               = useState(null);
  const fileInputRef = useRef(null);

  function showFeedback(msg, isError = false) {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3000);
  }

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
    a.href = url; a.download = `expense-tracker-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    showFeedback('Exported successfully.');
  }

  function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        if (!Array.isArray(p.transactions) || !Array.isArray(p.income)) { showFeedback('Invalid file.', true); return; }
        saveState(p); onDataChange({ transactions: p.transactions, income: p.income });
        showFeedback('Data imported!');
      } catch { showFeedback('Failed to parse file.', true); }
    };
    reader.readAsText(file); e.target.value = '';
  }

  function handleSetPassword() {
    if (!newPassword || newPassword.length < 4) { showFeedback('Password ≥ 4 characters.', true); return; }
    if (newPassword !== confirmPassword)         { showFeedback('Passwords do not match.', true); return; }
    const s = loadState();
    s.settings = { ...s.settings, password: newPassword, failedAttempts: 0, locked: false };
    saveState(s); onLockChange({ password: newPassword, failedAttempts: 0, locked: false });
    setNewPassword(''); setConfirmPassword('');
    showFeedback('Password set!');
  }

  function handleRemovePassword() {
    if (!window.confirm('Remove password lock?')) return;
    const s = loadState();
    s.settings = { ...s.settings, password: null, failedAttempts: 0, locked: false };
    saveState(s); onLockChange({ password: null, failedAttempts: 0, locked: false });
    showFeedback('Password removed.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Manage data & security</p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="settings-layout">

          {/* Column 1 */}
          <div style={{ padding: '20px 24px', flex: 1, minWidth: 0 }}>

            {/* Feedback */}
            {feedback && (
              <div style={{
                padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600,
                background: feedback.isError ? 'var(--expense-bg)' : 'var(--income-bg)',
                border: `1px solid ${feedback.isError ? 'var(--expense-border)' : 'var(--income-border)'}`,
                color: feedback.isError ? 'var(--expense)' : 'var(--income)',
              }}>
                {feedback.msg}
              </div>
            )}

            <SectionLabel>Data Management</SectionLabel>
            <Card>
              <ActionRow id="btn-export" Icon={Download} label="Export Data"    sub="Download JSON backup"          iconColor="var(--savings)" onClick={handleExport} />
              <ActionRow id="btn-import" Icon={Upload}   label="Import Data"    sub="Restore from JSON file"        iconColor="var(--accent)"  onClick={() => fileInputRef.current?.click()} />
              <ActionRow id="btn-reset"  Icon={Trash2}   label="Reset All Data" sub="Permanently clears everything" iconColor="var(--expense)" onClick={handleResetData} danger />
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </Card>
          </div>

          {/* Column 2 */}
          <div style={{ padding: '20px 24px', flex: 1, minWidth: 0 }}>

            <SectionLabel>Security</SectionLabel>
            <Card>
              {settings.password ? (
                <>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={16} style={{ color: 'var(--income)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--income)' }}>Password active</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>3 wrong attempts wipes all data</div>
                    </div>
                  </div>
                  <ActionRow id="btn-remove-password" Icon={Unlock} label="Remove Password" sub="Disable lock" iconColor="var(--person)" onClick={handleRemovePassword} />
                </>
              ) : (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>Set Password Lock</p>
                  <input
                    id="settings-new-password"
                    type="password"
                    placeholder="New Password (min 4 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', marginBottom: 10, transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <input
                    id="settings-confirm-password"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', marginBottom: 14, transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <button
                    id="btn-set-password"
                    onClick={handleSetPassword}
                    disabled={!newPassword || !confirmPassword}
                    style={{ width: '100%', padding: 13, borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!newPassword || !confirmPassword) ? 0.4 : 1, fontFamily: 'inherit' }}
                  >
                    Set Password Lock
                  </button>
                </div>
              )}
            </Card>

            {/* About */}
            <div style={{ marginTop: 16, background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Info size={18} style={{ color: 'var(--savings)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Expense Tracker v1.0</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>All data stored locally on your device</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .settings-layout { display: flex; align-items: flex-start; }
        }
        @media (max-width: 1023px) {
          .settings-layout { display: block; }
          .settings-layout > div:last-child { padding-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
      {children}
    </p>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function ActionRow({ id, Icon, label, sub, iconColor, onClick, danger }) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
        textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
      className="settings-row"
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: danger ? 'var(--expense)' : 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}
