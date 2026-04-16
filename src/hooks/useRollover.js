// ─── useRollover hook ─────────────────────────────────────────────
// Runs the month-to-month carry-forward rollover engine on app load.
// Guarantees: atomic, idempotent, sequential (handles skipped months).
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getPendingRolloverMonths,
  runCarryForwardTransaction,
  upsertMonthlySummary,
  subscribeToMonthlySummaries,
} from '../services/firestore';
import { getCurrentMonthValue } from '../utils/periodHelpers';

/**
 * Returns the YYYY-MM that comes after the given YYYY-MM.
 * E.g. "2025-02" → "2025-03", "2024-12" → "2025-01"
 */
function nextMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const d = new Date(y, m, 1); // month is 0-indexed in Date; m (1-indexed) + 1 step = next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * useRollover(uid, income, transactions)
 *
 * Responsibilities:
 *  1. On mount (once uid + data are available), seed the current month's
 *     summary so it's always up-to-date.
 *  2. Query for pending (unclosed, unprocessed) past months.
 *  3. Process each one sequentially, oldest → newest, via atomic Firestore
 *     transactions.
 *  4. Re-seed the current month summary after all rollovers complete.
 *
 * Returns:
 *  { isRolling, rolloverStatus, monthlySummaries }
 */
export function useRollover(uid, income, transactions) {
  const [isRolling,        setIsRolling]        = useState(false);
  const [rolloverStatus,   setRolloverStatus]   = useState('idle'); // idle | running | done | error
  const [monthlySummaries, setMonthlySummaries] = useState({});

  // Prevent concurrent rollover runs (e.g. StrictMode double-invoke)
  const runningRef   = useRef(false);
  // Track whether we've already seeded+rolled for this uid session
  const doneRef      = useRef(false);
  // Latest income + transactions available to summary calculations
  const incomeRef    = useRef(income);
  const txnsRef      = useRef(transactions);

  incomeRef.current  = income;
  txnsRef.current    = transactions;

  /* ── Real-time listener for monthlySummaries (for UI locked-month badges) ── */
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMonthlySummaries(uid, setMonthlySummaries);
    return unsub;
  }, [uid]);

  /* ── Main rollover engine ── */
  const runRollover = useCallback(async () => {
    if (!uid || runningRef.current || doneRef.current) return;

    runningRef.current = true;
    setIsRolling(true);
    setRolloverStatus('running');

    const currentMonth  = getCurrentMonthValue();
    const allIncome     = incomeRef.current;
    const allTxns       = txnsRef.current;

    try {
      // ── Step 1: Seed the current month summary ──
      await upsertMonthlySummary(uid, currentMonth, allIncome, allTxns);

      // ── Step 2: Bootstrap summary docs for ALL unique past months ──
      // This is critical for existing users whose monthly_summaries collection
      // is empty. We collect every YYYY-MM present in the data, filter to past
      // months only, and upsertMonthlySummary for each one (which creates the
      // doc with is_closed:false / rollover_processed:false if it doesn't exist).
      const pastMonths = new Set();
      [...allIncome, ...allTxns].forEach(item => {
        const m = item.date?.slice(0, 7);
        if (m && m < currentMonth) pastMonths.add(m);
      });

      if (pastMonths.size > 0) {
        const sortedPastMonths = Array.from(pastMonths).sort(); // oldest first
        console.info('[useRollover] Bootstrapping summaries for past months:', sortedPastMonths);
        for (const m of sortedPastMonths) {
          await upsertMonthlySummary(uid, m, allIncome, allTxns);
        }
      }

      // ── Step 3: Query for pending (unclosed, unprocessed) past months ──
      const pending = await getPendingRolloverMonths(uid, currentMonth);

      if (pending.length > 0) {
        console.info(`[useRollover] Processing ${pending.length} pending month(s):`, pending.map(p => p.id));

        // ── Step 4: Process sequentially, oldest → newest ──
        for (const summary of pending) {
          const fromMonth = summary.id;
          const toMonth   = nextMonth(fromMonth);

          console.info(`[useRollover] Rolling over ${fromMonth} → ${toMonth}`);

          // Re-sync the fromMonth summary with live data before closing it
          await upsertMonthlySummary(uid, fromMonth, allIncome, allTxns);
          await runCarryForwardTransaction(uid, fromMonth, toMonth);

          console.info(`[useRollover] ✓ ${fromMonth} closed`);
        }

        // ── Step 5: Re-seed current month to include any new carry-forwards ──
        await upsertMonthlySummary(uid, currentMonth, incomeRef.current, txnsRef.current);
      } else {
        console.info('[useRollover] No pending rollovers — all months up to date.');
      }

      doneRef.current = true;
      setRolloverStatus('done');
    } catch (err) {
      console.error('[useRollover] Rollover failed:', err);
      setRolloverStatus('error');
    } finally {
      runningRef.current = false;
      setIsRolling(false);
    }
  }, [uid]);

  /* ── Trigger rollover once: fires when data has arrived from Firestore ──
     We watch income + transactions so that we run immediately once the
     first real snapshot arrives, rather than guessing a fixed delay.
     doneRef prevents re-running on subsequent data changes. */
  useEffect(() => {
    if (!uid) { doneRef.current = false; return; }
    // Already ran for this session
    if (doneRef.current) return;
    // Wait until at least some data has arrived (income or transactions)
    if (income.length === 0 && transactions.length === 0) return;

    runRollover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, income.length, transactions.length]);

  /* ── Safety-net timer: if Firestore has data but above effect never fired
     (e.g. user genuinely has zero historical data), run rollover after 4s
     to at least seed the current month summary. */
  useEffect(() => {
    if (!uid) return;
    const timer = setTimeout(() => {
      if (!doneRef.current && !runningRef.current) {
        console.info('[useRollover] Safety-net timer fired — running rollover.');
        runRollover();
      }
    }, 4000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return { isRolling, rolloverStatus, monthlySummaries };
}
