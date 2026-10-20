// ─── App tour & page guides ──────────────────────────────────────
// One small store: which tour is running and on which step. TourHost draws
// it; HelpButton ("?" in every page header) and Profile → Help start it.
//
// A step: { title, text, target?, page?, optional? }
//   target    CSS selectors, first match wins (phone and desktop name things
//             differently). No target, or none found: the card sits centred.
//   page      the page to open first (the full tour walks across the app)
//   optional  skip the step when its target isn't on this screen
//   text      a string, or ({ desktop }) => string
import { useSyncExternalStore } from 'react';

let state = null;            // { name, steps, i } | null
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export function startTour(name) {
  // A page guide opens its page first (so Profile → Help can start any of them)
  const steps = TOURS[name] ?? PAGE_GUIDES[name]?.().map((s) => ({ page: name, ...s }));
  if (!steps?.length) return;
  state = { name, steps, i: 0 };
  emit();
}
export function stepTour(delta) {
  if (!state) return;
  const i = state.i + delta;
  if (i < 0) return;
  if (i >= state.steps.length) { endTour(); return; }
  state = { ...state, i, dir: Math.sign(delta) };
  emit();
}
export function endTour() {
  if (state?.name === 'app') markTourSeen();
  state = null;
  emit();
}
export function useTour() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => null);
}

/* The full tour runs by itself once, for a brand-new account on this device */
const SEEN_KEY = 'et_tour_seen';
export function tourSeen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; } }
export function markTourSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable */ } }

export const hasGuide = (page) => !!PAGE_GUIDES[page];
export const GUIDE_PAGES = () => Object.keys(PAGE_GUIDES);

/* ── Shared targets ─────────────────────────────────────────────── */
const HEADER = ['.page-header', '.tab-header'];
const ADD = ['#tab-add', '#home-add-panel'];
const NAV = ['#phone-bar', '.desktop-sidebar'];
const PROFILE = ['#btn-open-profile', '#side-profile'];

/* ── The full tour ──────────────────────────────────────────────── */
const APP_TOUR = [
  { title: 'Welcome to Expense Tracker', text: 'Every rupee in one place — what you spend, what comes in, who owes whom. This tour takes a minute. You can leave any time and start it again from Profile → Help & tour.' },
  { page: 'today', target: ['#home-summary'], title: 'Your month at a glance', text: 'What you spent this month, and your balance. Tap the card for charts and the monthly report.' },
  { page: 'today', target: ADD, title: 'Add anything', text: ({ desktop }) => (desktop
    ? 'Expense, Income, Debt or Savings — pick one, type what it was for, then the amount, and press Enter.'
    : 'Tap + to add an Expense, Income, Debt or Savings. In that window, swipe left or right to switch between them.') },
  { page: 'today', target: ['#home-quick-entry'], optional: true, title: 'Quick entry', text: 'The fastest way: type “chai 20” and press Enter. Several at once works too — “coffee 250 water 50 tea 150” saves three expenses.' },
  { page: 'today', target: ['.month-switcher'], optional: true, title: 'One month for the whole app', text: 'Go back a month here and every page follows. “Now” brings you back to this month.' },
  { target: NAV, title: 'Your pages', text: ({ desktop }) => (desktop
    ? 'Every page is here. Bills, Budget, Savings, Debts and Trips each have their own guide — look for the ? at the top.'
    : 'Home, Bills, Stats and History sit in this bar; swipe sideways to move between them. Every other page is under Home → Explore.') },
  { page: 'history', target: ['#history-kinds', ...HEADER], title: 'History — every entry', text: 'Money in shows in green with +, money out in red with −. Tap a chip to see only Income, Expense, Borrowed, Lent…' },
  { page: 'history', target: ['.hist-row', '#history-list'], title: 'One row per entry', text: 'What it was for, its kind and category, and its status — a debt stays Open until it’s paid back. ✎ edits, 🗑 deletes (you can restore it from Recently Deleted).' },
  { page: 'income', target: HEADER, title: 'Money in', text: 'Everything that reached your account: what you earned, what you borrowed and what people paid back. Earned money is shown on its own, so you always know the difference.' },
  { page: 'people', target: HEADER, title: 'Debts', text: 'Lent, borrowed, got back, paid back — one line per person with what’s still open.' },
  { page: 'bills', target: HEADER, title: 'Bills', text: 'Rent, EMIs, SIPs, salary. The app asks “Have you paid rent?” on the day, or posts it for you.' },
  { page: 'today', target: PROFILE, title: 'Profile & settings', text: 'Theme, currency, app lock, reminders, Google Drive backup — and this tour, under Help & tour.' },
  { title: 'You’re set', text: 'Tap ? at the top of any page for a short guide to that page.' },
];

