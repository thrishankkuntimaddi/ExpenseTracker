import { useState } from 'react';
import { Lock, Zap } from 'lucide-react';

export default function LockScreen({ onUnlock, onWipe }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [attempts, setAttempts] = useState(0);

  function handleUnlock() {
    onUnlock(password, (success) => {
      if (success) {
        setPassword(''); setError('');
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 3) {
          onWipe();
        } else {
          setError(`Wrong password. ${3 - next} attempt${3 - next === 1 ? '' : 's'} remaining.`);
          setPassword('');
        }
      }
    });
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '0 24px',
      background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* App identity */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', marginBottom: 32, gap: 12,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
            <Zap size={36} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Expense Tracker
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
              Enter your password to continue
            </div>
          </div>
        </div>

        {/* Lock card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20, padding: 24,
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, gap: 8,
          }}>
            <Lock size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              App Locked
            </span>
          </div>

          <input
            id="lock-password-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: 12, fontSize: 16,
              letterSpacing: '0.12em',
              textAlign: 'center',
              border: `1.5px solid ${error ? 'var(--expense)' : 'var(--input-border)'}`,
              background: 'var(--input-bg)',
              color: 'var(--text)',
              outline: 'none', fontFamily: 'inherit',
              marginBottom: error ? 8 : 14,
              transition: 'border-color 0.15s',
            }}
          />

          {error && (
            <div style={{
              fontSize: 12, textAlign: 'center', marginBottom: 12,
              color: 'var(--expense)', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            id="btn-unlock"
            onClick={handleUnlock}
            disabled={!password}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: password ? 'var(--accent)' : 'var(--surface2)',
              color: password ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: password ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Unlock App
          </button>
        </div>

        <p style={{
          fontSize: 11, textAlign: 'center', marginTop: 16,
          color: 'var(--text-muted)',
        }}>
          3 failed attempts permanently wipe all data
        </p>
      </div>
    </div>
  );
}
