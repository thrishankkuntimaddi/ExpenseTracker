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
vi.mock('../services/sharedTrips', () => ({
  subscribeToSharedTrips: () => () => {}, subscribeToSharedTripItems: () => () => {}, getSharedTrip: () => new Promise(() => {}),
  createSharedTrip: async () => 'x', updateSharedTrip: async () => {}, saveSharedExpense: async () => {}, deleteSharedExpense: async () => {},
  addSharedSettlement: async () => {}, deleteSharedSettlement: async () => {}, deleteSharedTrip: async () => {},
  joinSharedTrip: async () => 'm', linkFriendToTrip: async () => {}, unlinkAccount: async () => {},
}));

const { default: TodayTab } = await import('../features/transactions/TodayTab');
const { default: HistoryTab } = await import('../features/transactions/HistoryTab');
const { default: IncomeTab } = await import('../features/income/IncomeTab');
const { default: StatsTab } = await import('../features/stats/StatsTab');
const { default: DebtsPage } = await import('../features/debts/DebtsPage');
const { ShellContext } = await import('../app/shellContext');
const { default: SettingsTab } = await import('../features/settings/SettingsTab');
const { default: ProfilePage } = await import('../features/profile/ProfilePage');
const { default: AddSheet } = await import('../components/AddSheet');
const { default: BillsPage } = await import('../features/bills/BillsPage');
const { default: BudgetPage } = await import('../features/budget/BudgetPage');
const { default: SavingsPage } = await import('../features/savings/SavingsPage');
const { default: EditTransactionModal } = await import('../components/EditTransactionModal');
const { default: RecurringRuleModal } = await import('../features/plan/RecurringRuleModal');
const { default: BudgetEditorModal } = await import('../features/plan/BudgetEditorModal');
const { default: GoalModal } = await import('../features/plan/GoalModal');
const { default: TripDetail } = await import('../features/trips/TripDetail');
const { default: TripModal } = await import('../features/trips/TripModal');
const { default: TripCloseModal } = await import('../features/trips/TripCloseModal');
const { default: TripsPanel } = await import('../features/trips/TripsPanel');
const { computeTripSummary } = await import('../utils/split');

