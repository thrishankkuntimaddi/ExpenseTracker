// ─── Shared Type Configuration ────────────────────────────────────────────────
// Single source of truth for transaction types.
// Imported by TodayTab, HistoryTab, DesktopDashboard — never defined locally.

import { ShoppingCart, Users, PiggyBank, TrendingDown, TrendingUp, Coins, LineChart, Banknote } from 'lucide-react';

/**
 * TYPE_META  — display metadata for rendering badges, colours, etc.
 * Keyed by transaction `type` string so lookups are O(1).
 */
export const TYPE_META = {
  expense:  { label: 'Expense',    color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)' },
  person:   { label: 'Person',     color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)'  },
  savings:  { label: 'Savings',    color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)' },
  income:   { label: 'Income',     color: 'var(--income)',  bg: 'var(--income-bg)',  border: 'var(--income-border)'  },
  external: { label: 'External',   color: '#7C3AED',        bg: '#F5F3FF',           border: '#DDD6FE'               },
};

/**
 * TRANSACTION_TYPES  — ordered list used by type-picker buttons and the
 * today's entries list icon rendering.  Includes Icon component reference.
 */
export const TRANSACTION_TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: 'var(--person)',  bg: 'var(--person-bg)',  border: 'var(--person-border)',  Icon: Users        },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank    },
];

/**
 * PERSON_DIRECTIONS — 4-way person transaction directions
 */
export const PERSON_DIRECTIONS = [
  { key: 'lent',      label: 'Lent',         color: '#D97706', Icon: TrendingDown, description: 'I gave money (they owe me)' },
  { key: 'repayment', label: 'Repayment Rec.', color: '#16A34A', Icon: TrendingUp,   description: 'They returned money to me' },
  { key: 'borrowed',  label: 'Borrowed',     color: '#2563EB', Icon: TrendingUp,   description: 'I received money (I owe them)' },
  { key: 'repaid',    label: 'Repaid Them',  color: '#DC2626', Icon: TrendingDown, description: 'I returned money I owed' },
];

/**
 * SAVINGS_TYPES — savings/investment sub-categories
 */
export const SAVINGS_TYPES = [
  { key: 'cash',        label: 'Cash Savings', color: '#2563EB', Icon: Coins,      hasPlatform: false },
  { key: 'sip',         label: 'SIP',          color: '#7C3AED', Icon: TrendingUp, hasPlatform: true  },
  { key: 'mutual_fund', label: 'Mutual Fund',  color: '#0891B2', Icon: LineChart,  hasPlatform: true  },
  { key: 'trading',     label: 'Trading',      color: '#059669', Icon: Banknote,   hasPlatform: true  },
  { key: 'other',       label: 'Other',        color: '#475569', Icon: PiggyBank,  hasPlatform: false },
];

/** Get a savings type config by key, defaulting to 'cash' */
export function getSavingsType(key) {
  return SAVINGS_TYPES.find(t => t.key === key) ?? SAVINGS_TYPES[0];
}

/** Get a person direction config by key, defaulting to 'lent' */
export function getPersonDirection(key) {
  return PERSON_DIRECTIONS.find(d => d.key === key) ?? PERSON_DIRECTIONS[0];
}
