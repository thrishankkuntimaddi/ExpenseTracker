// ─── Render smoke test ───────────────────────────────────────────
// Server-renders every screen that gained new features with realistic data.
// It cannot click anything, but it catches the class of bug lint and the
// bundler miss: a crash in render, a missing prop, a bad import.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../services/firebase', () => ({ auth: {}, db: {}, clearLocalFirestoreCache: async () => {}, default: {} }));
vi.mock('../services/firestore', () => ({
  subscribeToTrips: () => () => {}, upsertTrip: async () => {}, deleteTrip: async () => {},
  updateSettings: async () => {}, deleteAllUserData: async () => {}, bulkImport: async () => {},
  subscribeToExternalTransactions: () => () => {}, upsertExternalTransaction: async () => {},
  closeExternalTransaction: async () => {}, deleteExternalTransaction: async () => {},
  moveToRecentlyDeleted: async () => {}, roundMoney: (n) => n,
}));
vi.mock('../services/googleSheets', () => ({
  pushToSheet: async () => ({}), pullFromSheet: async () => ({}), validateSheet: async () => ({}),
  checkServerHealth: async () => false, SHEETS_SYNC_AVAILABLE: false,
}));

const { default: TodayTab } = await import('../features/transactions/TodayTab');
const { default: HistoryTab } = await import('../features/transactions/HistoryTab');
const { default: IncomeTab } = await import('../features/income/IncomeTab');
const { default: StatsTab } = await import('../features/stats/StatsTab');
const { default: PlanTab } = await import('../features/plan/PlanTab');
const { default: SettingsTab } = await import('../features/settings/SettingsTab');
const { default: DesktopDashboard } = await import('../components/DesktopDashboard');
const { default: EditTransactionModal } = await import('../components/EditTransactionModal');
const { default: RecurringRuleModal } = await import('../features/plan/RecurringRuleModal');
const { default: BudgetEditorModal } = await import('../features/plan/BudgetEditorModal');
const { default: GoalModal } = await import('../features/plan/GoalModal');
const { default: TripDetail } = await import('../features/trips/TripDetail');
const { default: TripModal } = await import('../features/trips/TripModal');
const { default: TripCloseModal } = await import('../features/trips/TripCloseModal');
const { default: TripsPanel } = await import('../features/trips/TripsPanel');
const { computeTripSummary } = await import('../utils/split');

const now = new Date();
const iso = (daysAgo, hour = 12) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const month = (isoStr) => isoStr.slice(0, 7);