// Fixtures are relative to "now"; pin it to the 8th so the
// carry-forward expectations (days 10–35 back are last month) hold whatever today is.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 9, 8, 12));
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
  theme: 'light',
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
  it('Home shows safe-to-spend, bills due and category chips', () => {
    const html = render(<TodayTab {...common} onAdd={noop} />);
    expect(html).toContain('Safe to spend today');
    expect(html).toMatch(/Due · \d+ late/);
    expect(html).toContain('House rent');          // the rent rule is overdue → listed with Pay
    expect(html).toContain('Food &amp; Dining');
  });

  it('Home: no bills section when nothing is due; Explore in the chosen order', () => {
    const shell = { goTo: noop, barTabs: ['history', 'bills', 'stats'], month: month(iso(0)), setMonth: noop, user: common.user, openProfile: noop, openAdd: noop, toast: noop };
    const html = render(<ShellContext.Provider value={shell}><TodayTab {...common} onAdd={noop} recurring={{ ...recurring, rules: [] }} /></ShellContext.Provider>);
    expect(html).not.toContain('home-bills');
    const order = ['income', 'trips', 'external', 'budget', 'people', 'savings'].map((k) => html.indexOf(`id="explore-${k}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain('id="explore-bills"');      // it's in the bar
    expect(html).toContain('₹600 owed to you');            // Ravi: lent 1,000, paid back 400 (as income)
    expect(html).toContain('id="month-prev"');              // the month switcher sits on the overview card
    expect(html).not.toContain('id="home-add-panel"');      // phone: the "+" sheet, not an inline form
  });

  it('Home on wide screens: the full Add form, no quick entry', () => {
    const shell = { goTo: noop, barTabs: ['history', 'bills', 'stats'], month: month(iso(0)), setMonth: noop, user: common.user, openProfile: noop, openAdd: noop, toast: noop, desktop: true };
    const html = render(<ShellContext.Provider value={shell}><TodayTab {...common} onAdd={noop} onAddIncome={noop} /></ShellContext.Provider>);
    expect(html).toContain('id="home-add-panel"');
    expect(html).not.toContain('id="home-quick-entry"');
    for (const k of ['expense', 'income', 'debt', 'savings']) expect(html).toContain(`id="add-kind-${k}"`);
    expect(html).not.toMatch(/autofocus/i);                        // opening Home doesn't grab the keyboard
  });

  it('Add: what it is for comes first, then the amount — every kind', () => {
    const first = { expense: 'add-name', income: 'income-name', debt: 'debt-name', savings: 'savings-name' };
    for (const [kind, id] of Object.entries(first)) {
      const html = render(<AddSheet {...common} initialKind={kind} onAdd={noop} onAddIncome={noop} onClose={noop} />);
      const name = html.indexOf(`id="${id}"`), amount = html.indexOf('id="add-amount"');
      expect(name, kind).toBeGreaterThan(0);
      expect(amount, kind).toBeGreaterThan(name);
      expect(html.slice(html.lastIndexOf('<input', name), html.indexOf('>', name)), kind).toMatch(/autofocus/i);   // the keyboard opens on it
    }
  });

  it('History tab shows search, category filter chips and badges', () => {
    const html = render(<HistoryTab {...common} onUpdateTransaction={noop} onDeleteTransaction={noop} onAddTransaction={noop} onAddIncome={noop} />);
    expect(html).toContain('history-search');
    expect(html).toContain('Fuel');
    expect(html).toContain('Subscriptions');
  });

  it('History: money in and out in one list — kind, signed amount, status, edit and delete', () => {
    const html = render(<HistoryTab {...common} onUpdateTransaction={noop} onDeleteTransaction={noop} onUpdateIncome={noop} onDeleteIncome={noop} />);
    expect(html).toContain('class="hist-row"');
    expect(html).toMatch(/class="hist-kind"[^>]*>Expense</);
    expect(html).toMatch(/class="hist-kind"[^>]*>(Income|Got back|Borrowed)</);   // money-in entries are listed too
    expect(html).toMatch(/hist-amount[^>]*>\+₹/);                                // money in: +
    expect(html).toMatch(/hist-amount[^>]*>−₹/);                                   // money out: −
    expect(html).toMatch(/hist-status[^>]*>.*?(Done|Open|Settled)/);
    expect(html).toMatch(/aria-label="Edit [^"]+"/);
    expect(html).toMatch(/aria-label="Delete [^"]+"/);
    expect(html).toContain('id="history-kinds"');
  });

  it('Add → Expense: several items in one line become one expense each', async () => {
    const { parseQuickEntries } = await import('../utils/smartInput');
    expect(parseQuickEntries('coffee 250 water 50 tea 150')).toHaveLength(3);
  });

  it('Stats: balance, breakdown, calendar, where the money went (by category), then the monthly report', () => {
    const html = render(<StatsTab {...common} />);
    const at = (t) => html.indexOf(t);
    for (const t of ['Remaining balance', 'Breakdown', 'Spending Calendar', 'Where the money went', 'Monthly report']) expect(at(t)).toBeGreaterThan(-1);
    expect(at('Breakdown')).toBeLessThan(at('Spending Calendar'));
    expect(at('Spending Calendar')).toBeLessThan(at('Where the money went'));
    expect(html).not.toContain('Spending by category');      // one card: the donut is split by category
    const went = html.slice(at('id="money-went"'));
    expect(went).toMatch(/Food &amp; Dining|Groceries|Transport|Shopping/);   // categories, not just "Expense"
    expect(went.slice(0, went.indexOf('Monthly report'))).not.toContain('>Expense<');
    expect(html).toContain('id="report-day"');
    expect(html).not.toContain('Last 14 Days');
    expect(html).not.toContain('Month Trend');
    expect(html).not.toContain('id="report-banner"');        // report day is the 1st, the clock the 8th: the banner only shows for 3 days
    const fresh = render(<StatsTab {...common} settings={{ ...settings, report: { day: 7 } }} />);
    expect(fresh).toContain('id="report-banner"');
  });

  it('Bills page shows the month timeline, presets and every rule', () => {
    const html = render(<BillsPage {...common} />);
    expect(html).toContain('Bills &amp; payments');
    expect(html).toContain('House rent');
    expect(html).toContain('7 days late');                 // rent was due on the 1st (test clock: the 8th)
    expect(html).toContain('id="preset-electricity"');     // only two bills so far → common payments shown
    expect(html).toContain('id="preset-term"');
    expect(html).toContain('All regular payments');
    expect(html).toContain('Every 3rd · Subscriptions · auto');
  });

  it('Budget page: envelopes and six months when a budget is set; a ready-made one when not', () => {
    const set = render(<BudgetPage {...common} />);
    expect(set).toContain('Left to spend');
    expect(set).toContain('id="budget-plan"');
    expect(set).toContain('Left to save or spare');
    expect(set).toContain('Add tax, PF…');
    expect(set).toContain('By category');
    expect(set).toContain('Last 6 months');
    const none = render(<BudgetPage {...common} settings={{}} />);
    expect(none).toContain('Your budget, ready to go');
    expect(none).toContain('budget-use-suggestion');
  });

  it('Savings page shows rate, where it goes and goals', () => {
    const html = render(<SavingsPage {...common} />);
    expect(html).toContain('Saved in October');
    expect(html).toContain('Where it goes');
    expect(html).toContain('SIP');
    expect(html).toContain('Emergency fund');
  });

  it('Debts: money paid back as income counts; gifts are left out', () => {
    const tx = [...transactions, { id: 'g', type: 'person', direction: 'given_gift', name: 'Sita', amount: 300, date: iso(1) }];
    const html = render(<DebtsPage {...common} transactions={tx} />);
    expect(html).toContain('Owed to you');
    expect(html).toContain('Ravi');
    expect(html).toContain('₹600.00');
    expect(html).not.toContain('Sita');
    const empty = render(<DebtsPage {...common} transactions={[]} income={[]} />);
    expect(empty).toContain('No debts yet');
  });

  it('Goals: kept with someone, monthly share, move / used / collect', () => {
    const goals = [
      { id: 'g2', name: 'Bike', target: 100000, monthly: 20000, heldWith: 'Pritam', linked: true, startDate: '2026-09-01', moves: [] },
      { id: 'g3', name: 'Phone', target: 1000, linked: true, heldWith: 'Cash', startDate: '2026-09-01' },
      { id: 'g4', name: 'Trip', target: 5000, linked: true, status: 'used', endedOn: '2026-09-20', endNote: 'Hospital' },
    ];
    const tx = [...transactions, { id: 'gs', type: 'savings', goalId: 'g3', amount: 1000, date: iso(1) }];
    const html = render(<SavingsPage {...common} transactions={tx} settings={{ ...settings, goals }} />);
    expect(html).toContain('Kept with <strong');
    expect(html).toContain('Pritam');
    expect(html).toContain('₹20,000.00 still to put aside this month');
    expect(html).toContain('id="goal-move-g2"');
    expect(html).toContain('id="goal-used-g2"');
    expect(html).toContain('id="goal-collect-g3"');        // reached → collect it
    expect(html).toContain('Finished · 1');
  });

  it('Profile shows the account, appearance, customize and every settings section', () => {
    const user = { uid: 'u', email: 'asha@example.com', displayName: 'Asha Rao', emailVerified: true, providerData: [{ providerId: 'google.com' }], metadata: { creationTime: '2025-02-01T00:00:00Z' } };
    const html = render(<ProfilePage {...common} user={user} onThemePrefChange={noop} onSignOut={noop} onBack={noop}
      settings={{ ...settings, ui: { tabs: ['plan', 'today', 'stats', 'income'], start: 'stats' } }} devices={{ devices: [{ id: 'd' }], thisId: 'd' }} />);
    expect(html).toContain('Asha Rao');
    expect(html).toContain('AR');                            // initials avatar
    expect(html).toContain('Member since February 2025');
    // One pattern: quick switches, then sections of rows that open their setting
    for (const t of ['Appearance', 'Theme', 'Animations', 'Notifications', 'Reminders', 'Customize', 'Bottom bar', 'Home screen', 'Open the app on',
      'Money', 'Currency', 'Month Carry Forward', 'Backup &amp; sync', 'Sync', 'Data Management', 'App', 'Account', 'Reset']) expect(html).toContain(t);
    for (const id of ['reminders', 'custom-bar', 'custom-home', 'custom-start', 'currency', 'month-carry-forward', 'sync', 'data-management', 'account', 'reset']) expect(html).toContain(`id="group-${id}"`);
    expect(html).toContain('INR · Indian rupee');           // row summaries say what's set
    expect(html).not.toContain('id="reminder-daily"');       // settings open on tap, not all at once
    expect(html).toContain('class="profile-detail"');        // the panel beside (wide) / instead of (phone) the list
    expect(html).toContain('Home · Bills · Stats · Money in');  // bar summary follows settings.ui (Home fixed first; Plan → Bills)
    expect(html.match(/id="theme-(light|dark|system)"/g)).toHaveLength(3);   // one theme picker, not two
  });

  it('the + sheet: four kinds, each with an amount field and a save button', () => {
    const kinds = { expense: 'btn-save-entry', income: 'btn-save-income', debt: 'btn-save-debt', savings: 'btn-save-savings' };
    for (const [kind, save] of Object.entries(kinds)) {
      const html = render(<AddSheet {...common} initialKind={kind} onAdd={noop} onAddIncome={noop} onClose={noop} />);
      for (const k of Object.keys(kinds)) expect(html).toContain(`id="add-kind-${k}"`);
      expect(html).toContain(save);
      expect(html).toContain('id="add-amount"');
    }
    const exp = render(<AddSheet {...common} onAdd={noop} onAddIncome={noop} onClose={noop} />);
    expect(exp).toContain('Given to someone');
    const debt = render(<AddSheet {...common} initialKind="person" onAdd={noop} onAddIncome={noop} onClose={noop} />);
    for (const m of ['lent', 'borrowed', 'got_back', 'paid_back']) expect(debt).toContain(`id="debt-move-${m}"`);
    const sav = render(<AddSheet {...common} initialKind="savings" options={{ goalId: 'g1' }} onAdd={noop} onAddIncome={noop} onClose={noop} />);
    expect(sav).toContain('id="savings-goal-g1"');
    expect(sav).toContain('placeholder="Emergency fund (optional name)"');   // pre-selected goal
  });

  it('Home renders sections in the customised order and hides switched-off ones', () => {
    const html = render(<TodayTab {...common} onAdd={noop} settings={{ ...settings, ui: { homeOrder: ['recent', 'add', 'overview', 'bills'], homeHidden: ['overview'] } }} />);
    expect(html).not.toContain('id="home-summary"');
    expect(html.indexOf('home-recent')).toBeLessThan(html.indexOf('home-add'));
    expect(html.indexOf('home-add')).toBeLessThan(html.indexOf('home-bills'));
  });

  it('Settings tab groups everything into collapsible sections with summaries', () => {
    const html = render(<SettingsTab {...common} onThemePrefChange={noop} onSignOut={noop} isStandalone />);
    for (const title of ['Sync', 'Appearance', 'Month Carry Forward', 'Data Management', 'Account', 'Reset']) expect(html).toContain(title);
    expect(html).toContain('Backup, import, export, trash');   // closed groups show a summary line
    expect(html).toContain('aria-expanded="false"');
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
    // open trip → one screen: the Person | What | Amount sheet and the live settlement side by side
    const open = render(<TripDetail trip={trip} onChange={noop} onEdit={noop} onShare={noop} onClose={noop} onReopen={noop} />);
    expect(open).toContain('data-sheet="trip-sheet"');
    for (const h of ['Person', 'What', 'Amount ₹']) expect(open).toContain(`>${h}<`);
    expect(open).toMatch(/data-r="4"[^>]*data-c="0"/);              // 4 rows + the empty row to type into
    expect(open).toContain('Who pays whom');                          // no second step: the plan is right there
    expect(open).not.toContain('Done — see who pays whom');
    expect(open).toContain('24,500');
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
    expect(list).toContain('Active trips · 1');
    expect(list).toContain('Trip History (1)');
    expect(list).toContain('Archived (1)');
    expect(list).toContain('Share summary');
    expect(list).toContain('Unarchive');
  });

  it('Shared trip: a friend sees every row, edits only their wallet\'s, and cannot close', async () => {
    const goa = {
      id: 'goaSharedTripId1234', name: 'Goa', status: 'open', shared: true, isOwner: false, ownerUid: 'uMe', ownerName: 'Thrishank',
      meMemberId: 'ha', startDate: '2026-10-01',
      members: [{ id: 'me', name: 'Thrishank' }, { id: 'mu', name: 'Muza', groupId: 'w' }, { id: 'ha', name: 'Hanudeep', groupId: 'w' }, { id: 'pr', name: 'Preetham' }],
      uidMember: { uMe: 'me', uMu: 'mu', uHa: 'ha' }, memberUids: ['uMe', 'uMu', 'uHa'],
      people: { uMe: { name: 'Thrishank K' }, uMu: { name: 'Muza' }, uHa: { name: 'Hanudeep' } },
      expenses: [
        { id: '1_a', title: 'Fuel', amount: 4000, paidBy: 'me' },
        { id: '2_b', title: 'Lunch', amount: 4000, paidBy: 'mu' },
      ],
      settlements: [],
    };
    const ops = { saveRows: noop, addSettlement: noop, removeSettlement: noop };
    const friend = render(<TripDetail trip={goa} ops={ops} onChange={noop} onShare={noop} onInvite={noop} onClose={noop} onReopen={noop} onDelete={noop} />);
    expect(friend).toContain('sheet-locked');                                       // Thrishank's row is read-only for Hanudeep
    expect(friend).toMatch(/class="sheet-row"[^>]*>(?:(?!sheet-row).)*Lunch/s);     // Muza's (wallet partner) row is editable
    expect(friend).not.toContain('Close trip');
    expect(friend).not.toContain('Invite');
    expect(friend).toContain('Shared by Thrishank');
    expect(friend).toContain('Hanudeep</strong> <span style="color:var(--text-muted)">owes</span> <strong>Muza');
    expect(friend).toContain('Where the money went');
    const owner = render(<TripDetail trip={{ ...goa, isOwner: true, meMemberId: 'me' }} ops={ops} onChange={noop} onShare={noop} onInvite={noop} onClose={noop} onReopen={noop} onDelete={noop} />);
    expect(owner).not.toContain('sheet-locked');
    expect(owner).toContain('Close trip');
    expect(owner).toContain('Invite');
    expect(owner).toContain('not joined');                                          // Preetham hasn't opened the link yet
    const closedForFriend = render(<TripDetail trip={{ ...goa, status: 'closed' }} ops={ops} onChange={noop} onShare={noop} onClose={noop} onReopen={noop} onLogMine={noop} />);
    expect(closedForFriend).toContain('Add to my ledger');
    expect(closedForFriend).toContain('only its creator can reopen it');
    expect(closedForFriend).not.toContain('Reopen<');

    const { default: TripInviteModal } = await import('../features/trips/TripInviteModal');
    const invite = render(<TripInviteModal trip={{ ...goa, isOwner: true }} friends={[{ uid: 'uDi', name: 'Dinesh' }]} onLinkFriend={noop} onClose={noop} />);
    expect(invite).toContain('?trip=goaSharedTripId1234');
    expect(invite).toContain('Email');
    expect(invite).toContain('Dinesh');
    expect(invite).toContain('3 of 4 joined');
    const makeShared = render(<TripInviteModal trip={{ ...goa, shared: false }} onMakeShared={noop} onClose={noop} />);
    expect(makeShared).toContain('Which one is you?');
    const { default: JoinTripModal } = await import('../features/trips/JoinTripModal');
    expect(render(<JoinTripModal tripId="goaSharedTripId1234" me={{ uid: 'uPr', name: 'Preetham' }} onJoin={noop} onOpen={noop} onClose={noop} />)).toContain('Loading the trip');
    const { parseInvite } = await import('../features/trips/invite');
    expect(parseInvite('https://x.github.io/ExpenseTracker/?trip=goaSharedTripId1234')).toBe('goaSharedTripId1234');
    expect(parseInvite('hello')).toBe(null);
  });

  it('modals render for new and existing records', () => {
    expect(render(<EditTransactionModal txn={transactions[1]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Fuel');
    expect(render(<RecurringRuleModal rule={null} onSave={noop} onClose={noop} />)).toContain('New Recurring Entry');
    expect(render(<RecurringRuleModal rule={rules[0]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Edit Recurring');
    expect(render(<BudgetEditorModal budgets={settings.budgets} transactions={transactions} onSave={noop} onClose={noop} />)).toContain('Suggest from history');
    expect(render(<GoalModal goal={settings.goals[0]} onSave={noop} onDelete={noop} onClose={noop} />)).toContain('Edit goal');
  });
});

describe('auth screen', async () => {
  const { default: AuthScreen } = await import('../features/auth/AuthScreen');
  const props = { onSignIn: noop, onSignUp: noop, onGoogle: noop, onResetPassword: noop, setError: noop, loading: false };
  it('offers Google, email login, forgot password and account creation', () => {
    const html = render(<AuthScreen {...props} />);
    expect(html).toContain('Continue with Google');
    expect(html).toContain('Forgot password?');
    expect(html).toContain('Create account');
    expect(html).toContain('id="auth-email"');
  });
  it('shows an auth error', () => {
    expect(render(<AuthScreen {...props} error="Wrong email or password." />)).toContain('Wrong email or password.');
  });
});
