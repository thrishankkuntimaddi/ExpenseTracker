// ─── Phone pages ─────────────────────────────────────────────────
// Names, icons and colours of the pages the bottom bar and Home tiles open.
import { Home, List, Wallet, BarChart2, Target, ReceiptText, Users, ShoppingCart, PiggyBank } from 'lucide-react';

export const PAGE_META = {
  today:    { label: 'Home',     Icon: Home,        description: 'This month at a glance · shortcuts' },
  history:  { label: 'History',  Icon: List,        description: 'Every transaction · search & filters' },
  income:   { label: 'Income',   Icon: Wallet,      description: 'Salary, borrowed money, repayments' },
  stats:    { label: 'Stats',    Icon: BarChart2,   description: 'Insights, categories & spending calendar' },
  plan:     { label: 'Plan',     Icon: Target,      description: 'Budget · recurring entries · savings goals' },
  people:   { label: 'People',   Icon: Users,       description: 'Who owes you, whom you owe' },
  external: { label: 'Billings', Icon: ReceiptText, description: 'Money spent for others · trip splits' },
};

/* Accent per page (bar highlight) */
export const PAGE_COLOR = {
  light: { today: '#E11D48', history: '#D97706', income: '#059669', external: '#4F46E5', plan: '#0891B2', stats: '#2563EB', people: '#C2410C', profile: '#6366F1' },
  dark:  { today: '#FB7185', history: '#FBBF24', income: '#34D399', external: '#A78BFA', plan: '#22D3EE', stats: '#60A5FA', people: '#FDBA74', profile: '#A5B4FC' },
};

/* What the "+" sheet can add */
export const ADD_KINDS = [
  { key: 'expense', label: 'Expense', Icon: ShoppingCart, color: 'var(--expense)', bg: 'var(--expense-bg)' },
  { key: 'income',  label: 'Income',  Icon: Wallet,       color: 'var(--income)',  bg: 'var(--income-bg)' },
  { key: 'person',  label: 'People',  Icon: Users,        color: 'var(--lent)',    bg: 'var(--lent-bg)' },
  { key: 'savings', label: 'Savings', Icon: PiggyBank,    color: 'var(--savings)', bg: 'var(--savings-bg)' },
];
