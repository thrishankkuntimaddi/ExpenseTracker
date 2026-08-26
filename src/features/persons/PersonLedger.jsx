// ─── PersonLedger ──────────────────────────────────────────────────
// Per-person ledger: shows all transactions for one person,
// aggregates outstanding balance, supports add/edit/delete.

import { useState, useMemo } from 'react';
import {
  ArrowLeft, Plus, TrendingDown, TrendingUp, IndianRupee,
  Calendar, PenLine, Check, X, Pencil, Trash2, User,
} from 'lucide-react';
import { generateId } from '../../utils/storage';
import { formatAmount, formatDateShort, todayInputValue, dateInputToISO, isoToMonth } from '../../utils/dateHelpers';
import { PERSON_DIRECTIONS, getPersonDirection } from '../../utils/typeConfig';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

/* ─── Add Transaction Form ─── */
function AddPersonTxnForm({ personName, onSave, onClose }) {
  const [direction, setDirection] = useState('lent');
  const [amount, setAmount]       = useState('');
  const [dateInput, setDateInput] = useState(todayInputValue());
  const [note, setNote]           = useState('');

  const amtNum  = parseFloat(amount);
  const canSave = !isNaN(amtNum) && amtNum > 0 && dateInput;

  function handleSave() {
    if (!canSave) return;
    const isoDate = dateInputToISO(dateInput);
    onSave({
      id:        generateId(),
      name:      personName,
      amount:    amtNum,
      type:      'person',
      direction,
      date:      isoDate,
      month:     isoToMonth(isoDate),
      note:      note.trim() || undefined,
    });
    onClose();
  }

  const dirCfg = getPersonDirection(direction);

  return (
    <div style={{
      background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: 14, padding: 16, marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        New Transaction for {personName}
      </div>

      {/* Direction toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {PERSON_DIRECTIONS.map(d => (
          <button key={d.key} onClick={() => setDirection(d.key)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
            background: direction === d.key ? d.color + '22' : 'var(--surface)',
            color: direction === d.key ? d.color : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <d.Icon size={13} />{d.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IndianRupee size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" inputMode="decimal" placeholder="0.00" value={amount}
          onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            borderRadius: 10, fontSize: 18, fontWeight: 700,
            border: `1.5px solid ${dirCfg.color}44`,
            background: 'var(--input-bg)', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = dirCfg.color}
          onBlur={e => e.target.style.borderColor = dirCfg.color + '44'}
        />
      </div>

      {/* Date */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            borderRadius: 10, fontSize: 13,
            border: '1.5px solid var(--input-border)',
            background: 'var(--input-bg)', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Note (optional) */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <PenLine size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" placeholder="Note (optional)" value={note}
          onChange={e => setNote(e.target.value)}
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            borderRadius: 10, fontSize: 13,
            border: '1.5px solid var(--input-border)',
            background: 'var(--input-bg)', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: 'var(--surface)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={!canSave} style={{
          flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: canSave ? dirCfg.color : 'var(--surface2)',
          color: canSave ? '#fff' : 'var(--text-muted)',
          border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Check size={13} />Add {dirCfg.label}
        </button>
      </div>
    </div>
  );
}

/* ─── Inline Edit Row ─── */
function EditTxnRow({ txn, onSave, onCancel }) {
  const [amount, setAmount]       = useState(String(txn.amount));
  const [dateInput, setDateInput] = useState(
    txn.date ? `${new Date(txn.date).getFullYear()}-${String(new Date(txn.date).getMonth()+1).padStart(2,'0')}-${String(new Date(txn.date).getDate()).padStart(2,'0')}` : todayInputValue()
  );
  const [direction, setDirection] = useState(txn.direction ?? 'lent');

  const amtNum = parseFloat(amount);
  const canSave = !isNaN(amtNum) && amtNum > 0;

  function handleSave() {
    if (!canSave) return;
    const isoDate = dateInputToISO(dateInput);
    onSave({ ...txn, amount: amtNum, direction, date: isoDate, month: isoToMonth(isoDate) });
  }

  return (
    <div style={{
      background: 'var(--accent-bg)', borderBottom: '1px solid var(--border)',
      padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {PERSON_DIRECTIONS.map(d => (
        <button key={d.key} onClick={() => setDirection(d.key)} style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          border: `1.5px solid ${direction === d.key ? d.color : 'var(--border)'}`,
          background: direction === d.key ? d.color + '22' : 'transparent',
          color: direction === d.key ? d.color : 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{d.label}</button>
      ))}
      <input type="text" inputMode="decimal" value={amount}
        onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
        style={{ width: 100, padding: '5px 8px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1.5px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
      />
      <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
        style={{ padding: '5px 8px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
      />
      <button onClick={handleSave} disabled={!canSave} style={{
        padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
        background: canSave ? 'var(--accent)' : 'var(--surface2)',
        color: canSave ? '#fff' : 'var(--text-muted)',
        border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
      }}>Save</button>
      <button onClick={onCancel} style={{
        padding: '5px 10px', borderRadius: 8, fontSize: 11,
        background: 'var(--surface2)', color: 'var(--text-secondary)',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>✕</button>
    </div>
  );
}

/* ═══ PersonLedger ═══ */
export default function PersonLedger({ personName, transactions, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onBack }) {
  const [showAddForm, setShowAddForm]       = useState(false);
  const [editingId, setEditingId]           = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);

  // All transactions for this person (normalize name comparison)
  const personTxns = useMemo(() =>
    transactions
      .filter(t => t.type === 'person' && t.name?.toLowerCase().trim() === personName.toLowerCase().trim())
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, personName]
  );

  const totalLent       = personTxns.filter(t => t.direction === 'lent' || (!t.direction && t.direction !== 'repayment')).reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalRepaid     = personTxns.filter(t => t.direction === 'repayment').reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalBorrowed   = personTxns.filter(t => t.direction === 'borrowed').reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalRepaidThem = personTxns.filter(t => t.direction === 'repaid').reduce((s, t) => s + (t.amount ?? 0), 0);

  const netPosition = (totalLent - totalRepaid) - (totalBorrowed - totalRepaidThem);

  function handleSaveNew(txn)  { onAddTransaction(txn);    setShowAddForm(false); }
  function handleSaveEdit(txn) { onUpdateTransaction(txn); setEditingId(null);    }
  function handleDelete(id)    { onDeleteTransaction(id);  setDeleteTarget(null); }

  const isOwed    = netPosition > 0;
  const isDebt    = netPosition < 0;
  const isSettled = netPosition === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete transaction?"
          message="This action cannot be undone."
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="tab-header" style={{ flexShrink: 0 }}>
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: 'var(--surface2)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
          marginBottom: 14,
        }}>
          <ArrowLeft size={14} />Back to People
        </button>

        {/* Person hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: isDebt ? '#EFF6FF' : 'var(--person-bg)',
            border: `2px solid ${isDebt ? '#93C5FD' : 'var(--person-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <User size={24} style={{ color: isDebt ? '#2563EB' : 'var(--person)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              {personName}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {personTxns.length} transaction{personTxns.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Lent (I Gave)',     value: totalLent,       color: '#D97706', bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.3)' },
            { label: 'Repayment Rec.',   value: totalRepaid,     color: '#16A34A', bg: 'var(--income-bg)',      border: 'var(--income-border)' },
            { label: 'Borrowed (I Took)', value: totalBorrowed,   color: '#2563EB', bg: '#EFF6FF',              border: '#93C5FD' },
            {
              label: isSettled ? 'Net Position' : isOwed ? 'Owes You' : 'You Owe Them',
              value: Math.abs(netPosition),
              color: isSettled ? 'var(--text-muted)' : isOwed ? 'var(--expense)' : '#2563EB',
              bg: isSettled ? 'var(--surface2)' : isOwed ? 'var(--expense-bg)' : '#EFF6FF',
              border: isSettled ? 'var(--border)' : isOwed ? 'var(--expense-border)' : '#93C5FD'
            },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{
              borderRadius: 14, padding: '12px 14px',
              background: bg, border: `1.5px solid ${border}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>
                {formatAmount(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Add transaction button */}
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: 'var(--person)', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={15} />Add Transaction
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>

        {/* Inline add form */}
        {showAddForm && (
          <div style={{ paddingTop: 16 }}>
            <AddPersonTxnForm personName={personName} onSave={handleSaveNew} onClose={() => setShowAddForm(false)} />
          </div>
        )}

        {/* Transaction history */}
        {personTxns.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--person-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={28} style={{ color: 'var(--person)' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>No transactions yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Add a transaction above to start tracking {personName}'s ledger.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Transaction History
            </p>

            {/* Running balance header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
              padding: '6px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Date</span><span>Type</span><span>Amount</span><span>Actions</span>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
              {personTxns.map((txn, idx) => {
                const dirCfg = getPersonDirection(txn.direction);
                const isInflow = txn.direction === 'repayment' || txn.direction === 'borrowed';
                const isEditing = editingId === txn.id;
                return (
                  <div key={txn.id}>
                    {isEditing ? (
                      <EditTxnRow txn={txn} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                    ) : (
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                        padding: '12px 14px', alignItems: 'center',
                        borderBottom: idx < personTxns.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isEditing ? 'var(--accent-bg)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            {txn.date ? formatDateShort(txn.date) : '—'}
                          </div>
                          {txn.note && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{txn.note}</div>
                          )}
                        </div>
                        <div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: dirCfg.color + '22', color: dirCfg.color,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <dirCfg.Icon size={10} />
                            {dirCfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isInflow ? 'var(--income)' : dirCfg.color }}>
                          {isInflow ? '+' : '-'}{formatAmount(txn.amount)}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditingId(txn.id)} style={{
                            width: 26, height: 26, borderRadius: 7, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(txn.id)} style={{
                            width: 26, height: 26, borderRadius: 7, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--expense-bg)'; e.currentTarget.style.color = 'var(--expense)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
