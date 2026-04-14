import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoginPage from './LoginPage';
import SignUpPage from './SignUpPage';

/* Full-screen spinner shown while Firebase checks auth state */
function LoadingScreen() {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
      }}>
        <Zap size={24} color="#fff" strokeWidth={2.5} />
      </div>
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
