import { useState } from 'react';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';

export default function SignUpPage({ onSignUp, onGoLogin, error, loading }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [localErr, setLocalErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalErr('');
    if (password.length < 6) { setLocalErr('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setLocalErr('Passwords do not match.'); return; }
    await onSignUp(email.trim(), password);
  }

  const displayError = localErr || error;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'var(--income)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(22,163,74,0.30)',
          }}>
            <Zap size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
            Create Account
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Start tracking your finances
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 20,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', padding: '28px 24px',
        }}>
          {displayError && (
            <div style={{
              padding: '11px 14px', borderRadius: 10, marginBottom: 18,
              background: 'var(--expense-bg)', border: '1px solid var(--expense-border)',
              color: 'var(--expense)', fontSize: 13, fontWeight: 500,
            }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email</span>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="signup-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" required
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 11, fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--input-border)')}
                />
              </div>
            </label>

            {/* Password */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</span>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="signup-password" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" autoComplete="new-password" required
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 42, paddingTop: 12, paddingBottom: 12, borderRadius: 11, fontSize: 14, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--input-border)')}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {/* Confirm */}
            <label style={{ display: 'block', marginBottom: 22 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Confirm Password</span>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="signup-confirm" type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password" autoComplete="new-password" required
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 42, paddingTop: 12, paddingBottom: 12, borderRadius: 11, fontSize: 14, border: `1.5px solid ${confirm && confirm === password ? 'var(--income)' : 'var(--input-border)'}`, background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--income)')}
                  onBlur={e  => (e.target.style.borderColor = confirm && confirm === password ? 'var(--income)' : 'var(--input-border)')}
                />
                {confirm && confirm === password && (
                  <Check size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--income)', pointerEvents: 'none' }} />
                )}
              </div>
            </label>

            <button id="btn-signup" type="submit" disabled={loading || !email || !password || !confirm}
              style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: email && password && confirm && !loading ? 'var(--income)' : 'var(--surface2)', color: email && password && confirm && !loading ? '#fff' : 'var(--text-muted)', border: 'none', cursor: email && password && confirm && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button id="btn-go-login" onClick={onGoLogin}
            style={{ width: '100%', padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            <ArrowLeft size={14} /> Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
