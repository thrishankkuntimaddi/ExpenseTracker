// ─── useRecurring ────────────────────────────────────────────────
// Live recurring rules + the occurrences that are due. Posting creates a
// normal transaction / income entry through the same optimistic add helpers
// everything else uses, then advances the rule's lastHandledKey.
//
// Auto-post rules are posted silently once the ledger has loaded; because
// occurrence ids are deterministic this is safe to run on every device.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  subscribeToRecurring, upsertRecurringRule, patchRecurringRule, deleteRecurringRule,
} from '../services/firestore';
import { dueOccurrences, entryFromRule, nextOccurrence, toKey } from '../utils/recurring';
import { generateId } from '../utils/storage';
import { background } from '../services/sync';
import { getDisplayCurrency } from '../utils/money';
import { viewEntry, rawOf, unviewEntry } from '../utils/fx';
import { rateBetween, useRatesVersion } from '../services/rates';

/* Rules are plans, so a rule in another currency is shown at today's rate
   (views, as in utils/fx.js); posting and saving always use the stored rule. */
const viewRule = (r, display) => viewEntry({ ...r, fxLive: true }, display, rateBetween);
const storedRule = (r, display) => { const { fxLive: _l, ...rest } = unviewEntry(r, display) ?? r; return rest; };

export function useRecurring({ uid, transactions, income, loaded, addTransaction, addIncome, reportError, demoRules = null }) {
  // Demo: rules live in memory and every write below stays local
  const demo = Array.isArray(demoRules);
  const live = !!uid && !demo;
  const [rawRules, setRules] = useState(() => (demo ? demoRules : []));
  const display = getDisplayCurrency();
  const ratesVersion = useRatesVersion();
  const rules = useMemo(() => rawRules.map((r) => { const v = viewRule(r, display); return v.orig ? v : r; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ratesVersion: re-value at new rates
    [rawRules, display, ratesVersion]);
  const [rulesLoaded, setRulesLoaded] = useState(demo);
  const can = live || demo;
  const patchLocal = (id, patch) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const persist = (write, onErr) => { if (live) background(write(), onErr); };
  const autoPostedRef = useRef(new Set());

  useEffect(() => {
    if (!live) return undefined;
    const unsub = subscribeToRecurring(uid, (r) => { setRules(r); setRulesLoaded(true); });
    return () => { unsub(); setRulesLoaded(false); };
  }, [uid, live]);

  const todayKey = toKey(new Date());

  const existingIds = useMemo(() => {
    const s = new Set();
    transactions.forEach((t) => s.add(t.id));
    income.forEach((i) => s.add(i.id));
    return s;
  }, [transactions, income]);

  /* Every pending occurrence across all rules, oldest first */
  const due = useMemo(() => {
    const list = [];
    rules.forEach((rule) => {
      dueOccurrences(rule, todayKey, existingIds).forEach((dateKey) => list.push({ rule, dateKey }));
    });
    list.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
    return list;
  }, [rules, todayKey, existingIds]);

  const manualDue = useMemo(() => due.filter((d) => !d.rule.autoPost), [due]);

  const post = useCallback(async ({ rule, dateKey, paidOn = null }) => {
    if (!can) return false;
    const { entry, target } = entryFromRule(rawOf(rule), dateKey, paidOn);
    const ok = target === 'income' ? await addIncome(entry) : await addTransaction(entry);
    if (!ok) return false;
    const last = rule.lastHandledKey && rule.lastHandledKey > dateKey ? rule.lastHandledKey : dateKey;
    // The entry exists (idempotent id); if only the bookkeeping fails, surface it.
    if (demo) patchLocal(rule.id, { lastHandledKey: last });
    persist(() => patchRecurringRule(uid, rule.id, { lastHandledKey: last }), (err) => reportError?.('update the recurring rule', err));
    return true;
  }, [uid, can, demo, live, addTransaction, addIncome, reportError]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = useCallback(async ({ rule, dateKey }) => {
    if (!can) return false;
    const last = rule.lastHandledKey && rule.lastHandledKey > dateKey ? rule.lastHandledKey : dateKey;
    if (demo) patchLocal(rule.id, { lastHandledKey: last });
    persist(() => patchRecurringRule(uid, rule.id, { lastHandledKey: last }), (err) => reportError?.('skip the recurring entry', err));
    return true;
  }, [uid, can, demo, live, reportError]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipAllFor = useCallback(async (rule) => {
    if (!can) return false;
    if (demo) patchLocal(rule.id, { lastHandledKey: todayKey });
    persist(() => patchRecurringRule(uid, rule.id, { lastHandledKey: todayKey }), (err) => reportError?.('skip the recurring entries', err));
    return true;
  }, [uid, can, demo, live, todayKey, reportError]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-post: once per (rule, date) per session, only after both the ledger
     and the rules have loaded so we never act on a partial snapshot. */
  useEffect(() => {
    if (!loaded || !rulesLoaded) return;
    due.filter((d) => d.rule.autoPost).forEach((d) => {
      const k = `${d.rule.id}|${d.dateKey}`;
      if (autoPostedRef.current.has(k)) return;
      autoPostedRef.current.add(k);
      post(d);
    });
  }, [due, loaded, rulesLoaded, post]);

  const saveRule = useCallback(async (given) => {
    if (!can) return false;
    const rule = storedRule(given, display);
    const full = {
      active: true, autoPost: false, createdAt: new Date().toISOString(),
      ...rule,
      id: rule.id || generateId(),
      amount: Number(rule.amount),
    };
    // A brand-new rule starts from today: past occurrences are not back-filled
    if (!rule.id && !full.lastHandledKey) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      full.lastHandledKey = full.startDate > toKey(yesterday) ? undefined : toKey(yesterday);
    }
    setRules((prev) => {
      const i = prev.findIndex((r) => r.id === full.id);
      return i === -1 ? [...prev, full] : prev.map((r) => (r.id === full.id ? { ...r, ...full } : r));
    });
    persist(() => upsertRecurringRule(uid, full), (err) => reportError?.('save the recurring rule', err));
    return true;
  }, [uid, can, live, reportError, display]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeRule = useCallback(async (id) => {
    if (!can) return false;
    const prev = rawRules;
    setRules((p) => p.filter((r) => r.id !== id));
    persist(() => deleteRecurringRule(uid, id), (err) => { reportError?.('delete the recurring rule', err); setRules(prev); });
    return true;
  }, [uid, can, live, rawRules, reportError]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = useCallback((rule) => saveRule({ ...rule, active: rule.active === false }), [saveRule]);

  const upcoming = useMemo(() => rules
    .filter((r) => r.active !== false)
    .map((r) => ({ rule: r, next: nextOccurrence(r, todayKey) }))
    .filter((x) => x.next)
    .sort((a, b) => (a.next < b.next ? -1 : 1)), [rules, todayKey]);

  return { rules, rulesLoaded, due, manualDue, upcoming, post, skip, skipAllFor, saveRule, removeRule, toggleActive };
}
