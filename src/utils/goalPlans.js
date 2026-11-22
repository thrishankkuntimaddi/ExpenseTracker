// ─── Plans to buy (Goals) ────────────────────────────────────────
// A goal with items is a plan: goal.items = [{ id, name, est, actual, done, txnId }].
// est — what you think it costs; actual — what it really cost once bought
// (empty: the estimate); txnId — the expense it was logged as. Pure.

const n = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const r2 = (v) => Math.round(v * 100) / 100;

/** A goal that is a list of things to buy. */
export const isPlan = (g) => Array.isArray(g?.items);

/** What it costs, what's bought, what's left. */
export function planTotals(plan) {
  const items = (plan?.items ?? []).filter((it) => (it.name ?? '').trim() || n(it.est) || n(it.actual));
  const bought = items.filter((it) => it.done);
  const cost = (it) => (it.actual == null || it.actual === '' ? n(it.est) : n(it.actual));
  const unlogged = bought.filter((it) => !it.txnId && cost(it) > 0);
  return {
    count: items.length,
    bought: bought.length,
    est: r2(items.reduce((s, it) => s + n(it.est), 0)),
    boughtEst: r2(bought.reduce((s, it) => s + n(it.est), 0)),
    spent: r2(bought.reduce((s, it) => s + cost(it), 0)),
    left: r2(items.filter((it) => !it.done).reduce((s, it) => s + n(it.est), 0)),
    unlogged,
    unloggedSum: r2(unlogged.reduce((s, it) => s + cost(it), 0)),
  };
}
