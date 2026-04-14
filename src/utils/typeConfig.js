// ─── Shared Type Configuration ────────────────────────────────────────────────
// Single source of truth for transaction types.
// Imported by TodayTab, HistoryTab, DesktopDashboard — never defined locally.

import { ShoppingCart, Users, PiggyBank, ArrowLeftRight } from 'lucide-react';

/**
 * TYPE_META  — display metadata for rendering badges, colours, etc.
 * Keyed by transaction `type` string so lookups are O(1).
 */
export const TYPE_META = {
  expense:  { label: 'Expense',  color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)' },
  person:   { label: 'Person',   color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)'  },
  savings:  { label: 'Savings',  color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)' },
  income:   { label: 'Income',   color: 'var(--income)',  bg: 'var(--income-bg)',  border: 'var(--income-border)'  },
  external: { label: 'External', color: '#7C3AED',        bg: '#F5F3FF',           border: '#DDD6FE'               },
};

/**
 * TRANSACTION_TYPES  — ordered list used by type-picker buttons and the
 * today's entries list icon rendering.  Includes Icon component reference.
 */
export const TRANSACTION_TYPES = [
  { key: 'expense',  label: 'Expense',  color: 'var(--expense)', bg: 'var(--expense-bg)',  border: 'var(--expense-border)',  Icon: ShoppingCart   },
  { key: 'person',   label: 'Person',   color: 'var(--person)',  bg: 'var(--person-bg)',   border: 'var(--person-border)',   Icon: Users          },
  { key: 'savings',  label: 'Savings',  color: 'var(--savings)', bg: 'var(--savings-bg)',  border: 'var(--savings-border)',  Icon: PiggyBank      },
  { key: 'external', label: 'External', color: '#7C3AED',        bg: '#F5F3FF',            border: '#DDD6FE',                Icon: ArrowLeftRight },
];
