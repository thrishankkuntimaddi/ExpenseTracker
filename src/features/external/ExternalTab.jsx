import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeftRight, Plus, Trash2, CheckCircle2, ChevronDown,
  ChevronRight, IndianRupee, User, ShoppingBag, TrendingUp,
  TrendingDown, AlertCircle, Clock, X, Loader2, Package,
  ReceiptText,
} from 'lucide-react';
import { useExternalTransactions } from '../../hooks/useExternalTransactions';
import { generateId } from '../../utils/storage';
import { formatAmount, formatDate } from '../../utils/dateHelpers';

/* ─── Pure helpers ─────────────────────────────────────────────── */
function calcTotals(items, received) {
  const totalSpent    = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalReceived = received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netBalance    = totalReceived - totalSpent;
  return { totalSpent, totalReceived, netBalance };
}

function newItemRow()     { return { id: generateId(), name: '', amount: '' }; }
function newReceivedRow() { return { id: generateId(), person: '', amount: '' }; }

/* ─── Inline editable table cell ──────────────────────────────── */
function EditableCell({ value, onChange, placeholder, type = 'text', onTab, style = {}, inputMode }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Tab' && onTab) { e.preventDefault(); onTab(e.shiftKey); } }}
      autoComplete="off"
      style={{
        width: '100%', border: 'none', background: 'transparent',
        color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
        fontWeight: 500, outline: 'none', padding: '8px 10px',
        ...style,
      }}
    />
  );
}

/* ─── Confirmation Modal ───────────────────────────────────────── */
function ConfirmModal({ totalReceived, totalSpent, netBalance, persons, onConfirm, onCancel, loading }) {
  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;
  const isEven   = netBalance === 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 20, padding: '28px 28px 24px', maxWidth: 400, width: '100%',
        boxShadow: 'var(--shadow-md)',
        animation: 'modalPop 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Close Billing Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review before confirming</div>
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

        {/* What will happen */}
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
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 2, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--accent)',
              color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
            Confirm & Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── History Card ─────────────────────────────────────────────── */
