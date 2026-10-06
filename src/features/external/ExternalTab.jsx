import { useState, useCallback, useMemo } from 'react';
import { useExternalTransactions } from '../../hooks/useExternalTransactions';
import { todayInputValue, dateInputToISO, isoToDateInput, isoToMonth } from '../../utils/dateHelpers';
import { filterItemsByPeriod } from '../../utils/periodHelpers';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import ShareBillingModal from './ShareBillingModal';
import { calcTotals, newItemRow, newReceivedRow } from './components/billingHelpers';
import NewBillingModal from './components/NewBillingModal';
import ConfirmCloseModal from './components/ConfirmCloseModal';
import SessionsList from './components/SessionsList';
import SessionEditor from './components/SessionEditor';
import BillingsHeader from './components/BillingsHeader';
import ModeToggle from './components/ModeToggle';
import TripsPanel from '../trips/TripsPanel';


/* ═══════════════════════════════════════════════════════════════
   MAIN ExternalTab
   Supports multiple sessions (Active, Drafts, History), name & date!
═══════════════════════════════════════════════════════════════ */
export default function ExternalTab({
  user,
  transactions = [], income = [],
  onAddIncome, onUpdateIncome, onDeleteIncome,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  selectedPeriod, reportError,
}) {
  const [mode, setMode] = useState('billings');   // 'billings' | 'trips'
  const {
    sessions, saving,
    createSession, updateSession, saveDraftSession,
    discardSession, closeSession, deleteSession, reopenSession,
    archiveSession, unarchiveSession,
  } = useExternalTransactions(user?.uid);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showNewModal, setShowNewModal]       = useState(false);
  const [showCloseModal, setShowCloseModal]   = useState(false);
  const [deletingId, setDeletingId]           = useState(null);
  const [closing, setClosing]                 = useState(false);
  const [showArchived, setShowArchived]       = useState(false);
  const [showHistory, setShowHistory]         = useState(false);
  const [sharingSession, setSharingSession]   = useState(null);

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

  const { totalSpent, totalReceived, netBalance } = useMemo(
    () => calcTotals(items, received),
    [items, received]
  );

  function handleShareCurrentSession() {
    if (!currentSession) return;
    setSharingSession({
      ...currentSession,
      name: sessionName || currentSession.name || 'Billing Session',
      date: dateInputToISO(sessionDate),
      items: items,
      received: received,
      total_spent: totalSpent,
      total_received: totalReceived,
      net_balance: netBalance,
    });
  }

  /* ── Sync local rows when the active session *changes* ──
     Done during render (React's "adjust state on prop change" pattern) and
     keyed on id only, so live snapshots of the same session never clobber
     the user's in-progress edits. */
  const currentId = currentSession?.id ?? null;
  const [syncedId, setSyncedId] = useState(null);
  if (currentId !== syncedId) {
    setSyncedId(currentId);
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
  }



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


  function reorderItemRows(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;
    setItemRows(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      triggerSave(sessionName, sessionDate, next, received);
      return next;
    });
  }

  function reorderReceivedRows(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= received.length || toIndex >= received.length) return;
    setReceivedRows(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
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
        {
          onAddIncome, onUpdateIncome, onDeleteIncome,
          onAddTransaction, onUpdateTransaction, onDeleteTransaction,
          transactions, income,
        }
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
    discardSession(activeSessionId, { onDeleteIncome, onDeleteTransaction, transactions, income });
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
  const activeSessions   = sessions.filter(s => s.status === 'open');
  const draftSessions    = sessions.filter(s => s.status === 'draft');
  const archivedSessions = sessions.filter(s => s.status === 'archived');
  const closedSessions   = selectedPeriod
    ? filterItemsByPeriod(sessions.filter(s => s.status === 'closed'), selectedPeriod)
    : sessions.filter(s => s.status === 'closed');

  const hasItems    = items.some(i => i.name?.trim() && parseFloat(i.amount) > 0);
  const hasReceived = received.some(r => r.person?.trim() && parseFloat(r.amount) > 0);
  const canClose    = hasItems && hasReceived;



  if (mode === 'trips') {
    return (
      <TripsPanel
        user={user}
        onAddTransaction={onAddTransaction}
        onDeleteTransaction={onDeleteTransaction}
        reportError={reportError}
        headerExtra={<ModeToggle mode={mode} onChange={setMode} />}
      />
    );
  }

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
          onConfirm={() => { deleteSession(deletingId, { onDeleteIncome, onDeleteTransaction, transactions, income }); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Share Billing Modal */}
      {sharingSession && (
        <ShareBillingModal
          session={sharingSession}
          onClose={() => setSharingSession(null)}
        />
      )}

      {/* Header */}
      <BillingsHeader
        currentSession={currentSession}
        saving={saving}
        onBack={() => setActiveSessionId(null)}
        onShare={handleShareCurrentSession}
        onNew={() => setShowNewModal(true)}
        extra={!currentSession ? <ModeToggle mode={mode} onChange={setMode} /> : null}
      />

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>

        {/* ═══ SESSIONS LIST VIEW (when no session is open for editing) ═══ */}
        {!currentSession && (
          <SessionsList
            activeSessions={activeSessions}
            draftSessions={draftSessions}
            closedSessions={closedSessions}
            archivedSessions={archivedSessions}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showArchived={showArchived} setShowArchived={setShowArchived}
            setActiveSessionId={setActiveSessionId}
            setSharingSession={setSharingSession}
            setDeletingId={setDeletingId}
            handleEditSession={handleEditSession}
            archiveSession={archiveSession}
            unarchiveSession={unarchiveSession}
          />
        )}

        {/* ═══ SESSION EDITOR VIEW (when a session is selected/active) ═══ */}
        {currentSession && (
          <SessionEditor
            sessionName={sessionName}
            sessionDate={sessionDate}
            onNameChange={handleNameChange}
            onDateChange={handleDateChange}
            items={items}
            received={received}
            totalSpent={totalSpent}
            totalReceived={totalReceived}
            netBalance={netBalance}
            onAddItem={addItemRow}
            onUpdateItem={updateItem}
            onRemoveItem={removeItemRow}
            onReorderItems={reorderItemRows}
            onAddReceived={addReceivedRow}
            onUpdateReceived={updateReceived}
            onRemoveReceived={removeReceivedRow}
            onReorderReceived={reorderReceivedRows}
            canClose={canClose}
            onDiscard={handleDiscard}
            onShare={handleShareCurrentSession}
            onSaveDraft={handleSaveDraft}
            onRequestClose={() => setShowCloseModal(true)}
          />
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
