import { useState } from 'react';
import { Lock } from 'lucide-react';

export default function LockScreen({ onUnlock, onWipe }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  function handleUnlock() {
    onUnlock(password, (success) => {
      if (success) {
        setPassword(''); setError('');
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 3) { onWipe(); }
        else {
          setError(`Wrong password. ${3 - next} attempt${3 - next === 1 ? '' : 's'} remaining.`);
          setPassword('');
        }
      }
    });
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--savings-bg)', boxShadow: 'var(--shadow-md)' }}>
            <Lock size={36} style={{ color: 'var(--savings)' }} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-1" style={{ color: 'var(--text)' }}>App Locked</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>Enter your password to continue</p>

        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <input
            id="lock-password-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3 text-center tracking-widest transition-all"
            style={{
              background: 'var(--surface2)',
              border: `1.5px solid ${error ? 'var(--expense)' : 'var(--border)'}`,
              color: 'var(--text)',
            }}
          />
          {error && (
            <div className="text-xs text-center mb-3" style={{ color: 'var(--expense)' }}>{error}</div>
          )}
          <button
            id="btn-unlock"
            onClick={handleUnlock}
            disabled={!password}
            className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff', minHeight: 48 }}
          >
            Unlock
          </button>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
          3 failed attempts permanently wipe all data.
        </p>
      </div>
    </div>
  );
}