function HistoryCard({ session, onDelete }) {
  const [open, setOpen] = useState(false);
  const net    = session.net_balance ?? 0;
  const isProfit = net > 0;
  const isLoss   = net < 0;
  const persons  = (session.received ?? []).filter(r => r.person?.trim() && r.amount > 0).map(r => r.person).join(', ') || 'Unknown';

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 14,
      overflow: 'hidden', background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', gap: 8, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {persons}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {session.date ? formatDate(session.date) : '—'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--text-muted)',
          }}>
            {net >= 0 ? '+' : ''}{formatAmount(net)}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: isProfit ? 'var(--income-bg)' : isLoss ? 'var(--expense-bg)' : 'var(--surface2)',
            color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--text-muted)',
          }}>
            {isProfit ? 'INCOME' : isLoss ? 'EXPENSE' : 'SETTLED'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            style={{
              width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {/* Items */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Items Purchased
              </p>
              {(session.items ?? []).filter(i => i.name?.trim() && parseFloat(i.amount) > 0).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ color: 'var(--expense)', fontWeight: 700 }}>{formatAmount(parseFloat(item.amount))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Spent</span>
                <span style={{ color: 'var(--expense)' }}>{formatAmount(session.total_spent ?? 0)}</span>
              </div>
            </div>
            {/* Received */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Money Received
              </p>
              {(session.received ?? []).filter(r => r.person?.trim() && parseFloat(r.amount) > 0).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.person}</span>
                  <span style={{ color: 'var(--income)', fontWeight: 700 }}>{formatAmount(parseFloat(r.amount))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Received</span>
                <span style={{ color: 'var(--income)' }}>{formatAmount(session.total_received ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ExternalTab
═══════════════════════════════════════════════════════════════ */
export default function ExternalTab({ user, onAddIncome, onAddTransaction }) {
  const {
    sessions, activeSession, saving,
    createSession, updateSession, closeSession, deleteSession,
  } = useExternalTransactions(user?.uid);

  /* ── Local working copy of the active session rows ── */
  const [items,    setItems]    = useState([newItemRow()]);
  const [received, setReceived] = useState([newReceivedRow()]);
  const [showModal, setShowModal]   = useState(false);
  const [closing,   setClosing]     = useState(false);

  /* ── Sync local rows from active session when it loads/changes ── */
  useEffect(() => {
    if (activeSession) {
      setItems(
        (activeSession.items ?? []).length > 0
          ? activeSession.items.map(i => ({ ...i, amount: i.amount != null ? String(i.amount) : '' }))
          : [newItemRow()]
      );
      setReceived(
        (activeSession.received ?? []).length > 0
          ? activeSession.received.map(r => ({ ...r, amount: r.amount != null ? String(r.amount) : '' }))
          : [newReceivedRow()]
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]); // only re-sync on session change, not on every tick

  /* ── Real-time totals ── */
  const { totalSpent, totalReceived, netBalance } = useMemo(
    () => calcTotals(items, received),
    [items, received]
  );

  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;
  const isEven   = netBalance === 0;

  /* ── Persons label ── */
  const personsLabel = useMemo(() =>
    received.filter(r => r.person?.trim() && parseFloat(r.amount) > 0).map(r => r.person.trim()).join(', ') || 'Unknown',
    [received]
  );

  /* ── Debounced save to Firestore ── */
  const saveToFirestore = useCallback((newItems, newReceived) => {
    if (!activeSession) return;
    const clean = (arr, field) =>
      arr.map(r => ({ ...r, [field]: parseFloat(r[field]) > 0 ? parseFloat(r[field]) : null }));
    const cleanedItems    = newItems.map(i => ({ ...i, amount: i.amount !== '' ? (parseFloat(i.amount) || null) : null }));
    const cleanedReceived = newReceived.map(r => ({ ...r, amount: r.amount !== '' ? (parseFloat(r.amount) || null) : null }));
    const tots = calcTotals(newItems, newReceived);
    updateSession({
      id:             activeSession.id,
      items:          cleanedItems,
      received:       cleanedReceived,
      total_received: tots.totalReceived,
      total_spent:    tots.totalSpent,
      net_balance:    tots.netBalance,
    });
  }, [activeSession, updateSession]);

  /* ── Item table handlers ── */
  const updateItem = useCallback((id, field, value) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, [field]: value } : i);
      saveToFirestore(next, received);
      return next;
    });
  }, [received, saveToFirestore]);

  const addItemRow = useCallback(() => {
    setItems(prev => {
      const next = [...prev, newItemRow()];
      saveToFirestore(next, received);
      return next;
    });
  }, [received, saveToFirestore]);

  const removeItemRow = useCallback((id) => {
    setItems(prev => {
      const next = prev.length > 1 ? prev.filter(i => i.id !== id) : prev;
      saveToFirestore(next, received);
      return next;
    });
  }, [received, saveToFirestore]);

  /* ── Received table handlers ── */
  const updateReceived = useCallback((id, field, value) => {
    setReceived(prev => {
      const next = prev.map(r => r.id === id ? { ...r, [field]: value } : r);
      saveToFirestore(items, next);
      return next;
    });
  }, [items, saveToFirestore]);

  const addReceivedRow = useCallback(() => {
    setReceived(prev => {
      const next = [...prev, newReceivedRow()];
      saveToFirestore(items, next);
      return next;
    });
  }, [items, saveToFirestore]);

  const removeReceivedRow = useCallback((id) => {
    setReceived(prev => {
      const next = prev.length > 1 ? prev.filter(r => r.id !== id) : prev;
      saveToFirestore(items, next);
      return next;
    });
  }, [items, saveToFirestore]);

  /* ── Can Close? at least 1 item with amount AND 1 received with amount ── */
  const hasItems    = items.some(i    => i.name?.trim() && parseFloat(i.amount) > 0);
  const hasReceived = received.some(r => r.person?.trim() && parseFloat(r.amount) > 0);
  const canClose    = hasItems && hasReceived && !!activeSession;

  /* ── Confirm close ── */
  const handleConfirmClose = async () => {
    if (!activeSession) return;
    setClosing(true);
    try {
      const cleanedItems    = items.map(i => ({ ...i, amount: parseFloat(i.amount) || null }));
      const cleanedReceived = received.map(r => ({ ...r, amount: parseFloat(r.amount) || null }));
      await closeSession(
        activeSession.id,
        { netBalance, items: cleanedItems, received: cleanedReceived, total_received: totalReceived, total_spent: totalSpent },
        onAddIncome,
        onAddTransaction
      );
      // Reset local state for the next session
      setItems([newItemRow()]);
      setReceived([newReceivedRow()]);
      setShowModal(false);
    } catch {
      alert('Failed to close billing. Please try again.');
    } finally {
      setClosing(false);
    }
  };

  /* ── Closed sessions ── */
  const closedSessions = sessions.filter(s => s.status === 'closed');

  /* ── Shared table style ── */
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

  return (
    <div className="tab-root">
      {/* ── Confirmation Modal ── */}
      {showModal && (
        <ConfirmModal
          totalReceived={totalReceived}
          totalSpent={totalSpent}
          netBalance={netBalance}
          persons={personsLabel}
          onConfirm={handleConfirmClose}
          onCancel={() => setShowModal(false)}
          loading={closing}
        />
      )}

      {/* ── Header ── */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            }}>
              <ArrowLeftRight size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                External Billing
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                Proxy spending ledger · track spend on behalf of others
              </p>
            </div>
          </div>

          {/* Auto-save indicator */}
          {saving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Saving…
            </div>
          )}
        </div>

        {/* Status strip */}
        {activeSession ? (
          <div style={{
            marginTop: 12, padding: '8px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(168,85,247,0.06))',
            border: '1px solid rgba(124,58,237,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A855F7', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>
                Session active · started {formatDate(activeSession.date)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Auto-saved to cloud
              </span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <button
              id="btn-new-external-session"
              onClick={createSession}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(124,58,237,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.35)'; }}
            >
              <Plus size={16} />
              Start New Billing Session
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px' }}>

        {!activeSession && closedSessions.length === 0 && (
          /* ── Empty state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(168,85,247,0.06))',
              border: '1.5px solid rgba(124,58,237,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ReceiptText size={34} style={{ color: '#A855F7', opacity: 0.7 }} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No billing sessions yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.6 }}>
                Use this module to track purchases made on behalf of others. Only the net difference affects your balance.
              </p>
            </div>
          </div>
        )}

        {activeSession && (
          <div className="external-grid">

            {/* ═══ GOODS TABLE ═══ */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ShoppingBag size={15} style={{ color: '#7C3AED' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Goods Purchased
                  </span>
                </div>
                <button
                  id="btn-add-item-row"
                  onClick={addItemRow}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'rgba(124,58,237,0.1)', color: '#7C3AED',
                    border: '1px solid rgba(124,58,237,0.25)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; }}
                >
                  <Plus size={11} /> Add Row
                </button>
              </div>

              <div style={tableStyle}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px' }}>
                  <div style={thStyle}>Item Name</div>
                  <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
                  <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }} />
                </div>

                {/* Rows */}
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        value={item.name}
                        placeholder="e.g. Tomato"
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        autoComplete="off"
                        style={inputStyle}
                        onFocus={e => e.target.parentElement.style.background = 'var(--accent-bg)'}
                        onBlur={e => e.target.parentElement.style.background = 'transparent'}
                      />
                    </div>
                    <div style={{ borderRight: '1px solid var(--border)', position: 'relative' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.amount}
                        placeholder="—"
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '' || /^\d*\.?\d*$/.test(v)) updateItem(item.id, 'amount', v);
                        }}
                        autoComplete="off"
                        style={{ ...inputStyle, fontWeight: 700, color: parseFloat(item.amount) > 0 ? 'var(--expense)' : 'var(--text-muted)' }}
                        onFocus={e => e.target.parentElement.style.background = 'var(--accent-bg)'}
                        onBlur={e => e.target.parentElement.style.background = 'transparent'}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => removeItemRow(item.id)}
                        disabled={items.length === 1}
                        style={{
                          width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: items.length === 1 ? 'var(--border)' : 'var(--text-muted)',
                          cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => { if (items.length > 1) { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.color = items.length === 1 ? 'var(--border)' : 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                  background: 'var(--surface2)', borderTop: '2px solid var(--border)',
                }}>
                  <div style={{ padding: '9px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                    Total Spent
                  </div>
                  <div style={{ padding: '9px 11px', fontSize: 13, fontWeight: 800, color: 'var(--expense)', borderRight: '1px solid var(--border)' }}>
                    {formatAmount(totalSpent)}
                  </div>
                  <div />
                </div>
              </div>
            </div>

            {/* ═══ RECEIVED TABLE ═══ */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <User size={15} style={{ color: 'var(--income)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Money Received
                  </span>
                </div>
                <button
                  id="btn-add-received-row"
                  onClick={addReceivedRow}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'var(--income-bg)', color: 'var(--income)',
                    border: '1px solid var(--income-border)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--income)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--income-bg)'; e.currentTarget.style.color = 'var(--income)'; }}
                >
                  <Plus size={11} /> Add Row
                </button>
              </div>

              <div style={tableStyle}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px' }}>
                  <div style={thStyle}>Person Name</div>
                  <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
                  <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }} />
                </div>

                {/* Rows */}
                {received.map((row, idx) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                      borderBottom: idx < received.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        value={row.person}
                        placeholder="e.g. Mom"
                        onChange={e => updateReceived(row.id, 'person', e.target.value)}
                        autoComplete="off"
                        style={inputStyle}
                        onFocus={e => e.target.parentElement.style.background = 'var(--income-bg)'}
                        onBlur={e => e.target.parentElement.style.background = 'transparent'}
                      />
                    </div>
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        placeholder="0"
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '' || /^\d*\.?\d*$/.test(v)) updateReceived(row.id, 'amount', v);
                        }}
                        autoComplete="off"
                        style={{ ...inputStyle, fontWeight: 700, color: parseFloat(row.amount) > 0 ? 'var(--income)' : 'var(--text-muted)' }}
                        onFocus={e => e.target.parentElement.style.background = 'var(--income-bg)'}
                        onBlur={e => e.target.parentElement.style.background = 'transparent'}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => removeReceivedRow(row.id)}
                        disabled={received.length === 1}
                        style={{
                          width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: received.length === 1 ? 'var(--border)' : 'var(--text-muted)',
                          cursor: received.length === 1 ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => { if (received.length > 1) { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.color = received.length === 1 ? 'var(--border)' : 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                  background: 'var(--surface2)', borderTop: '2px solid var(--border)',
                }}>
                  <div style={{ padding: '9px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                    Total Received
                  </div>
                  <div style={{ padding: '9px 11px', fontSize: 13, fontWeight: 800, color: 'var(--income)', borderRight: '1px solid var(--border)' }}>
                    {formatAmount(totalReceived)}
                  </div>
                  <div />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LIVE SUMMARY BAR ═══ */}
        {activeSession && (
          <div style={{
            marginTop: 20,
            background: isProfit
              ? 'linear-gradient(135deg, var(--income-bg), rgba(22,163,74,0.04))'
              : isLoss
              ? 'linear-gradient(135deg, var(--expense-bg), rgba(220,38,38,0.04))'
              : 'var(--surface2)',
            border: `1.5px solid ${isProfit ? 'var(--income-border)' : isLoss ? 'var(--expense-border)' : 'var(--border)'}`,
            borderRadius: 16, padding: '18px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 14,
          }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  Total Received
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--income)' }}>{formatAmount(totalReceived)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  Total Spent
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--expense)' }}>{formatAmount(totalSpent)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  Net Balance
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 900,
                  color: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--text-muted)',
                }}>
                  {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Human-readable result */}
              <div style={{
                padding: '8px 16px', borderRadius: 24,
                background: isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : 'var(--surface)',
                color: (isProfit || isLoss) ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isProfit ? <TrendingUp size={14} /> : isLoss ? <TrendingDown size={14} /> : <AlertCircle size={14} />}
                {isProfit
                  ? `You gained ${formatAmount(netBalance)}`
                  : isLoss
                  ? `You spent ${formatAmount(Math.abs(netBalance))} from your pocket`
                  : 'Perfectly settled — no entry needed'}
              </div>

              {/* Close Billing button */}
              <button
                id="btn-close-billing"
                onClick={() => setShowModal(true)}
                disabled={!canClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: 12,
                  background: canClose
                    ? (isProfit ? 'var(--income)' : isLoss ? 'var(--expense)' : '#7C3AED')
                    : 'var(--surface2)',
                  color: canClose ? '#fff' : 'var(--text-muted)',
                  border: 'none', cursor: canClose ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  boxShadow: canClose ? '0 4px 12px rgba(0,0,0,0.18)' : 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (canClose) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                <CheckCircle2 size={14} />
                Close Billing
              </button>
            </div>
          </div>
        )}

        {/* ═══ CLOSED SESSIONS HISTORY ═══ */}
        {closedSessions.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Clock size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Session History ({closedSessions.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {closedSessions.map(s => (
                <HistoryCard key={s.id} session={s} onDelete={deleteSession} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .external-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .external-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
