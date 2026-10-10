import { useState } from 'react';
import {
  Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2,
  Wallet, ReceiptText, Map as MapIcon, Target,
} from 'lucide-react';

/* One screen for every signed-out state:
   'login' | 'signup' | 'reset' (forgot password).
   Wide screens show a brand panel beside the card; phones show the card. */

const FEATURES = [
  { Icon: Wallet,      title: 'Every rupee in one place', text: 'expenses, income and savings, auto-categorised' },
  { Icon: Target,      title: 'Budgets that pace you',    text: 'a daily “safe to spend” and gentle alerts' },
  { Icon: ReceiptText, title: 'Billings',                 text: 'money spent for others, settled later' },
  { Icon: MapIcon,     title: 'Trips & splits',           text: 'who paid what, and a fair who-pays-whom plan' },
];

export default function AuthScreen({
  onSignIn, onSignUp, onGoogle, onResetPassword,
  error, setError, loading,
  googleAvailable = true,   // false inside the Android / desktop apps until native Google sign-in lands
}) {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [localError, setLocalError] = useState(null);
  const [resetSentTo, setResetSentTo] = useState(null);

  const go = (next) => { setMode(next); setLocalError(null); setError?.(null); setResetSentTo(null); setPassword(''); setConfirm(''); };
  const shownError = localError || error;

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError(null);
    const em = email.trim();
    if (!em) { setLocalError('Enter your email address.'); return; }
    try {
      if (mode === 'reset') {
        await onResetPassword(em);
        setResetSentTo(em);
      } else if (mode === 'signup') {
        if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
        if (password !== confirm) { setLocalError('Passwords don’t match.'); return; }
        await onSignUp(em, password);
      } else {
        if (!password) { setLocalError('Enter your password.'); return; }
        await onSignIn(em, password);
      }
    } catch { /* message already set by useAuth */ }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
  const subtitle = mode === 'signup' ? 'Takes a few seconds — your data syncs across devices.'
    : mode === 'reset' ? 'We’ll email you a link to choose a new password.'
    : 'Sign in to pick up where you left off.';
  const submitLabel = loading
    ? (mode === 'signup' ? 'Creating account…' : mode === 'reset' ? 'Sending…' : 'Signing in…')
    : (mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in');

  return (
    <div className="auth-root" style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg)' }}>
      {/* ── Brand panel (wide screens) ── */}
      <aside className="auth-brand" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: '48px 56px', borderRight: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 460 }}>
          <Brand size={44} />
          <h1 style={{ fontSize: 40, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: '36px 0 28px' }}>
            Know where your money goes.<br />
            <span style={{ background: 'linear-gradient(90deg, var(--accent), var(--savings), var(--income))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Every rupee, accounted for.
            </span>
          </h1>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map(({ Icon, title: t, text }) => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{t}</strong> — {text}
                </span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 32 }}>Private to you · Works offline · Syncs across your devices</p>
        </div>
      </aside>

      {/* ── Card ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))' }}>
        <div className="auth-compact-brand" style={{ marginBottom: 24 }}><Brand size={40} /></div>

        <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', padding: '22px 22px 26px' }}>
          {/* Top row: back (reset) or Log in / Create account switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: mode === 'reset' ? 'flex-start' : 'flex-end', marginBottom: 18, minHeight: 36 }}>
            {mode === 'reset' ? (
              <button type="button" id="btn-auth-back" onClick={() => go('login')} style={linkBtn}>
                <ArrowLeft size={14} /> Back to log in
              </button>
            ) : (
              <div role="tablist" aria-label="Account" style={{ display: 'flex', padding: 3, borderRadius: 99, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                {[['login', 'Log in'], ['signup', 'Create account']].map(([key, label]) => (
                  <button key={key} id={`auth-tab-${key}`} type="button" role="tab" aria-selected={mode === key} onClick={() => mode !== key && go(key)}
                    style={{ padding: '7px 14px', border: 'none', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: mode === key ? 'var(--surface)' : 'transparent', color: mode === key ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: mode === key ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.12))' : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 20px', lineHeight: 1.5 }}>{subtitle}</p>

          {shownError && (
            <div role="alert" style={{ padding: '11px 14px', borderRadius: 10, marginBottom: 16, background: 'var(--expense-bg)', border: '1px solid var(--expense-border)', color: 'var(--expense)', fontSize: 13, fontWeight: 500, lineHeight: 1.45 }}>
              {shownError}
            </div>
          )}

          {mode === 'reset' && resetSentTo ? (
            <div role="status" style={{ display: 'flex', gap: 10, padding: '14px', borderRadius: 12, background: 'var(--income-bg)', border: '1px solid var(--income-border)', color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>
              <CheckCircle2 size={18} style={{ color: 'var(--income)', flexShrink: 0, marginTop: 1 }} />
              <span>If an account exists for <strong>{resetSentTo}</strong>, a reset link is on its way. Check your spam folder too — the link works once and expires in an hour.</span>
            </div>
          ) : (
            <>
              {mode !== 'reset' && (
                <>
                  {googleAvailable ? (
                  <button type="button" id="btn-google" onClick={onGoogle} disabled={loading}
                    style={{ width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
                      background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <GoogleMark /> Continue with Google
                  </button>
                  ) : (
                    <div id="google-unavailable" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      <GoogleMark />
                      <span>Google sign-in isn’t available in this app version yet. Use your email and password here, or Continue with Google on the website.</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or with email</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <Field label="Email" htmlFor="auth-email">
                  <InputIcon Icon={Mail} />
                  <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" inputMode="email" required style={inputStyle(false)} />
                </Field>

                {mode !== 'reset' && (
                  <Field label="Password" htmlFor="auth-password"
                    aside={mode === 'login' && (
                      <button type="button" id="btn-forgot" onClick={() => go('reset')} style={{ ...linkBtn, fontSize: 12 }}>Forgot password?</button>
                    )}>
                    <InputIcon Icon={Lock} />
                    <input id="auth-password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required style={inputStyle(true)} />
                    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                )}

                {mode === 'signup' && (
                  <>
                    <Field label="Confirm password" htmlFor="auth-confirm">
                      <InputIcon Icon={Lock} />
                      <input id="auth-confirm" type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter password" autoComplete="new-password" required style={inputStyle(false)} />
                    </Field>
                    <PasswordHint password={password} confirm={confirm} />
                  </>
                )}

                <button id="btn-auth-submit" type="submit" disabled={loading}
                  style={{ width: '100%', marginTop: 6, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    background: 'var(--accent)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {submitLabel}{!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}

          {mode === 'signup' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '14px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
              We’ll send a link to verify your email. You can start using the app right away.
            </p>
          )}
        </div>
      </main>

      <style>{`
        .auth-brand { display: none; }
        @media (min-width: 900px) {
          .auth-brand { display: flex; }
          .auth-compact-brand { display: none; }
        }
      `}</style>
    </div>
  );
}

function Brand({ size }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width={size} height={size}
        style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: 'cover', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Expense Tracker</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Financial Command Center</div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, aside, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
        {aside}
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

function InputIcon({ Icon }) {
  return <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />;
}

const inputStyle = (hasToggle) => ({
  width: '100%', padding: `12px ${hasToggle ? 42 : 14}px 12px 38px`, borderRadius: 11, fontSize: 15,
  border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
});

const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6,
};

/* Light-touch guidance — only length is enforced (Firebase's minimum). */
function PasswordHint({ password, confirm }) {
  if (!password) return null;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const strength = password.length < 6 ? 0 : password.length >= 12 && variety >= 3 ? 3 : password.length >= 8 && variety >= 2 ? 2 : 1;
  const labels = ['Too short', 'Okay', 'Good', 'Strong'];
  const colors = ['var(--expense)', 'var(--lent, #D97706)', 'var(--savings)', 'var(--income)'];
  return (
    <div style={{ margin: '-4px 0 14px' }} aria-live="polite">
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: strength >= i ? colors[strength] : 'var(--border)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 5, color: 'var(--text-muted)' }}>
        <span style={{ color: colors[strength], fontWeight: 600 }}>{labels[strength]}</span>
        {confirm && <span style={{ color: confirm === password ? 'var(--income)' : 'var(--expense)' }}>{confirm === password ? 'Passwords match' : 'Passwords don’t match'}</span>}
      </div>
    </div>
  );
}

/* Google's four-colour "G" — required on Google sign-in buttons by its branding guidelines. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
