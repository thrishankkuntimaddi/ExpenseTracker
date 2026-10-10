import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/* Last line of defence: a crash anywhere below shows a way out instead of
   a blank page. Your data is safe in your account (and the offline cache),
   so reloading is always the right move. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info?.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: 22, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--expense-bg)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--expense)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Something went wrong</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '8px 0 16px' }}>
            Your data is safe in your account. Reloading the app fixes this in almost every case.
          </p>
          <button onClick={() => window.location.reload()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            <RotateCcw size={15} /> Reload
          </button>
          <details style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