const transactions = [
  { id: 't1', type: 'expense', name: 'Swiggy', amount: 320, date: iso(0), month: month(iso(0)), category: 'food' },
  { id: 't2', type: 'expense', name: 'Petrol', amount: 1500, date: iso(1), month: month(iso(1)) },
  { id: 't3', type: 'expense', name: 'Netflix', amount: 649, date: iso(3), month: month(iso(3)), wasteAmount: 649, recurringId: 'r2' },
  { id: 't4', type: 'savings', name: 'Nifty SIP', amount: 5000, savingsType: 'sip', platform: 'Zerodha', date: iso(2), month: month(iso(2)) },
  { id: 't5', type: 'person', direction: 'lent', name: 'Ravi', amount: 1000, date: iso(10), month: month(iso(10)) },
  { id: 't6', type: 'expense', name: 'House rent', amount: 12000, date: iso(35), month: month(iso(35)) },
  { id: 't7', type: 'expense', name: 'Zomato', amount: 450, date: iso(33), month: month(iso(33)) },
];
const income = [
  { id: 'i1', name: 'Salary', amount: 60000, date: iso(5), month: month(iso(5)) },
  { id: 'i3', name: 'Salary', amount: 60000, date: iso(35), month: month(iso(35)) },   // last month → carried forward
  { id: 'i2', name: 'Ravi', amount: 400, isRepaymentRec: true, date: iso(4), month: month(iso(4)) },
];
const settings = {
  theme: 'light', googleSheetUrl: '',
  carryForward: { enabled: true, startMonth: month(iso(0)), includeNegative: false },
  budgets: { total: 25000, categories: { food: 4000, fuel: 2000 } },
  categoryRules: { 'amazon': 'groceries' },
  goals: [{ id: 'g1', name: 'Emergency fund', target: 100000, startDate: '2026-01-01', deadline: '2027-01-01', savingsType: 'sip' }],
};
const rules = [
  { id: 'r1', name: 'House rent', amount: 12000, kind: 'expense', category: 'rent', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: true, autoPost: false },
  { id: 'r2', name: 'Netflix', amount: 649, kind: 'expense', category: 'subscriptions', frequency: 'monthly', dayOfMonth: 3, startDate: '2026-01-03', active: true, autoPost: true },
  { id: 'r3', name: 'Salary', amount: 60000, kind: 'income', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01', active: false },
];
const recurring = {
  rules, rulesLoaded: true,
  due: [{ rule: rules[0], dateKey: now.toLocaleDateString('en-CA') }, { rule: rules[1], dateKey: now.toLocaleDateString('en-CA') }],
  manualDue: [{ rule: rules[0], dateKey: now.toLocaleDateString('en-CA') }, { rule: rules[1], dateKey: now.toLocaleDateString('en-CA') }],
  upcoming: [{ rule: rules[1], next: '2099-01-03' }],
  post: async () => true, skip: async () => true, skipAllFor: async () => true,
  saveRule: async () => true, removeRule: async () => true, toggleActive: async () => true,
};
const period = { type: 'current_month', value: month(iso(0)) };
const noop = () => {};
const common = {
  transactions, income, settings, recurring, selectedPeriod: period, onPeriodChange: noop, theme: 'light',
  user: { uid: 'u', email: 'u@example.com' }, onPatchSettings: noop, onLearnCategory: noop, recentlyDeleted: [],
  restoreDeletedItem: noop, permanentlyDeleteRecentlyDeletedItem: noop, emptyTrash: noop,
};

const render = (el) => renderToStaticMarkup(el);

describe('screens render with planning features', () => {
  it('Expenses tab shows safe-to-spend, due recurring and category chips', () => {
    const html = render(<TodayTab {...common} onAdd={noop} />);
    expect(html).toContain('Safe to spend today');
    expect(html).toContain('recurring entries due');
    expect(html).toContain('Food &amp; Dining');
  });

  it('History tab shows search, category filter chips and badges', () => {
    const html = render(<HistoryTab {...common} onUpdateTransaction={noop} onDeleteTransaction={noop} onAddTransaction={noop} onAddIncome={noop} />);
    expect(html).toContain('history-search');
    expect(html).toContain('Fuel');
    expect(html).toContain('Subscriptions');
  });

  it('Stats tab shows insights, budget, category breakdown and calendar', () => {
    const html = render(<StatsTab {...common} />);
    expect(html).toContain('Insights');
    expect(html).toContain('Budget · this month');
    expect(html).toContain('By Category');
    expect(html).toContain('Spending Calendar');
    expect(html).toContain('Savings Goals');
  });

  it('Plan tab lists budget, recurring rules and goals', () => {
    const html = render(<PlanTab {...common} />);
    expect(html).toContain('Monthly Budget');
    expect(html).toContain('House rent');
    expect(html).toContain('Monthly on the 3rd');
    expect(html).toContain('paused');
    expect(html).toContain('Emergency fund');
    expect(html).toContain('Log all');
  });

  it('Plan tab renders its empty states', () => {
    const html = render(<PlanTab {...common} settings={{}} recurring={{ ...recurring, rules: [], manualDue: [], upcoming: [] }} />);
    expect(html).toContain('No budget set');
    expect(html).toContain('Nothing repeats yet');
    expect(html).toContain('No savings goals yet');
  });

  it('Settings tab offers CSV export and carry-forward controls', () => {
    const html = render(<SettingsTab {...common} onThemeChange={noop} onSignOut={noop} isStandalone />);
    expect(html).toContain('Export Spreadsheet (CSV)');
    expect(html).toContain('Month Carry Forward');
    expect(html).toContain('settings-carry-start');
  });


  it('Income tab shows last month\'s leftover as a non-editable carry-forward line', () => {
    const html = render(<IncomeTab {...common} onAddIncome={noop} onUpdateIncome={noop} onDeleteIncome={noop} onDeleteTransaction={noop} />);
    expect(html).toContain('Carried forward from');
    expect(html).toContain('Carry forward');
    expect(html).toContain('>auto<');
    // last month: 60000 − 12000 rent − 450 zomato − 1000 lent = 46550 carried in
    expect(html).toContain('46,550');
  });

  it('Stats balance includes the carried amount', () => {
    const html = render(<StatsTab {...common} />);
    // this month on its own: 60000 + 400 − 320 − 1500 − 649 − 5000 = 52,931; plus 46,550 carried in
    expect(html).toContain('99,481');
    // total income = 60000 salary + 400 repayment + 46,550 carry
    expect(html).toContain('1,06,950');
  });

  it('Desktop dashboard renders the planning row and nav', () => {
    const html = render(
      <DesktopDashboard {...common} onAddTransaction={noop} onUpdateTransaction={noop} onDeleteTransaction={noop}
        onAddIncome={noop} onUpdateIncome={noop} onDeleteIncome={noop} onThemeChange={noop} onSignOut={noop} />,
    );
    expect(html).toContain('Plan');
    expect(html).toContain('People');
    expect(html).toContain('Insights');
    expect(html).toContain('Spending Calendar');
    expect(html).toContain('Safe to spend today');
  });

  it('Trips: detail shows the settle-up plan, close modal offers ledger posting', async () => {
    const trip = {
      id: 'trip1', name: 'Goa road trip', status: 'open', meMemberId: 'p1', startDate: '2026-10-01', endDate: '2026-10-03',
      members: [{ id: 'p1', name: 'Arjun' }, { id: 'p2', name: 'Bala', groupId: 'g1' }, { id: 'p3', name: 'Chitra' }, { id: 'p4', name: 'Dev' }, { id: 'p5', name: 'Esha', groupId: 'g1' }],
      expenses: [
        { id: 'e1', title: 'Fuel', amount: 11000, paidBy: 'p1', splitAmong: [], date: '2026-10-01' },
        { id: 'e2', title: 'Hotel', amount: 8000, paidBy: 'p2', splitAmong: [], date: '2026-10-02' },
        { id: 'e3', title: 'Food', amount: 3000, paidBy: 'p3', splitAmong: [], date: '2026-10-02' },
        { id: 'e4', title: 'Drinks', amount: 2500, paidBy: 'p4', splitAmong: [], date: '2026-10-03' },
      ],
      settlements: [],
    };
    // open trip → step 1: the Person | What | Amount table comes first
    const step1 = render(<TripDetail trip={trip} onChange={noop} onEdit={noop} onShare={noop} onClose={noop} onReopen={noop} />);
    expect(step1).toContain('What paid');
    expect(step1).toContain('Add Row');
    expect(step1).toContain('Done — see who pays whom');
    expect(step1).toContain('Drag to reorder');
    expect(step1).toContain('Tap a person to set');
    expect(step1).toContain('24,500');
    // closed trip → step 2: the settlement
    const html = render(<TripDetail trip={{ ...trip, status: 'closed' }} onChange={noop} onEdit={noop} onShare={noop} onClose={noop} onReopen={noop} onDelete={noop} />);
    expect(html).toContain('Delete');
    expect(html).toContain('Who pays whom');
    expect(html).toContain('Bala &amp; Esha');
    expect(html).toContain('24,500');
    expect(html).toContain('2,400');   // Dev → Arjun
    expect(html).toContain('one wallet');
    const close = render(<TripCloseModal trip={trip} summary={computeTripSummary(trip)} onConfirm={noop} onClose={noop} />);
    expect(close).toContain('Log my share as an expense');
    expect(close).toContain('4,900');
    expect(render(<TripModal trip={trip} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Pays with');
    expect(render(<TripsPanel user={{ uid: 'u' }} onAddTransaction={noop} onDeleteTransaction={noop} />)).toContain('No trips yet');
    const { default: TripsList } = await import('../features/trips/components/TripsList');
    const list = render(<TripsList activeTrips={[trip]} closedTrips={[{ ...trip, id: 'c1', status: 'closed' }]} archivedTrips={[{ ...trip, id: 'a1', status: 'archived' }]}
      showHistory setShowHistory={noop} showArchived setShowArchived={noop} onOpen={noop} onShare={noop} onEdit={noop} onDelete={noop} onArchive={noop} onUnarchive={noop} onNew={noop} />);
    expect(list).toContain('Active Trips (1)');
    expect(list).toContain('Trip History (1)');
    expect(list).toContain('Archived (1)');
    expect(list).toContain('Share summary');
    expect(list).toContain('Unarchive');
  });

  it('modals render for new and existing records', () => {
    expect(render(<EditTransactionModal txn={transactions[1]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Fuel');
    expect(render(<RecurringRuleModal rule={null} onSave={noop} onClose={noop} />)).toContain('New Recurring Entry');
    expect(render(<RecurringRuleModal rule={rules[0]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Edit Recurring');
    expect(render(<BudgetEditorModal budgets={settings.budgets} transactions={transactions} onSave={noop} onClose={noop} />)).toContain('Suggest from history');
    expect(render(<GoalModal goal={settings.goals[0]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Edit Goal');
  });
});