/* ── One guide per page (the "?" button) ────────────────────────── */
const PAGE_GUIDES = {
  today: () => [
    { target: ['#home-summary'], title: 'This month', text: 'Spent, today, safe to spend and balance. Tap it for Stats.' },
    { target: ['#home-quick-entry', ...ADD], title: 'Add', text: ({ desktop }) => (desktop
      ? 'Pick Expense, Income, Debt or Savings, type what it was for, then the amount. Enter saves.'
      : 'Type “chai 20” here, or several — “coffee 250 water 50”. The + below opens every kind of entry.') },
    { target: ['.home-bills'], optional: true, title: 'Due soon', text: 'Bills due this week, or late. Tap one to mark it paid.' },
    { target: ['#home-explore', '.home-explore'], optional: true, title: 'Explore', text: 'Every page that isn’t in your bar, with a live line about each.' },
  ],
  history: () => [
    { target: ['#month-label', ...HEADER], optional: true, title: 'Month and search', text: 'Pick the month, or search a name, note or amount. With a search on, “All months” looks everywhere.' },
    { target: ['#history-kinds'], title: 'In, out, and each kind', text: 'Green + is money that came in, red − is money that went out. Tap a chip — Income, Expense, Borrowed, Lent… — to see only that.' },
    { target: ['.hist-row'], optional: true, title: 'Each entry', text: 'What it was for and the amount; under it the kind, the category and the status. Debts stay Open until they’re paid back.' },
    { target: ['.hist-actions'], optional: true, title: 'Edit or delete', text: '✎ edits (also: tap the row). 🗑 deletes — it goes to Recently Deleted in Profile, where you can restore it.' },
  ],
  income: () => [
    { target: HEADER, title: 'Money in', text: 'Everything that reached your account — salary and other earnings, money you borrowed, and money people paid back to you.' },
    { target: ['.hero-income'], optional: true, title: 'Earned vs borrowed', text: 'The total, split into Earned, Borrowed and Paid back to you — so borrowed money is never mistaken for earnings.' },
    { target: ['#income-add'], optional: true, title: 'Add', text: 'Add earnings here. Borrowed money goes in through Debt, so it’s also tracked per person.' },
  ],
  people: () => [
    { target: HEADER, title: 'Debts', text: 'Everyone you lent money to or borrowed from, with what’s still open.' },
    { target: ['#debts-owe-you', '#debts-you-owe'], optional: true, title: 'Who owes whom', text: 'Owed to you, and what you owe. Tap a person for every entry with them.' },
    { target: ['#debts-add', '#debts-empty-add'], optional: true, title: 'Record a debt', text: 'Lent, borrowed, got back or paid back — the balance updates by itself.' },
  ],
  bills: () => [
    { target: HEADER, title: 'Bills & payments', text: 'Rent, EMIs, SIPs, subscriptions, salary — anything that repeats.' },
    { target: ['#bills-timeline'], optional: true, title: 'What’s coming', text: 'Due, late and paid, in date order. The app reminds you on the day.' },
    { target: ['#bills-add', '#bills-empty-add'], optional: true, title: 'Add a bill', text: 'Choose how often it repeats, and whether to post it for you or ask first.' },
  ],
  budget: () => [
    { target: HEADER, title: 'Budget', text: 'A monthly limit and, if you like, one per category.' },
    { target: ['#budget-liquid', '#budget-set'], optional: true, title: 'Safe to spend', text: 'How much is left, and how much you can spend today and stay on track.' },
    { target: ['#budget-categories'], optional: true, title: 'Categories', text: 'Limits per category. A category over its limit turns red.' },
  ],
  savings: () => [
    { target: HEADER, title: 'Savings & goals', text: 'SIPs, funds, deposits and cash you set aside.' },
    { target: ['#savings-goals'], optional: true, title: 'Goals', text: 'Save towards something, and note who holds the money — a bank, cash, a friend.' },
    { target: ['#savings-add', '#savings-empty-add'], optional: true, title: 'Add savings', text: 'Record money saved, optionally for a goal.' },
  ],
  stats: () => [
    { target: HEADER, title: 'Stats', text: 'Where the month’s money went, and how it compares.' },
    { target: ['#stats-calendar'], optional: true, title: 'Calendar', text: 'Spending day by day. Tap a day to see it.' },
    { target: ['#report-banner'], optional: true, title: 'Monthly report', text: 'On the day you choose, salary to salary: what went up, what went down.' },
  ],
  trips: () => [
    { target: HEADER, title: 'Trips & splits', text: 'Shared costs with friends: who paid what, and the fewest payments to settle up.' },
    { target: ['#trip-join'], optional: true, title: 'Join a friend’s trip', text: 'Paste an invite link to join a trip someone else opened.' },
    { title: 'Invite', text: 'Open a trip and invite people by QR code, link or email — everyone adds what they paid on their own phone.' },
  ],
  external: () => [
    { target: HEADER, title: 'Billings', text: 'Money you spent for other people, and what they paid you back.' },
    { title: 'Settle up', text: 'When everyone has paid, close the billing — any profit goes to Money in.' },
  ],
};

const TOURS = { app: APP_TOUR };
