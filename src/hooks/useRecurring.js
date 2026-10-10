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

export function useRecurring({ uid, transactions, income, loaded, addTransaction, addIncome, reportError }) {
  const [rules, setRules] = useState([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const autoPostedRef = useRef(new Set());

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = subscribeToRecurring(uid, (r) => { setRules(r); setRulesLoaded(true); });
    return () => { unsub(); setRulesLoaded(false); };
  }, [uid]);

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

  const post = useCallback(async ({ rule, dateKey }) => {
    if (!uid) return false;
    const { entry, target } = entryFromRule(rule, dateKey);
    const ok = target === 'income' ? await addIncome(entry) : await addTransaction(entry);
    if (!ok) return false;
    const last = rule.lastHandledKey && rule.lastHandledKey > dateKey ? rule.lastHandledKey : dateKey;
    // The entry exists (idempotent id); if only the bookkeeping fails, surface it.
    background(patchRecurringRule(uid, rule.id, { lastHandledKey: last }), (err) => reportError?.('update the recurring rule', err));
    return true;
  }, [uid, addTransaction, addIncome, reportError]);

  const skip = useCallback(async ({ rule, dateKey }) => {
    if (!uid) return false;
    const last = rule.lastHandledKey && rule.lastHandledKey > dateKey ? rule.lastHandledKey : dateKey;
    background(patchRecurringRule(uid, rule.id, { lastHandledKey: last }), (err) => reportError?.('skip the recurring entry', err));
    return true;
  }, [uid, reportError]);

  const skipAllFor = useCallback(async (rule) => {
    if (!uid) return false;
    background(patchRecurringRule(uid, rule.id, { lastHandledKey: todayKey }), (err) => reportError?.('skip the recurring entries', err));
    return true;
  }, [uid, todayKey, reportError]);

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

  const saveRule = useCallback(async (rule) => {
    if (!uid) return false;
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
    background(upsertRecurringRule(uid, full), (err) => reportError?.('save the recurring rule', err));
    return true;
  }, [uid, reportError]);

  const removeRule = useCallback(async (id) => {
    if (!uid) return false;
    const prev = rules;
    setRules((p) => p.filter((r) => r.id !== id));
    background(deleteRecurringRule(uid, id), (err) => { reportError?.('delete the recurring rule', err); setRules(prev); });
    return true;
  }, [uid, rules, reportError]);

  const toggleActive = useCallback((rule) => saveRule({ ...rule, active: rule.active === false }), [saveRule]);

  const upcoming = useMemo(() => rules
    .filter((r) => r.active !== false)
    .map((r) => ({ rule: r, next: nextOccurrence(r, todayKey) }))
    .filter((x) => x.next)
    .sort((a, b) => (a.next < b.next ? -1 : 1)), [rules, todayKey]);

  return { rules, rulesLoaded, due, manualDue, upcoming, post, skip, skipAllFor, saveRule, removeRule, toggleActive };
}
