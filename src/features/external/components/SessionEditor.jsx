// ─── Billing session editor (metadata, both tables, summary + actions) ──
import { CheckCircle2, ShoppingBag, User, Save, Share2 } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import EditableRowsTable from './EditableRowsTable';

export default function SessionEditor({
  sessionName, sessionDate, onNameChange, onDateChange,
  items, received, totalSpent, totalReceived, netBalance,
  onAddItem, onUpdateItem, onRemoveItem, onReorderItems,
  onAddReceived, onUpdateReceived, onRemoveReceived, onReorderReceived,
  canClose, onDiscard, onShare, onSaveDraft, onRequestClose,
}) {
  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;

  return (
    <div>
      {/* Session Metadata Controls (Name & Date) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
        marginBottom: 18, background: 'var(--surface)', padding: 14,
        borderRadius: 14, border: '1px solid var(--border)',
      }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Session Name
          </label>
          <input
            type="text"
            value={sessionName}
            onChange={e => onNameChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              border: '1.5px solid var(--input-border)', background: 'var(--input-bg)',
              color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Transaction Date
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={e => onDateChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
              border: '1.5px solid var(--input-border)', background: 'var(--input-bg)',
              color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div className="external-grid">
        {/* Goods Purchased Table */}
        <EditableRowsTable
          Icon={ShoppingBag} title="Goods Purchased" tone="expense"
          nameHeader="Item Name" field="name" placeholder="Item description"
          totalLabel="Total Spent" total={totalSpent}
          rows={items} onAdd={onAddItem} onUpdate={onUpdateItem}
          onRemove={onRemoveItem} onReorder={onReorderItems}
        />

        {/* Money Received Table */}
        <EditableRowsTable
          Icon={User} title="Money Received" tone="income"
          nameHeader="Person Name" field="person" placeholder="Person name"
          totalLabel="Total Received" total={totalReceived}
          rows={received} onAdd={onAddReceived} onUpdate={onUpdateReceived}
          onRemove={onRemoveReceived} onReorder={onReorderReceived}
        />
      </div>

      {/* Live Summary Bar & Actions */}
      <div style={{
        marginTop: 20,
        background: isProfit ? 'var(--income-bg)' : isLoss ? 'var(--expense-bg)' : 'var(--surface2)',
        border: `1.5px solid ${isProfit ? 'var(--income-border)' : isLoss ? 'var(--expense-border)' : 'var(--border)'}`,
        borderRadius: 16, padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
      }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>Received</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--income)' }}>{formatAmount(totalReceived)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>Spent</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--expense)' }}>{formatAmount(totalSpent)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>Net Balance</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--text-muted)' }}>
              {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onDiscard} style={{
            padding: '9px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
            background: 'var(--surface2)', color: 'var(--expense)', border: '1px solid var(--border)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Discard
          </button>
          <button onClick={onShare} style={{
            padding: '9px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
            background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Share2 size={13} /> Share
          </button>
          <button onClick={onSaveDraft} style={{
            padding: '9px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
            background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Save size={13} /> Save Draft
          </button>
          <button
            onClick={onRequestClose}
            disabled={!canClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 11,
              background: canClose ? 'var(--accent)' : 'var(--surface2)',
              color: canClose ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: canClose ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            }}
          >
            <CheckCircle2 size={15} /> Close Billing
          </button>
        </div>
      </div>
    </div>
  );
}
