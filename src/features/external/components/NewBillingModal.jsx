import { useState } from 'react';
import { Plus, X, ReceiptText, Calendar, PenLine } from 'lucide-react';
import { todayInputValue } from '../../../utils/dateHelpers';
import Portal from '../../../components/Portal';

/* ─── New Billing Modal ─── */
export default function NewBillingModal({ onCreate, onCancel }) {
  const [name, setName]       = useState('');
  const [dateStr, setDateStr] = useState(todayInputValue());

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), dateStr);
  }

  return (
    <Portal>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1.5px solid var(--external-border)',
          borderRadius: 20, padding: '24px 24px 20px', maxWidth: 400, width: '100%',
          boxShadow: 'var(--shadow-md)',
          animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--accent-border)',
              }}>
                <ReceiptText size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>New Billing Session</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Create a workspace for proxy spending</div>
              </div>
            </div>
            <button onClick={onCancel} style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--surface2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <X size={14} />
            </button>
          </div>

          {/* Session Name */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <PenLine size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Session Name (e.g. Bike Purchase, Family Trip)"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
                borderRadius: 10, fontSize: 14, border: '1.5px solid var(--input-border)',
                background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Transaction Date */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', pointerEvents: 'none' }} />
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
                borderRadius: 10, fontSize: 13, border: '1.5px solid var(--input-border)',
                background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim()} style={{
              flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: name.trim() ? 'var(--accent)' : 'var(--surface2)',
              color: name.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Plus size={15} />Create Session
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
