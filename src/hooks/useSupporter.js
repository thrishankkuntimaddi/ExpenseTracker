// Your supporter status: friends who joined with your link (+ paid support).
import { useEffect, useState } from 'react';
import { loadSupporter } from '../services/referrals';
import { supporterStatus } from '../utils/supporter';
import { t as tr } from '../i18n';

const NONE = supporterStatus();

export function useSupporter(uid) {
  const [state, setState] = useState({ uid: null, status: NONE });
  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    loadSupporter(uid).then((d) => { if (live) setState({ uid, status: supporterStatus(d) }); }).catch(() => {});
    return () => { live = false; };
  }, [uid]);
  return state.uid === uid ? state.status : NONE;
}

/** One line for the Profile row. */
export const supporterSummary = (s) => (s.active
  ? `${tr('Supporter')} · ${s.daysLeft} ${tr('days left')}`
  : tr('Free forever · invite friends for extras'));
