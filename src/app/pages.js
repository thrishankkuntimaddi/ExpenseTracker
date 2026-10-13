// ─── Phone pages ─────────────────────────────────────────────────
// Names, icons and colours of the pages the bottom bar / More sheet can show.
import { Home, List, Wallet, BarChart2, Target, ReceiptText } from 'lucide-react';

export const PAGE_META = {
  today:    { label: 'Home',     Icon: Home,        description: 'Add entries · this month at a glance' },
  history:  { label: 'History',  Icon: List,        description: 'Every transaction · search & filters' },
  income:   { label: 'Income',   Icon: Wallet,      description: 'Salary, borrowed money, repayments' },
  stats:    { label: 'Stats',    Icon: BarChart2,   description: 'Insights, categories & spending calendar' },
  plan:     { label: 'Plan',     Icon: Target,      description: 'Budget · recurring entries · savings goals' },
  external: { label: 'Billings', Icon: ReceiptText, description: 'Money spent on behalf of others, settled later' },
};

/* Accent per page (bar highlight, More sheet icon tiles) */
export const PAGE_COLOR = {
  light: { today: '#E11D48', history: '#D97706', income: '#059669', external: '#4F46E5', plan: '#0891B2', stats: '#2563EB', profile: '#6366F1' },
  dark:  { today: '#FB7185', history: '#FBBF24', income: '#34D399', external: '#A78BFA', plan: '#22D3EE', stats: '#60A5FA', profile: '#A5B4FC' },
};
