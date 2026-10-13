// ─── Phone pages ─────────────────────────────────────────────────
// Names, icons and colours of the pages the bottom bar and Home tiles open.
import {
  Home, List, Wallet, BarChart2, ShoppingCart, PiggyBank, CalendarClock, Target, Plane, HandCoins, ArrowLeftRight,
} from 'lucide-react';

/* `tone` is a colour family from the theme (var(--<tone>), var(--<tone>-bg)) */
export const PAGE_META = {
  today:    { label: 'Home',     title: 'Home',             Icon: Home,          tone: 'accent',        description: 'This month at a glance' },
  history:  { label: 'History',  title: 'History',          Icon: List,          tone: 'lent',          description: 'Every transaction · search & filters' },
  bills:    { label: 'Bills',    title: 'Bills & payments', Icon: CalendarClock, tone: 'expense',       description: 'Rent, EMIs, SIPs, utilities' },
  stats:    { label: 'Stats',    title: 'Stats',            Icon: BarChart2,     tone: 'savings',       description: 'Calendar, categories, monthly report' },
  budget:   { label: 'Budget',   title: 'Budget',           Icon: Target,        tone: 'accent',        description: 'Limits and what’s safe to spend' },
  savings:  { label: 'Savings',  title: 'Savings & goals',  Icon: PiggyBank,     tone: 'savings',       description: 'SIPs, funds, deposits, goals' },
  income:   { label: 'Income',   title: 'Income',           Icon: Wallet,        tone: 'income',        description: 'Salary, family, everything that came in' },
  people:   { label: 'Debts',    title: 'Debts',            Icon: ArrowLeftRight, tone: 'lent',         description: 'Lent, borrowed, paid back' },
  trips:    { label: 'Trips',    title: 'Trips & splits',   Icon: Plane,         tone: 'repayment-rec', description: 'Shared spending, settled fairly' },
  external: { label: 'Billings', title: 'Billings',         Icon: HandCoins,     tone: 'external',      description: 'Money spent for others' },
};

/* Accent per page (bar highlight) */
export const PAGE_COLOR = {
  light: { today: '#4F46E5', history: '#D97706', bills: '#E11D48', stats: '#2563EB', budget: '#4F46E5', savings: '#2563EB', income: '#059669', people: '#C2410C', trips: '#0891B2', external: '#7C3AED', profile: '#6366F1' },
  dark:  { today: '#A5B4FC', history: '#FBBF24', bills: '#FB7185', stats: '#60A5FA', budget: '#A5B4FC', savings: '#60A5FA', income: '#34D399', people: '#FDBA74', trips: '#22D3EE', external: '#A78BFA', profile: '#A5B4FC' },
};

/* What the "+" sheet can add */
export const ADD_KINDS = [
  { key: 'expense', label: 'Expense', Icon: ShoppingCart, color: 'var(--expense)', bg: 'var(--expense-bg)' },
  { key: 'income',  label: 'Income',  Icon: Wallet,       color: 'var(--income)',  bg: 'var(--income-bg)' },
  { key: 'debt',    label: 'Debt',    Icon: ArrowLeftRight, color: 'var(--lent)',  bg: 'var(--lent-bg)' },
  { key: 'savings', label: 'Savings', Icon: PiggyBank,    color: 'var(--savings)', bg: 'var(--savings-bg)' },
];

/* Home → Explore: most-used first (pages already in the bar are left out) */
export const EXPLORE_ORDER = ['income', 'trips', 'external', 'bills', 'budget', 'people', 'savings', 'history', 'stats'];

/* Desktop / web sidebar */
export const DESKTOP_NAV = [
  { title: 'Overview', keys: ['today', 'history', 'stats'] },
  { title: 'Money',    keys: ['income', 'bills', 'budget', 'savings'] },
  { title: 'With others', keys: ['trips', 'external', 'people'] },
];
