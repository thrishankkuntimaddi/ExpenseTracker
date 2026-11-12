// Keeps user_activity/{uid} current: once when the app opens with your data,
// and when the number of entries grows. Failures are silent — this must never
// get in the way of using the app.
import { useEffect, useRef } from 'react';
import { recordOpen, recordEntry, lastEntryTime } from '../services/activity';
import { claimReferral, markReferralActive } from '../services/referrals';

export function useActivity(user, transactions, income, loaded) {
  const count = transactions.length + income.length;
  const prev = useRef(null);
  useEffect(() => {
    if (!loaded || !user?.uid) return;
    if (prev.current == null) {
      prev.current = count;
      recordOpen(user, { entries: count, lastEntryAt: lastEntryTime([...transactions, ...income]) }).catch(() => {});
      // Invited? Credit the friend who sent the link (once), and count it from the first entry
      claimReferral(user).catch(() => false).then(() => { if (count > 0) markReferralActive(user.uid).catch(() => {}); });
      return;
    }
    if (count > 0 && prev.current === 0) markReferralActive(user.uid).catch(() => {});
    if (count > prev.current) recordEntry(user, count, lastEntryTime([...transactions, ...income])).catch(() => {});
    prev.current = count;
  }, [loaded, count]); // eslint-disable-line react-hooks/exhaustive-deps
}
