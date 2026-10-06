import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { firebaseConfigError } from '../../services/firebase';
import LoginPage from './LoginPage';
import SignUpPage from './SignUpPage';

/* Shown when the bundle was built without VITE_FIREBASE_* — better than a stuck splash */
function SetupRequired() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--expense-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} style={{ color: 'var(--expense)' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Setup required</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The app started, but it has no backend configuration.</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{firebaseConfigError}</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
          Nothing is wrong with your data — this build simply cannot reach it. See <code>SECURITY.md</code> and <code>.env.example</code> in the repository.
        </p>
      </div>
    </div>
  );
}

/* Full-screen spinner shown while Firebase checks auth state */
function LoadingScreen() {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 16,
    }}>
      <img
        src={import.meta.env.BASE_URL + 'Expense.png'}
        alt="Expense Tracker Logo"
        style={{
          width: 52, height: 52, borderRadius: 14,
          objectFit: 'cover',
          boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
        }}
      />
      <div style={{
        width: 36, height: 4, borderRadius: 99,
        background: 'var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          width: '60%', height: '100%', borderRadius: 99,
          background: 'var(--accent)',
          animation: 'authSlide 1.2s ease-in-out infinite alternate',
        }} />
      </div>
      <style>{`
        @keyframes authSlide {
          from { transform: translateX(-20px); }
          to   { transform: translateX(20px); }
        }
      `}</style>
    </div>
  );
}

/**
 * AuthGate wraps the whole app.
 * - loading  → spinner
 * - !user    → Login / SignUp
 * - user     → children
 */
export default function AuthGate({ children }) {
  const { user, loading, signIn, signUp, signOut, error, setError } = useAuth();
  const [page, setPage] = useState('login'); // 'login' | 'signup'
  const [authLoading, setAuthLoading] = useState(false);

  if (firebaseConfigError) return <SetupRequired />;
  if (loading || user === undefined) return <LoadingScreen />;

  if (!user) {
    async function handleSignIn(email, password) {
      setAuthLoading(true);
      try { await signIn(email, password); }
      finally { setAuthLoading(false); }
    }
    async function handleSignUp(email, password) {
      setAuthLoading(true);
      try { await signUp(email, password); }
      finally { setAuthLoading(false); }
    }

    if (page === 'signup') {
      return (
        <SignUpPage
          onSignUp={handleSignUp}
          onGoLogin={() => { setError(null); setPage('login'); }}
          error={error}
          loading={authLoading}
        />
      );
    }
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onGoSignUp={() => { setError(null); setPage('signup'); }}
        error={error}
        loading={authLoading}
      />
    );
  }

  // Inject signOut into children via cloneElement
  return children({ user, signOut });
}
