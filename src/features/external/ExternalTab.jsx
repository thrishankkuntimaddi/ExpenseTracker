import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ArrowLeftRight, Plus, Trash2, CheckCircle2, ChevronDown,
  ChevronRight, IndianRupee, User, ShoppingBag, TrendingUp,
  TrendingDown, AlertCircle, Clock, X, Loader2, Package,
  ReceiptText, ArrowLeft, Save, FileEdit, Calendar, PenLine, Pencil,
} from 'lucide-react';
import { useExternalTransactions } from '../../hooks/useExternalTransactions';
import { generateId } from '../../utils/storage';
import { formatAmount, formatDate, todayInputValue, dateInputToISO, isoToDateInput, isoToMonth } from '../../utils/dateHelpers';
import { filterItemsByPeriod, getPeriodLabel } from '../../utils/periodHelpers';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

/* ─── Pure helpers ─────────────────────────────────────────────── */
function calcTotals(items, received) {
  const totalSpent    = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalReceived = received.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netBalance    = totalReceived - totalSpent;
  return { totalSpent, totalReceived, netBalance };
}

function newItemRow()     { return { id: generateId(), name: '', amount: '' }; }
function newReceivedRow() { return { id: generateId(), person: '', amount: '' }; }

/* ─── New Billing Modal ─── */
function NewBillingModal({ onCreate, onCancel }) {
  const [name, setName]       = useState('');
  const [dateStr, setDateStr] = useState(todayInputValue());

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), dateStr);
  }

  return (
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
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>New Billing Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Create a workspace for proxy spending</div>
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
          <PenLine size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--external)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Session Name (e.g. Bike Purchase, Family Trip)"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
              borderRadius: 10, fontSize: 14, border: '1.5px solid var(--external-border)',
              background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Transaction Date */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--external)', pointerEvents: 'none' }} />
          <input
            type="date"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            style={{
              width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
              borderRadius: 10, fontSize: 13, border: '1.5px solid var(--external-border)',
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
            background: name.trim() ? 'var(--external)' : 'var(--surface2)',
            color: name.trim() ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Plus size={15} />Create Session
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Confirmation Modal for Closing ─── */
function ConfirmCloseModal({ totalReceived, totalSpent, netBalance, sessionName, persons, onConfirm, onCancel, loading }) {
  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;
  const isEven   = netBalance === 0;

  return (
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
  );
}

/* ─── Session History Card ───────────────────────────────────────── */
function HistoryCard({ session, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const net      = session.net_balance ?? 0;
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
              {session.name || persons}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {session.date ? formatDate(session.date) : '—'} · {session.status?.toUpperCase() ?? 'CLOSED'}
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
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(session.id); }}
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--external)'; e.currentTarget.style.background = 'var(--external-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface2)'; }}
            >
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              style={{
                width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--expense)'; e.currentTarget.style.background = 'var(--expense-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={12} />
            </button>
          )}
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
   Supports multiple sessions (Active, Drafts, History), name & date!
═══════════════════════════════════════════════════════════════ */
export default function ExternalTab({
  user,
  onAddIncome, onUpdateIncome, onDeleteIncome,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  selectedPeriod, theme,
}) {
  const {
    sessions, saving,
    createSession, updateSession, saveDraftSession,
    discardSession, closeSession, deleteSession, reopenSession,
  } = useExternalTransactions(user?.uid);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showNewModal, setShowNewModal]       = useState(false);
  const [showCloseModal, setShowCloseModal]   = useState(false);
  const [deletingId, setDeletingId]           = useState(null);
  const [closing, setClosing]                 = useState(false);

  // Active session object currently opened in editor
  const currentSession = useMemo(() =>
    sessions.find(s => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  /* ── Local working copy of current session ── */
  const [sessionName, setSessionName]   = useState('');
  const [sessionDate, setSessionDate]   = useState(todayInputValue());
  const [items, setItemRows]            = useState([newItemRow()]);
  const [received, setReceivedRows]     = useState([newReceivedRow()]);

  /* ── Sync local rows when active session changes ── */
  useEffect(() => {
    if (currentSession) {
      setSessionName(currentSession.name ?? 'New Billing');
      setSessionDate(isoToDateInput(currentSession.date));
      setItemRows(
        (currentSession.items ?? []).length > 0
          ? currentSession.items.map(i => ({ ...i, amount: i.amount != null ? String(i.amount) : '' }))
          : [newItemRow()]
      );
      setReceivedRows(
        (currentSession.received ?? []).length > 0
          ? currentSession.received.map(r => ({ ...r, amount: r.amount != null ? String(r.amount) : '' }))
          : [newReceivedRow()]
      );
    }
  }, [currentSession?.id]);

  /* ── Totals ── */
  const { totalSpent, totalReceived, netBalance } = useMemo(
    () => calcTotals(items, received),
    [items, received]
  );

  const isProfit = netBalance > 0;
  const isLoss   = netBalance < 0;

  const personsLabel = useMemo(() =>
    received.filter(r => r.person?.trim() && parseFloat(r.amount) > 0).map(r => r.person.trim()).join(', ') || 'Unknown',
    [received]
  );

  /* ── Debounced save to Firestore ── */
  const triggerSave = useCallback((nameVal, dateVal, itemArr, rcvArr) => {
    if (!activeSessionId) return;
    const isoDate = dateInputToISO(dateVal);
    const cleanedItems    = itemArr.map(i => ({ ...i, amount: i.amount !== '' ? (parseFloat(i.amount) || null) : null }));
    const cleanedReceived = rcvArr.map(r => ({ ...r, amount: r.amount !== '' ? (parseFloat(r.amount) || null) : null }));
    const tots = calcTotals(itemArr, rcvArr);
    updateSession({
      id:             activeSessionId,
      name:           nameVal.trim() || 'Unnamed Billing',
      date:           isoDate,
      month:          isoToMonth(isoDate),
      items:          cleanedItems,
      received:       cleanedReceived,
      total_received: tots.totalReceived,
      total_spent:    tots.totalSpent,
      net_balance:    tots.netBalance,
    });
  }, [activeSessionId, updateSession]);

  /* ── Handlers for item/received updates ── */
  function handleNameChange(val) {
    setSessionName(val);
    triggerSave(val, sessionDate, items, received);
  }

  function handleDateChange(val) {
    setSessionDate(val);
    triggerSave(sessionName, val, items, received);
  }

  function updateItem(id, field, value) {
    setItemRows(prev => {
      const next = prev.map(i => i.id === id ? { ...i, [field]: value } : i);
      triggerSave(sessionName, sessionDate, next, received);
      return next;
    });
  }

  function addItemRow() {
    setItemRows(prev => {
      const next = [...prev, newItemRow()];
      triggerSave(sessionName, sessionDate, next, received);
      return next;
    });
  }

  function removeItemRow(id) {
    setItemRows(prev => {
      const next = prev.length > 1 ? prev.filter(i => i.id !== id) : prev;
      triggerSave(sessionName, sessionDate, next, received);
      return next;
    });
  }

  function updateReceived(id, field, value) {
    setReceivedRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, [field]: value } : r);
      triggerSave(sessionName, sessionDate, items, next);
      return next;
    });
  }

  function addReceivedRow() {
    setReceivedRows(prev => {
      const next = [...prev, newReceivedRow()];
      triggerSave(sessionName, sessionDate, items, next);
      return next;
    });
  }

  function removeReceivedRow(id) {
    setReceivedRows(prev => {
      const next = prev.length > 1 ? prev.filter(r => r.id !== id) : prev;
      triggerSave(sessionName, sessionDate, items, next);
      return next;
    });
  }

  /* ── Create Session ── */
  async function handleCreateSession(nameVal, dateVal) {
    setShowNewModal(false);
    const newId = await createSession(nameVal, dateVal);
    if (newId) setActiveSessionId(newId);
  }

  /* ── Close Session ── */
  async function handleConfirmClose() {
    if (!activeSessionId) return;
    setClosing(true);
    try {
      const cleanedItems    = items.map(i => ({ ...i, amount: parseFloat(i.amount) || null }));
      const cleanedReceived = received.map(r => ({ ...r, amount: parseFloat(r.amount) || null }));
      await closeSession(
        activeSessionId,
        {
          netBalance,
          items: cleanedItems,
          received: cleanedReceived,
          total_received: totalReceived,
          total_spent: totalSpent,
          sessionDate: dateInputToISO(sessionDate),
          sessionName,
        },
        { onAddIncome, onUpdateIncome, onDeleteIncome, onAddTransaction, onUpdateTransaction, onDeleteTransaction }
      );
      setActiveSessionId(null);
      setShowCloseModal(false);
    } catch {
      alert('Failed to close session.');
    } finally {
      setClosing(false);
    }
  }

  /* ── Discard Session ── */
  function handleDiscard() {
    if (!activeSessionId) return;
    discardSession(activeSessionId, { onDeleteIncome, onDeleteTransaction });
    setActiveSessionId(null);
  }

  /* ── Save Draft ── */
  function handleSaveDraft() {
    if (!activeSessionId) return;
    saveDraftSession(activeSessionId);
    setActiveSessionId(null);
  }

  /* ── Edit (Reopen) session ── */
  function handleEditSession(id) {
    reopenSession(id);
    setActiveSessionId(id);
  }

  /* ── Filter sessions ── */
  const activeSessions = sessions.filter(s => s.status === 'open');
  const draftSessions  = sessions.filter(s => s.status === 'draft');
  const closedSessions = selectedPeriod
    ? filterItemsByPeriod(sessions.filter(s => s.status === 'closed'), selectedPeriod)
    : sessions.filter(s => s.status === 'closed');

  const hasItems    = items.some(i => i.name?.trim() && parseFloat(i.amount) > 0);
  const hasReceived = received.some(r => r.person?.trim() && parseFloat(r.amount) > 0);
  const canClose    = hasItems && hasReceived;

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
      {/* New Billing Modal */}
      {showNewModal && (
        <NewBillingModal
          onCreate={handleCreateSession}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {/* Confirm Close Modal */}
      {showCloseModal && (
        <ConfirmCloseModal
          totalReceived={totalReceived}
          totalSpent={totalSpent}
          netBalance={netBalance}
          sessionName={sessionName}
          persons={personsLabel}
          onConfirm={handleConfirmClose}
          onCancel={() => setShowCloseModal(false)}
          loading={closing}
        />
      )}

      {/* Confirm Delete Modal */}
      {deletingId && (
        <ConfirmDeleteModal
          title="Delete billing session?"
          message="This will permanently remove all items, received entries, and totals."
          onConfirm={() => { deleteSession(deletingId, { onDeleteIncome, onDeleteTransaction }); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Header */}
      <div className="tab-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentSession && (
              <button
                onClick={() => setActiveSessionId(null)}
                style={{
                  width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)',
                  background: 'var(--surface2)', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
                }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: '#7C3AED', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            }}>
              <ArrowLeftRight size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                {currentSession ? currentSession.name : 'External Billing'}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                Proxy spending ledger · track spend on behalf of others
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
            {!currentSession && (
              <button
                onClick={() => setShowNewModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 11,
                  background: '#7C3AED', color: '#fff', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(124,58,237,0.25)', transition: 'all 0.15s',
                }}
              >
                <Plus size={15} /> New Billing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px' }}>

        {/* ═══ SESSIONS LIST VIEW (when no session is open for editing) ═══ */}
        {!currentSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED' }}>
                    Active Sessions ({activeSessions.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeSessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      style={{
                        padding: '16px 18px', borderRadius: 16, background: 'var(--surface)',
                        border: '1.5px solid #DDD6FE', boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#7C3AED'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#DDD6FE'}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Started {formatDate(s.date)} · Spend: {formatAmount(s.total_spent ?? 0)}
                        </div>
                      </div>
                      <button style={{
                        padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        Open Workspace →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drafts */}
            {draftSessions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Drafts ({draftSessions.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {draftSessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      style={{
                        padding: '14px 16px', borderRadius: 14, background: 'var(--surface)',
                        border: '1px solid var(--border)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatDate(s.date)} · Saved as draft
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Resume →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closed Session History */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Session History ({closedSessions.length})
                </span>
              </div>
              {closedSessions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12, textAlign: 'center' }}>
                  <ReceiptText size={28} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No closed sessions yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {closedSessions.map(s => (
                    <HistoryCard
                      key={s.id}
                      session={s}
                      onEdit={handleEditSession}
                      onDelete={setDeletingId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SESSION EDITOR VIEW (when a session is selected/active) ═══ */}
        {currentSession && (
          <div>
            {/* Session Metadata Controls (Name & Date) */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12,
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
                  onChange={e => handleNameChange(e.target.value)}
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
                  onChange={e => handleDateChange(e.target.value)}
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShoppingBag size={15} style={{ color: 'var(--expense)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                      Goods Purchased
                    </span>
                  </div>
                  <button onClick={addItemRow} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'var(--expense-bg)', color: 'var(--expense)',
                    border: '1px solid var(--expense-border)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <Plus size={11} /> Add Row
                  </button>
                </div>

                <div style={tableStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px' }}>
                    <div style={thStyle}>Item Name</div>
                    <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
                    <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }} />
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ borderRight: '1px solid var(--border)' }}>
                        <input type="text" value={item.name} placeholder="Item description"
                          onChange={e => updateItem(item.id, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ borderRight: '1px solid var(--border)' }}>
                        <input type="text" inputMode="decimal" value={item.amount} placeholder="0"
                          onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateItem(item.id, 'amount', v); }}
                          style={{ ...inputStyle, fontWeight: 700, color: parseFloat(item.amount) > 0 ? 'var(--expense)' : 'var(--text-muted)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button onClick={() => removeItemRow(item.id)} disabled={items.length === 1} style={{
                          width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer',
                        }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <div style={{ padding: '9px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Total Spent</div>
                    <div style={{ padding: '9px 11px', fontSize: 13, fontWeight: 800, color: 'var(--expense)', borderRight: '1px solid var(--border)' }}>{formatAmount(totalSpent)}</div>
                    <div />
                  </div>
                </div>
              </div>

              {/* Money Received Table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <User size={15} style={{ color: 'var(--income)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                      Money Received
                    </span>
                  </div>
                  <button onClick={addReceivedRow} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'var(--income-bg)', color: 'var(--income)',
                    border: '1px solid var(--income-border)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <Plus size={11} /> Add Row
                  </button>
                </div>

                <div style={tableStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px' }}>
                    <div style={thStyle}>Person Name</div>
                    <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>Amount (₹)</div>
                    <div style={{ ...thStyle, borderLeft: '1px solid var(--border)' }} />
                  </div>
                  {received.map((row, idx) => (
                    <div key={row.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 130px 36px',
                      borderBottom: idx < received.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ borderRight: '1px solid var(--border)' }}>
                        <input type="text" value={row.person} placeholder="Person name"
                          onChange={e => updateReceived(row.id, 'person', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ borderRight: '1px solid var(--border)' }}>
                        <input type="text" inputMode="decimal" value={row.amount} placeholder="0"
                          onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateReceived(row.id, 'amount', v); }}
                          style={{ ...inputStyle, fontWeight: 700, color: parseFloat(row.amount) > 0 ? 'var(--income)' : 'var(--text-muted)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button onClick={() => removeReceivedRow(row.id)} disabled={received.length === 1} style={{
                          width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer',
                        }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <div style={{ padding: '9px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Total Received</div>
                    <div style={{ padding: '9px 11px', fontSize: 13, fontWeight: 800, color: 'var(--income)', borderRight: '1px solid var(--border)' }}>{formatAmount(totalReceived)}</div>
                    <div />
                  </div>
                </div>
              </div>
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
                <button onClick={handleDiscard} style={{
                  padding: '9px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
                  background: 'var(--surface2)', color: 'var(--expense)', border: '1px solid var(--border)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Discard
                </button>
                <button onClick={handleSaveDraft} style={{
                  padding: '9px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700,
                  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <Save size={13} /> Save Draft
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  disabled={!canClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 11,
                    background: canClose ? '#7C3AED' : 'var(--surface2)',
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
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.93); } to { opacity: 1; transform: scale(1); } }
        .external-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .external-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  );
}
