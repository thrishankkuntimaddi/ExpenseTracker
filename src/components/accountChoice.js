// ─── Account choice: shared by AccountPicker and the forms ────────
import { useState } from 'react';
import { Banknote, CreditCard, Landmark } from 'lucide-react';
import { useShell } from '../app/shellContext';
import { openAccounts, defaultAccountId, listAccounts } from '../utils/accounts';

const LAST_KEY = 'et_account_last';
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch { return {}; } };
/** Remember the account picked for a kind of entry ('expense', 'income', 'debt-in' …). */
export function rememberAccount(slot, id) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [slot]: id })); } catch { /* storage unavailable */ }
}

export const KIND_ICON = { bank: Landmark, cash: Banknote, card: CreditCard };

/** [account, setAccount]: starts on the one last used for `slot`, else the default. */
export function useAccountChoice(slot, initial = null) {
  const shell = useShell();
  const settings = shell?.settings;
  const [id, setId] = useState(() => {
    const open = openAccounts(settings);
    if (initial && listAccounts(settings).some((a) => a.id === initial)) return initial;
    const last = readLast()[slot];
    return open.some((a) => a.id === last) ? last : defaultAccountId(settings);
  });
  return [id, setId, settings];
}

