// Keeps user_activity/{uid} current: once when the app opens with your data,
// and when the number of entries grows. Failures are silent — this must never
// get in the way of using the app.
import { useEffect, useRef } from 'react';
import { recordOpen, recordEntry, lastEntryTime } from '../services/activity';

export function useActivity(user, transactions, income, loaded) {
  const count = transactions.length + income.length;
  const prev = useRef(null);
  useEffect(() => {
    if (!loaded || !user?.uid) return;
    if (prev.current == null) {
      prev.current = count;
      recordOpen(user, { entries: count, lastEntryAt: lastEntryTime([...transactions, ...income]) }).catch(() => {});
      return;
    }
    if (count > prev.current) recordEntry(user, count, lastEntryTime([...transactions, ...income])).catch(() => {});
    prev.current = count;
  }, [loaded, count]); // eslint-disable-line react-hooks/exhaustive-deps
}
