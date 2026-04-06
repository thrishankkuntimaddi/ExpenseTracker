import { useState, useRef } from 'react';
import { Download, Upload, Trash2, Lock, Unlock, Info, ChevronRight } from 'lucide-react';
import { loadState, saveState, clearState } from '../utils/storage';

export default function SettingsTab({ onDataChange, onLockChange, settings }) {
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState(null);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Data exported successfully.');
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.income)) {
          showFeedback('Invalid file format.', true); return;
        }
        saveState(parsed);
        onDataChange({ transactions: parsed.transactions, income: parsed.income });
        showFeedback('Data imported successfully!');
      } catch { showFeedback('Failed to parse file.', true); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleSetPassword() {
    if (!newPassword || newPassword.length < 4) {
      showFeedback('Password must be at least 4 characters.', true); return;
    }
    if (newPassword !== confirmPassword) {
      showFeedback('Passwords do not match.', true); return;
    }
    const state = loadState();
    state.settings = { ...state.settings, password: newPassword, failedAttempts: 0, locked: false };
    saveState(state);
    onLockChange({ password: newPassword, failedAttempts: 0, locked: false });
    setNewPassword(''); setConfirmPassword('');
    showFeedback('Password set! App will lock on next open.');
  }

  function handleRemovePassword() {
    if (!window.confirm('Remove password lock?')) return;
    const state = loadState();
    state.settings = { ...state.settings, password: null, failedAttempts: 0, locked: false };
    saveState(state);
    onLockChange({ password: null, failedAttempts: 0, locked: false });
    showFeedback('Password removed.');
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Settings</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Manage data & security</p>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="mx-5 mb-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: feedback.isError ? 'var(--expense-bg)' : 'var(--income-bg)',
            border: `1px solid ${feedback.isError ? 'var(--expense-border)' : 'var(--income-border)'}`,
            color: feedback.isError ? 'var(--expense)' : 'var(--income)',
          }}>
          {feedback.msg}
        </div>
      )}

      <div className="px-5 pb-8 flex flex-col gap-5">
        {/* Data Management */}
        <Section title="Data Management">
          <ActionRow id="btn-export" Icon={Download} label="Export Data"     sub="Download JSON backup"           iconColor="var(--savings)" onClick={handleExport} />
          <ActionRow id="btn-import" Icon={Upload}   label="Import Data"     sub="Restore from JSON file"         iconColor="var(--accent)"  onClick={() => fileInputRef.current?.click()} />
          <ActionRow id="btn-reset"  Icon={Trash2}   label="Reset All Data"  sub="Permanently clears everything"  iconColor="var(--expense)" onClick={handleResetData} danger />
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </Section>

        {/* Lock System */}
        <Section title="Security">
          {settings.password ? (
            <>
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--income-bg)' }}>
                  <Lock size={16} style={{ color: 'var(--income)' }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--income)' }}>Password is active</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>3 wrong attempts wipes all data</div>
                </div>
              </div>
              <ActionRow id="btn-remove-password" Icon={Unlock} label="Remove Password" sub="Disable lock protection" iconColor="var(--person)" onClick={handleRemovePassword} />
            </>
          ) : (
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Set Password Lock</p>
              <input
                id="settings-new-password"
                type="password"
                placeholder="New Password (min 4 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-2 transition-all"
                style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
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
                className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4 transition-all"
                style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                id="btn-set-password"
                onClick={handleSetPassword}
                disabled={!newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff', minHeight: 44 }}
              >
                Set Password Lock
              </button>
            </div>
          )}
        </Section>

        {/* About */}
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--savings-bg)' }}>
            <Info size={18} style={{ color: 'var(--savings)' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Expense Tracker</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>v1.0 · All data is stored locally on your device</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {children}
      </div>
    </div>
  );
}

function ActionRow({ id, Icon, label, sub, iconColor, onClick, danger }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-[var(--border)] last:border-0"
      style={{ background: 'transparent' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconColor + '18' }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: danger ? 'var(--expense)' : 'var(--text)' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}
