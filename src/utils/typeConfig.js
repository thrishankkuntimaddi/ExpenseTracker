// ─── Shared Type Configuration ────────────────────────────────────────────────
// Single source of truth for transaction types + colors.
// All colors reference CSS variables defined in index.css — so both light and
// dark (monoflow) themes automatically get the right shade.

import {
  ShoppingCart, Users, PiggyBank,
  TrendingDown, TrendingUp,
  Coins, LineChart, Banknote, Gift,
} from 'lucide-react';

/* ── Per-type meta (expense / savings / income / external) ── */
export const TYPE_META = {
  expense:  { label: 'Expense',  color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)' },
  person:   { label: 'Person',   color: 'var(--lent)',    bg: 'var(--lent-bg)',    border: 'var(--lent-border)'    },
  savings:  { label: 'Savings',  color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)' },
  income:   { label: 'Income',   color: 'var(--income)',  bg: 'var(--income-bg)',  border: 'var(--income-border)'  },
  external: { label: 'External', color: 'var(--external)',bg: 'var(--external-bg)',border: 'var(--external-border)'},
};

/* ── Per-direction meta (person sub-types) ── */
export const DIRECTION_META = {
  lent:       { label: 'Lent',           color: 'var(--lent)',          bg: 'var(--lent-bg)',          border: 'var(--lent-border)'          },
  repaid:     { label: 'Debt Repayment', color: 'var(--borrowed)',      bg: 'var(--borrowed-bg)',      border: 'var(--borrowed-border)'      },
  repayment:  { label: 'Repayment Rec.', color: 'var(--repayment-rec)', bg: 'var(--repayment-rec-bg)', border: 'var(--repayment-rec-border)' },
  given_gift: { label: 'Given (Gift)',   color: 'var(--given)',         bg: 'var(--given-bg)',         border: 'var(--given-border)'         },
  borrowed:   { label: 'Borrowed',       color: 'var(--borrowed)',      bg: 'var(--borrowed-bg)',      border: 'var(--borrowed-border)'      },
};

/** Returns direction meta, defaulting to lent */
export function getDirectionMeta(direction) {
  return DIRECTION_META[direction] ?? DIRECTION_META.lent;
}

/* ── Transaction type buttons (TodayTab type selector) ── */
export const TRANSACTION_TYPES = [
  { key: 'expense', label: 'Expense', color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: ShoppingCart },
  { key: 'person',  label: 'Person',  color: 'var(--lent)',    bg: 'var(--lent-bg)',    border: 'var(--lent-border)',    Icon: Users        },
  { key: 'savings', label: 'Savings', color: 'var(--savings)', bg: 'var(--savings-bg)', border: 'var(--savings-border)', Icon: PiggyBank    },
];

/* ── Person direction buttons ── */
export const PERSON_DIRECTIONS = [
  { key: 'repaid',     label: 'Debt Repayment',      color: 'var(--borrowed)',      bg: 'var(--borrowed-bg)',      Icon: TrendingDown, description: 'Pay back debt you borrowed'     },
  { key: 'lent',       label: 'Lent (Debt Expected)', color: 'var(--lent)',          bg: 'var(--lent-bg)',          Icon: TrendingDown, description: 'Give money, expect it back'     },
  { key: 'given_gift', label: 'Given (No Debt)',      color: 'var(--given)',         bg: 'var(--given-bg)',         Icon: Gift,         description: 'Gave money, no debt expected'  },
];

/* ── Savings sub-categories ── */
export const SAVINGS_TYPES = [
  { key: 'cash',        label: 'Cash Savings', color: 'var(--savings)', Icon: Coins,      hasPlatform: false },
  { key: 'sip',         label: 'SIP',          color: '#7C3AED',        Icon: TrendingUp, hasPlatform: true  },
  { key: 'mutual_fund', label: 'Mutual Fund',  color: '#0891B2',        Icon: LineChart,  hasPlatform: true  },
  { key: 'trading',     label: 'Trading',      color: '#059669',        Icon: Banknote,   hasPlatform: true  },
  { key: 'other',       label: 'Other',        color: '#475569',        Icon: PiggyBank,  hasPlatform: false },
];

export function getSavingsType(key) {
  return SAVINGS_TYPES.find(t => t.key === key) ?? SAVINGS_TYPES[0];
}

export function getPersonDirection(key) {
  return PERSON_DIRECTIONS.find(d => d.key === key) ?? PERSON_DIRECTIONS[0];
}
