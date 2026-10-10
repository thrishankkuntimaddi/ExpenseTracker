import { CheckCircle2, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import Portal from '../../../components/Portal';

/* ─── Confirmation Modal for Closing ─── */
export default function ConfirmCloseModal({ totalReceived, totalSpent, netBalance, sessionName, persons, onConfirm, onCancel, loading }) {
  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;
  const isEven   = netBalance === 0;

  return (
    <Portal>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1600,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 20, padding: '24px 24px 20px', maxWidth: 420, width: '100%',
          boxShadow: 'var(--shadow-md)', animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: isProfit ? 'var(--income-bg)' : isLoss ? 'var(--expense-bg)' : 'var(--accent-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isProfit ? <TrendingUp size={20} style={{ color: 'var(--income)' }} />
                : isLoss ? <TrendingDown size={20} style={{ color: 'var(--expense)' }} />
                : <CheckCircle2 size={20} style={{ color: 'var(--accent)' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Close Billing Session?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sessionName}</div>
            </div>
          </div>

          {/* Summary rows */}
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Total Received', value: totalReceived, color: 'var(--income)' },
              { label: 'Total Spent',    value: totalSpent,    color: 'var(--expense)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{formatAmount(value)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>Net Balance</span>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--accent)',
              }}>
                {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
              </span>
            </div>
          </div>

          <div style={{
            background: isProfit ? 'var(--income-bg)' : isLoss ? 'var(--expense-bg)' : 'var(--accent-bg)',
            border: `1px solid ${isProfit ? 'var(--income-border)' : isLoss ? 'var(--expense-border)' : 'var(--accent-border)'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12,
            color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--accent)',
            fontWeight: 600,
          }}>
            {isProfit && `✓ ₹${netBalance.toFixed(2)} will be added to Income (from ${persons})`}
            {isLoss   && `✓ ₹${Math.abs(netBalance).toFixed(2)} will be added to Expenses (External – ${persons})`}
            {isEven   && `✓ Perfectly settled. No income or expense entry will be created.`}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} disabled={loading} style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading} style={{
              flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--external)',
              color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
              Confirm & Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
