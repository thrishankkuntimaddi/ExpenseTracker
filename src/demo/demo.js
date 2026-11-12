// ─── Demo: try the app without an account ────────────────────────
// Sample data lives in memory only (this tab); nothing is sent anywhere.
// The flag sits in sessionStorage, so a reload keeps the demo and closing
// the tab ends it.
import { toKey } from '../utils/recurring';

export const DEMO_UID = '__demo__';
const FLAG = 'et_demo';

export const demoOn = () => {
  try {
    // ?demo=1 (from the product page or an invite) starts it directly
    const url = new URL(window.location.href);
    if (url.searchParams.get('demo') === '1') {
      sessionStorage.setItem(FLAG, '1');
      url.searchParams.delete('demo');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
    return sessionStorage.getItem(FLAG) === '1';
  } catch { return false; }
};
export const startDemo = () => { try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ } window.location.reload(); };
export const endDemo = (thenSignUp = false) => {
  try { sessionStorage.removeItem(FLAG); if (thenSignUp) sessionStorage.setItem('et_after_demo', 'signup'); } catch { /* storage unavailable */ }
  window.location.reload();
};
export const afterDemo = () => { try { const v = sessionStorage.getItem('et_after_demo'); sessionStorage.removeItem('et_after_demo'); return v; } catch { return null; } };

export const DEMO_USER = {
  uid: DEMO_UID, isDemo: true, displayName: 'Guest', email: '', emailVerified: false,
  metadata: { creationTime: new Date().toUTCString() }, providerData: [],
};
export const isDemoUser = (u) => !!u?.isDemo;

/** Three months of believable entries ending today. */
export function demoSeed(now = new Date()) {
  const txns = [], income = [];
  let n = 0;
  const id = () => `demo${++n}`;
  const at = (monthsBack, day, h = 13) => {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, day, h);
    return d > now ? null : d;
  };
  const T = (mb, day, name, amount, extra = {}) => { const d = at(mb, day); if (d) txns.push({ id: id(), type: 'expense', name, amount, date: d.toISOString(), month: toKey(d).slice(0, 7), ...extra }); };
  for (let mb = 2; mb >= 0; mb--) {
    const s = at(mb, 1, 10);
    if (s) income.push({ id: id(), name: 'Salary', amount: 62000, date: s.toISOString(), month: toKey(s).slice(0, 7) });
    T(mb, 5, 'House rent', 15000); T(mb, 7, 'Bike loan EMI', 3800); T(mb, 3, 'Netflix', 199); T(mb, 9, 'Electricity bill', 1100 + mb * 140);
    T(mb, 2, 'Groceries', 2600); T(mb, 16, 'Groceries', 2100); T(mb, 6, 'Petrol', 1500); T(mb, 19, 'Petrol', 1400);
    T(mb, 4, 'Swiggy', 380); T(mb, 11, 'Zomato', 520); T(mb, 13, 'Chai & snacks', 60); T(mb, 14, 'Movie', 650);
    T(mb, 12, 'Uber', 240); T(mb, 21, 'Dinner out', 1400); T(mb, 24, 'Amazon', 1800 - mb * 300); T(mb, 8, 'Medicines', 450);
    const sip = at(mb, 2, 9);
    if (sip) txns.push({ id: id(), type: 'savings', name: 'Nifty index SIP', amount: 5000, savingsType: 'sip', platform: 'Groww', date: sip.toISOString(), month: toKey(sip).slice(0, 7) });
  }
  const lent = at(0, 3);
  if (lent) txns.push({ id: id(), type: 'person', direction: 'lent', name: 'Ravi', amount: 1200, date: lent.toISOString(), month: toKey(lent).slice(0, 7) });
  const goalStart = toKey(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const goalEnd = toKey(new Date(now.getFullYear() + 1, now.getMonth(), 1));
  const settings = {
    currency: 'INR',
    budgets: { total: 20000, categories: { food: 3000, shopping: 3000 } },
    goals: [{ id: 'g1', name: 'Goa trip', target: 40000, startDate: goalStart, deadline: goalEnd, monthly: 3500, linked: true, heldWith: 'Savings account' }],
    habits: { noSpendTarget: 8 },
  };
  const rules = [
    { id: 'r-rent', kind: 'expense', name: 'House rent', amount: 15000, category: 'rent', frequency: 'monthly', dayOfMonth: 5, startDate: goalStart, active: true, autoPost: false, lastHandledKey: toKey(now) },
    { id: 'r-emi', kind: 'expense', name: 'Bike loan EMI', amount: 3800, category: 'bills', frequency: 'monthly', dayOfMonth: 7, startDate: goalStart, active: true, autoPost: true, lastHandledKey: toKey(now) },
    { id: 'r-sip', kind: 'savings', name: 'Nifty index SIP', amount: 5000, savingsType: 'sip', frequency: 'monthly', dayOfMonth: 2, startDate: goalStart, active: true, autoPost: true, lastHandledKey: toKey(now) },
    { id: 'r-salary', kind: 'income', name: 'Salary', amount: 62000, frequency: 'monthly', dayOfMonth: 1, startDate: goalStart, active: true, autoPost: false, lastHandledKey: toKey(now) },
  ];
  return { transactions: txns, income, settings, rules };
}
