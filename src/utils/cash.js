// ─── Cash in hand ────────────────────────────────────────────────
// Taking cash out of the bank isn't spending and isn't saving: the money
// just moves from your account to your wallet (a transaction of type 'cash',
// left out of every total and of the balance). Spending it is an ordinary
// expense marked paidWith: 'cash'. What's left in your wallet is
//   cash withdrawn − cash spent.
import { sumAmounts } from './finance';
import { localMonthKey } from './dateHelpers';

export const isWithdrawal = (t) => t?.type === 'cash';
/** Spending paid in cash: expenses, and money given to someone */
export const isCashSpend = (t) => t?.paidWith === 'cash'
  && (t.type === 'expense' || (t.type === 'person' && t.direction === 'given_gift'));

/**
 * @returns {{ used: boolean, withdrawn: number, spent: number, inHand: number, monthSpent: number }}
 *   used — has this account ever recorded cash (otherwise nothing is shown)
 */
export function cashSummary(transactions = [], monthKey = null) {
  const withdrawals = transactions.filter(isWithdrawal);
  const spends = transactions.filter(isCashSpend);
  const withdrawn = sumAmounts(withdrawals);
  const spent = sumAmounts(spends);
  return {
    used: withdrawals.length + spends.length > 0,
    withdrawn,
    spent,
    inHand: Math.round((withdrawn - spent) * 100) / 100,
    monthSpent: monthKey ? sumAmounts(spends.filter((t) => localMonthKey(t.date) === monthKey)) : 0,
  };
}
