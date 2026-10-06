import { Plus, Loader2, ArrowLeft, Share2 } from 'lucide-react';

export default function BillingsHeader({ currentSession, saving, onBack, onShare, onNew, extra }) {
  return (
    <div className="tab-header">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: extra ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {currentSession && (
            <button
              onClick={onBack}
              style={{
                width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--surface2)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              {currentSession ? currentSession.name : 'Billings'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Proxy spending ledger · track group bills on behalf of others
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Saving…
            </div>
          )}
          {currentSession && (
            <button
              onClick={onShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 10,
                fontSize: 11, fontWeight: 700,
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <Share2 size={13} /> Share Session
            </button>
          )}
          {!currentSession && (
            <button
              onClick={onNew}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 10,
                fontSize: 11, fontWeight: 700,
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <Plus size={13} /> New Billing
            </button>
          )}
        </div>
      </div>
      {extra}
    </div>
  );
}
