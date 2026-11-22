// ─── Settings → Money: where entries go, what a tap does ──────────
// settings.defaultAccount — the account new entries start on (the forms then
// remember the last one per kind). settings.historyTap — 'waste' (default:
// tap an expense = all of it wasted, double-tap = how much) or 'edit' (tap
// opens it, as before 4.6.0). Plus: show the notes and tips you dismissed.
import { Landmark, ChevronRight, RotateCcw } from 'lucide-react';
import AccountPicker from '../../components/AccountPicker';
import { useShell } from '../../app/shellContext';
import { defaultAccountId, openAccounts, accountsSetUp, materialise } from '../../utils/accounts';
import { t as tr } from '../../i18n';

const row = { padding: '12px 16px', borderTop: '1px solid var(--border)' };
const label = { fontSize: 13, fontWeight: 700, color: 'var(--text)' };
const hint = { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 };
const chip = (on) => ({ padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 99, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'var(--surface2)', color: on ? 'var(--accent)' : 'var(--text-secondary)' });

const TIP_KEYS = ['et_hist_tip', 'et_live_dismissed', 'et_acct_gap_hidden'];

export default function MoneyPrefsCard({ settings, onPatchSettings, transactions = [], income = [] }) {
  const shell = useShell();
  const def = defaultAccountId(settings);
  const tap = settings?.historyTap === 'edit' ? 'edit' : 'waste';
  // Before accounts are set up, choosing a default writes the starter accounts for real (as Accounts does)
  const setDefault = (id) => onPatchSettings?.((cur) => ({
    ...(accountsSetUp(cur) ? {} : { accounts: materialise(transactions, income, cur) }),
    defaultAccount: id,
  }));
  return (
    <div id="money-prefs">
      <div style={{ padding: '12px 16px' }}>
        <div style={label}>{tr('New entries go to')}</div>
        <div style={hint}>{tr('Every form starts here — then remembers the account you last used for that kind of entry.')}</div>
        <div style={{ marginTop: 8 }}>
          <AccountPicker id="pref-default-acct" label="Default" value={def} onChange={setDefault} settings={settings} />
        </div>
        <button type="button" id="pref-open-accounts" onClick={() => shell?.goTo?.('accounts')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, padding: 0, border: 'none', background: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <Landmark size={13} /> {tr('Accounts')} · {openAccounts(settings).length} <ChevronRight size={13} />
        </button>
      </div>

      <div style={row}>
        <div style={label}>{tr('Tapping an expense in History')}</div>
        <div style={hint}>{tap === 'waste' ? tr('One tap: all of it wasted (tap again to undo). Two taps: say how much. Swipe right to edit, left to delete.') : tr('A tap opens it to edit. Swipe right to edit, left to delete.')}</div>
        <div role="radiogroup" aria-label={tr('Tapping an expense')} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" id="pref-tap-waste" role="radio" aria-checked={tap === 'waste'} onClick={() => onPatchSettings?.({ historyTap: 'waste' })} style={chip(tap === 'waste')}>{tr('Mark wasted')}</button>
          <button type="button" id="pref-tap-edit" role="radio" aria-checked={tap === 'edit'} onClick={() => onPatchSettings?.({ historyTap: 'edit' })} style={chip(tap === 'edit')}>{tr('Open to edit')}</button>
        </div>
      </div>

      <div style={row}>
        <div style={label}>{tr('Notes you dismissed')}</div>
        <div style={hint}>{tr('Show the History tip, the owner’s notes and the Accounts check again on this device.')}</div>
        <button type="button" id="pref-reset-tips" onClick={() => { TIP_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } }); shell?.toast?.({ text: tr('They’ll show again'), sign: 'check' }); }}
          style={{ ...chip(false), display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}><RotateCcw size={12} /> {tr('Show them again')}</button>
      </div>
    </div>
  );
}
