// ─── Desktop dashboard (≥1024px) ─────────────────────────────────
// Owns cross-section UI state (active section, modals, entry-form state);
// the dashboard view itself is composed from ./dashboard/* section cards.
import { useState, useMemo } from 'react';
import { useStats } from '../hooks/useStats';
import { useWastage } from '../hooks/useWastage';
import SettingsTab from '../features/settings/SettingsTab';
import ExternalTab from '../features/external/ExternalTab';
import HistoryTab from '../features/transactions/HistoryTab';
import PersonsPanel from '../features/persons/PersonsPanel';
import EditTransactionModal from './EditTransactionModal';
import EditIncomeModal from './EditIncomeModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import LoadMonthlyData from './LoadMonthlyData';
import DashboardHeader from './dashboard/DashboardHeader';
import SummaryStrip from './dashboard/SummaryStrip';
import QuickEntryCard from './dashboard/QuickEntryCard';
import EntriesCard from './dashboard/EntriesCard';
import IncomeEntryCard from './dashboard/IncomeEntryCard';
import AnalyticsCard from './dashboard/AnalyticsCard';
import { useQuickEntryForm, useIncomeEntryForm } from './dashboard/useEntryForms';

/* ═══════════════════════════════════════════════════════════════ */
export default function DesktopDashboard({
  transactions, income, settings, recentlyDeleted = [],
  selectedPeriod, onPeriodChange,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  onAddIncome, onUpdateIncome, onDeleteIncome,
  onThemeChange,
  onSignOut, theme, user,
  restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  isStandalone, canInstallNative, onTriggerInstall,
}) {
  const isMonoflow = theme === 'monoflow';
  // Use shared hooks
  const { stats, filtTxns, filtInc, pieData, areaData, C } = useStats(transactions, income, selectedPeriod, theme);
  const wastage = useWastage(onUpdateTransaction);

  /* ── UI state ── */
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashTxnView, setDashTxnView] = useState('today');
  const [showImport, setShowImport] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editingInc, setEditingInc] = useState(null);
  const [deletingTxnId, setDeletingTxnId] = useState(null);
  const [deletingIncId, setDeletingIncId] = useState(null);

  // Entry-form state stays here so it persists across section switches
  const quickForm  = useQuickEntryForm({ onAddTransaction, personDebts: stats.personDebts });
  const incomeForm = useIncomeEntryForm({ onAddIncome, personDebts: stats.personDebts });

  /* ── Today's entries ── */
  const todayTxns = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [transactions]);
  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);

  const positive = stats.balance >= 0;

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onSave={onUpdateTransaction}
          onDelete={onDeleteTransaction}
          onClose={() => setEditingTxn(null)}
        />
      )}

      {/* Edit Income Modal */}
      {editingInc && onUpdateIncome && (
        <EditIncomeModal
          entry={editingInc}
          onSave={onUpdateIncome}
          onDelete={onDeleteIncome}
          onClose={() => setEditingInc(null)}
        />
      )}

      {/* Confirm Delete Transaction Modal */}
      {deletingTxnId && (
        <ConfirmDeleteModal
          title="Delete transaction?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteTransaction(deletingTxnId); setDeletingTxnId(null); }}
          onCancel={() => setDeletingTxnId(null)}
        />
      )}

      {/* Confirm Delete Income Modal */}
      {deletingIncId && (
        <ConfirmDeleteModal
          title="Delete income entry?"
          message="This action cannot be undone."
          onConfirm={() => { onDeleteIncome(deletingIncId); setDeletingIncId(null); }}
          onCancel={() => setDeletingIncId(null)}
        />
      )}

      {/* Load Monthly Data modal */}
      {showImport && (
        <LoadMonthlyData
          onClose={() => setShowImport(false)}
          transactions={transactions}
          income={income}
        />
      )}

      {/* ══ HEADER ══ */}
      <DashboardHeader
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
        transactions={transactions}
        income={income}
        stats={stats}
        positive={positive}
        isMonoflow={isMonoflow}
        onThemeChange={onThemeChange}
      />

      {/* ══ SETTINGS VIEW ══ */}
      {activeSection === 'settings' && (
        <div className="desktop-settings-host" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
          <style>{`
            .desktop-settings-host .tab-root {
              height: auto !important;
              overflow: visible !important;
              min-height: unset !important;
            }
            .desktop-settings-host .tab-header {
              position: static !important;
            }
            .desktop-settings-host .tab-body {
              overflow: visible !important;
              flex: unset !important;
            }
          `}</style>
          <SettingsTab
            settings={settings}
            theme={theme}
            user={user}
            transactions={transactions}
            income={income}
            onThemeChange={onThemeChange}
            onSignOut={onSignOut}
            recentlyDeleted={recentlyDeleted}
            restoreDeletedItem={restoreDeletedItem}
            permanentlyDeleteRecentlyDeletedItem={permanentlyDeleteRecentlyDeletedItem}
            emptyTrash={emptyTrash}
            isStandalone={isStandalone}
            canInstallNative={canInstallNative}
            onTriggerInstall={onTriggerInstall}
          />
        </div>
      )}

      {/* ══ HISTORY VIEW ══ */}
      {activeSection === 'history' && (
        <div className="desktop-history-host" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <HistoryTab
            transactions={transactions}
            income={income}
            selectedPeriod={selectedPeriod}
            onPeriodChange={onPeriodChange}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            onAddTransaction={onAddTransaction}
            onAddIncome={onAddIncome}
          />
        </div>
      )}

      {/* ══ BILLINGS VIEW ══ */}
      {activeSection === 'external' && (
        <div className="desktop-external-host" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <ExternalTab
            user={user}
            onAddIncome={onAddIncome}
            onUpdateIncome={onUpdateIncome}
            onDeleteIncome={onDeleteIncome}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            selectedPeriod={selectedPeriod}
            theme={theme}
          />
        </div>
      )}

      {/* ══ PEOPLE VIEW ══ */}
      {activeSection === 'people' && (
        <div className="desktop-people-host" style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 28px 28px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <PersonsPanel
            transactions={transactions}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      {/* ══ DASHBOARD VIEW ══ */}
      {activeSection === 'dashboard' && (<>

        {/* ── SUMMARY STRIP ── */}
        <SummaryStrip stats={stats} positive={positive} />

        {/* ── MAIN GRID ── */}
        <div style={{ padding: '14px 28px 0', display: 'grid', gridTemplateColumns: '400px 1fr', gap: 14, alignItems: 'start' }}>

          {/* LEFT: Entry form + Today's entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <QuickEntryCard
              form={quickForm}
              stats={stats}
              todayTotal={todayTotal}
              todayCount={todayTxns.length}
            />
            <EntriesCard
              dashTxnView={dashTxnView}
              setDashTxnView={setDashTxnView}
              todayTxns={todayTxns}
              filtTxns={filtTxns}
              setActiveSection={setActiveSection}
              wastage={wastage}
              setEditingTxn={setEditingTxn}
              setDeletingTxnId={setDeletingTxnId}
              onDeleteTransaction={onDeleteTransaction}
            />
          </div>

          {/* RIGHT: Income + Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
            <IncomeEntryCard
              form={incomeForm}
              stats={stats}
              filtInc={filtInc}
              filtTxns={filtTxns}
              income={income}
              transactions={transactions}
              onUpdateIncome={onUpdateIncome}
              onDeleteIncome={onDeleteIncome}
              onDeleteTransaction={onDeleteTransaction}
              setEditingInc={setEditingInc}
              setDeletingIncId={setDeletingIncId}
            />
            <AnalyticsCard
              stats={stats}
              pieData={pieData}
              areaData={areaData}
              C={C}
              selectedPeriod={selectedPeriod}
            />
          </div>
        </div>
      </>)}
    </div>
  );
}
