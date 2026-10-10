// ─── Desktop dashboard (≥1024px) ─────────────────────────────────
// Owns cross-section UI state (active section, modals, entry-form state);
// the dashboard view itself is composed from ./dashboard/* section cards.
import { useState, useMemo } from 'react';
import { useStats } from '../hooks/useStats';
import { useWastage } from '../hooks/useWastage';
import { computeBudgetStatus } from '../utils/budget';
import { generateInsights } from '../utils/insights';
import { categoryTotals, EMPTY_RULES } from '../utils/categories';
import { getCurrentMonthValue } from '../utils/periodHelpers';
import SettingsTab from '../features/settings/SettingsTab';
import PlanTab from '../features/plan/PlanTab';
import BudgetStatusCard from '../features/plan/components/BudgetStatusCard';
import DueRecurringCard from '../features/plan/components/DueRecurringCard';
import InsightsCard from '../features/stats/components/InsightsCard';
import CategoryBreakdown from '../features/stats/components/CategoryBreakdown';
import SpendingCalendar from '../features/stats/components/SpendingCalendar';
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
  themePref, onThemePrefChange,
  onSignOut, onDeleteAccount, onResetPassword, onResendVerification, theme, user, devices,
  restoreDeletedItem, permanentlyDeleteRecentlyDeletedItem, emptyTrash,
  isStandalone, canInstallNative, onTriggerInstall,
  recurring, onPatchSettings, onLearnCategory, reportError,
}) {
  const isMonoflow = theme === 'monoflow';
  // Use shared hooks
  const { stats, filtTxns, filtInc, pieData, areaData, C } = useStats(transactions, income, selectedPeriod, theme, settings);
  const wastage = useWastage(onUpdateTransaction);
  const categoryRules = settings?.categoryRules ?? EMPTY_RULES;

  const budgetStatus = useMemo(
    () => computeBudgetStatus({ budgets: settings?.budgets, transactions, monthKey: getCurrentMonthValue(), rules: categoryRules }),
    [settings?.budgets, transactions, categoryRules],
  );
  const insights = useMemo(
    () => generateInsights({ transactions, income, rules: categoryRules, budgetStatus, recurringRules: recurring?.rules ?? [], limit: 6 }),
    [transactions, income, categoryRules, budgetStatus, recurring?.rules],
  );
  const catTotals = useMemo(() => categoryTotals(filtTxns, categoryRules), [filtTxns, categoryRules]);

  /* ── UI state ── */
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashTxnView, setDashTxnView] = useState('today');
  const [showImport, setShowImport] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editingInc, setEditingInc] = useState(null);
  const [deletingTxnId, setDeletingTxnId] = useState(null);
  const [deletingIncId, setDeletingIncId] = useState(null);

  // Entry-form state stays here so it persists across section switches
  const quickForm  = useQuickEntryForm({ onAddTransaction, personDebts: stats.personDebts, categoryRules, onLearnCategory });
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
          categoryRules={categoryRules}
          onLearnCategory={onLearnCategory}
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
          message="It moves to Recently Deleted (Settings), where you can restore it."
          onConfirm={() => { onDeleteTransaction(deletingTxnId); setDeletingTxnId(null); }}
          onCancel={() => setDeletingTxnId(null)}
        />
      )}

      {/* Confirm Delete Income Modal */}
      {deletingIncId && (
        <ConfirmDeleteModal
          title="Delete income entry?"
          message="It moves to Recently Deleted (Settings), where you can restore it."
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
        onThemePrefChange={onThemePrefChange}
        dueCount={recurring?.manualDue.length ?? 0}
      />

      {/* ══ PLAN VIEW ══ */}
      {activeSection === 'plan' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
          <PlanTab transactions={transactions} settings={settings} onPatchSettings={onPatchSettings} recurring={recurring} embedded />
        </div>
      )}

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
            themePref={themePref}
            onThemePrefChange={onThemePrefChange}
            onSignOut={onSignOut}
            onDeleteAccount={onDeleteAccount}
            devices={devices}
            recurring={recurring}
            onResetPassword={onResetPassword}
            onResendVerification={onResendVerification}
            recentlyDeleted={recentlyDeleted}
            restoreDeletedItem={restoreDeletedItem}
            permanentlyDeleteRecentlyDeletedItem={permanentlyDeleteRecentlyDeletedItem}
            emptyTrash={emptyTrash}
            isStandalone={isStandalone}
            canInstallNative={canInstallNative}
            onTriggerInstall={onTriggerInstall}
            onPatchSettings={onPatchSettings}
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
            settings={settings}
            onLearnCategory={onLearnCategory}
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
            reportError={reportError}
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
            {recurring && recurring.manualDue.length > 0 && (
              <div style={{ marginBottom: -14 }}>
                <DueRecurringCard due={recurring.manualDue} onPost={recurring.post} onSkip={recurring.skip} onSkipAll={recurring.skipAllFor} compact />
              </div>
            )}
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
              categoryRules={categoryRules}
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
              setDeletingTxnId={setDeletingTxnId}
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

        {/* ── PLANNING ROW: insights · budget · categories · calendar ── */}
        <div style={{ padding: '14px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
          <InsightsCard insights={insights} compact />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <BudgetStatusCard status={budgetStatus} compact onEdit={() => setActiveSection('plan')} />
          </div>
          {catTotals.length > 0
            ? <CategoryBreakdown totals={catTotals} theme={theme} compact max={6} />
            : <div className="card" style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>No expenses in this period yet.</div>}
          <SpendingCalendar transactions={transactions} rules={categoryRules} theme={theme} />
        </div>
      </>)}
    </div>
  );
}
