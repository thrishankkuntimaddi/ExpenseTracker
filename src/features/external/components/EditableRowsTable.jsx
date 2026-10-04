// ─── Editable two-column table (name/person + amount) ────────────
// Used twice in the session editor: goods purchased and money received.
import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';

const tableStyle = {
  border: '1px solid var(--border)', borderRadius: 14,
  overflow: 'hidden', background: 'var(--surface)',
  boxShadow: 'var(--shadow-sm)',
};
const thStyle = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-muted)', background: 'var(--surface2)',
  textAlign: 'left', borderBottom: '1px solid var(--border)',
};
const inputStyle = {
  width: '100%', border: 'none', background: 'transparent',
  color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
  fontWeight: 500, outline: 'none', padding: '9px 11px',
};

/**
 * @param tone        CSS colour token: 'expense' | 'income'
 * @param field       row key edited by the text column: 'name' | 'person'
 */
export default function EditableRowsTable({
  Icon, title, tone, nameHeader, field, placeholder, totalLabel, total,
  rows, onAdd, onUpdate, onRemove, onReorder,
}) {
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={15} style={{ color: `var(--${tone})` }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            {title}
          </span>
        </div>
        <button onClick={onAdd} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          background: `var(--${tone}-bg)`, color: `var(--${tone})`,
          border: `1px solid var(--${tone}-border)`, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={11} /> Add Row
        </button>
      </div>

      <div style={tableStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 95px 32px' }}>
          <div style={{ ...thStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reorder Rows">
            <GripVertical size={13} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>{nameHeader}</div>
          <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
          <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }} />
        </div>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              setDraggedIdx(idx);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIdx(idx);
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIdx !== null && draggedIdx !== idx) {
                onReorder(draggedIdx, idx);
              }
              setDraggedIdx(null);
              setDragOverIdx(null);
            }}
            style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 95px 32px',
              borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
              background: dragOverIdx === idx ? 'var(--accent-bg)' : 'transparent',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Reorder Handle Column */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid var(--border)', cursor: 'grab', padding: '0 2px',
                gap: 1,
              }}
              title="Drag to reorder row"
            >
              <GripVertical size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onReorder(idx, idx - 1); }}
                  disabled={idx === 0}
                  title="Move Up"
                  style={{
                    border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer',
                    opacity: idx === 0 ? 0.25 : 0.7, padding: 0, display: 'flex', color: 'var(--text-muted)'
                  }}
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReorder(idx, idx + 1); }}
                  disabled={idx === rows.length - 1}
                  title="Move Down"
                  style={{
                    border: 'none', background: 'transparent', cursor: idx === rows.length - 1 ? 'default' : 'pointer',
                    opacity: idx === rows.length - 1 ? 0.25 : 0.7, padding: 0, display: 'flex', color: 'var(--text-muted)'
                  }}
                >
                  <ChevronDown size={11} />
                </button>
              </div>
            </div>

            <div style={{ borderRight: '1px solid var(--border)' }}>
              <input type="text" value={row[field]} placeholder={placeholder}
                onChange={e => onUpdate(row.id, field, e.target.value)} style={inputStyle} />
            </div>
            <div style={{ borderRight: '1px solid var(--border)' }}>
              <input type="text" inputMode="decimal" value={row.amount} placeholder="0"
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) onUpdate(row.id, 'amount', v); }}
                style={{ ...inputStyle, fontWeight: 700, color: parseFloat(row.amount) > 0 ? `var(--${tone})` : 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button onClick={() => onRemove(row.id)} disabled={rows.length === 1} style={{
                width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer',
              }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 95px 32px', background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
          <div style={{ gridColumn: 'span 2', padding: '9px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>{totalLabel}</div>
          <div style={{ padding: '9px 11px', fontSize: 13, fontWeight: 800, color: `var(--${tone})`, borderRight: '1px solid var(--border)' }}>{formatAmount(total)}</div>
          <div />
        </div>
      </div>
    </div>
  );
}
