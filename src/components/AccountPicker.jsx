// ─── Which account? ──────────────────────────────────────────────
// A row of chips on every form — SBI · HDFC · Cash · Card — with your
// default (or the one you last used for this kind of entry) picked. It uses
// the same chips "Paid with: UPI / card · Cash" used, so every look styles it.
// See utils/accounts.js for what the choice does to balances.
import { Landmark } from 'lucide-react';
import { KIND_ICON } from './accountChoice';
import { useShell } from '../app/shellContext';
import { openAccounts, accountLabel, colorOf, listAccounts } from '../utils/accounts';
import { t as tr } from '../i18n';

/**
 * label: "Paid from" / "Received in". `kinds`: limit to some kinds.
 * `extra`: shown at the end of the row (cash left in hand …).
 */
export default function AccountPicker({ id = 'acct', label, value, onChange, kinds, exclude, settings: given, extra, dark }) {
  const shell = useShell();
  const settings = given ?? shell?.settings;
  const isDark = dark ?? (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'monoflow');
  const list = openAccounts(settings).filter((a) => (!kinds || kinds.includes(a.kind)) && a.id !== exclude);
  // The current one may be closed (editing an old entry): still show it
  const current = listAccounts(settings).find((a) => a.id === value);
  const all = current && !list.some((a) => a.id === value) ? [...list, current] : list;
  return (
    <div role="radiogroup" aria-label={tr(label)} className="add-paid acct-picker" data-no-swipe-kind id={id}>
      <span className="add-paid-label">{tr(label)}</span>
      <div className="acct-chips">
        {all.map((a) => {
          const on = a.id === value;
          const Icon = KIND_ICON[a.kind] ?? Landmark;
          return (
            <button key={a.id} type="button" role="radio" aria-checked={on} id={`${id}-${a.id}`} onClick={() => onChange(a.id)}
              className={`add-paid-opt${on ? ' on' : ''}`} title={[accountLabel(a), a.tag].filter(Boolean).join(' · ')}>
              <span aria-hidden className="acct-dot" style={{ background: colorOf(a, isDark) }} />
              {a.kind !== 'bank' && <Icon size={12} />}
              {accountLabel(a)}
              {a.tag && <span className="acct-chip-tag">{tr(a.tag)}</span>}
            </button>
          );
        })}
      </div>
      {extra}
    </div>
  );
}
