// ─── Profile → Bank accounts (Account Aggregator) ────────────────
// Shown only when the build turns bank linking on (BANK_LINK). Link with
// your mobile number → approve in the AA app → transactions arrive in an
// inbox → review them like an imported statement (what you already have is
// unticked). Nothing reaches your entries until you tap Add.
import { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { linkBank, refreshBank, loadBankLinks, loadBankInbox, clearBankInbox } from '../../services/bankLink';
import StatementImport from '../import/StatementImport';
import { t as tr } from '../../i18n';

const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 'none', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const STATUS = { ACTIVE: 'Linked', PENDING: 'Waiting for your approval', REJECTED: 'Declined', REVOKED: 'Removed', PAUSED: 'Paused', EXPIRED: 'Expired' };

export default function BankLinkCard({ uid, transactions, income, settings, onAddTransaction, onAddIncome }) {
  const [links, setLinks] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    const [l, i] = await Promise.all([loadBankLinks(uid), loadBankInbox(uid)]);
    setLinks(l); setInbox(i);
  }, [uid]);
  useEffect(() => { if (uid) Promise.resolve().then(load).catch(() => {}); }, [uid, load]);

  async function link() {
    setBusy('link'); setError('');
    try {
      const { url } = await linkBank(mobile);
      window.open(url, '_blank');
      await load();
    } catch { setError(tr('Couldn’t start linking — try again in a bit.')); } finally { setBusy(''); }
  }
  async function refresh(id) {
    setBusy(id); setError('');
    try { await refreshBank(id); await load(); } catch { setError(tr('Couldn’t ask the bank right now — try again in a bit.')); } finally { setBusy(''); }
  }

  return (
    <div id="bank-link" style={{ padding: '14px 16px 16px', display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {tr('Link your bank through an RBI-licensed Account Aggregator. You approve which accounts, for how long, and can stop it any time in the AA app. The app only reads transactions — it can never move money.')}
      </div>

      {links.map((l) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' }}>
          <Landmark size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tr(STATUS[l.status] ?? 'Waiting for your approval')}{l.mobileEnd ? ` · ••${l.mobileEnd}` : ''}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.fetching ? tr('Asking the bank…') : l.lastCount != null ? `${l.lastCount} ${tr('transactions last time')}` : ''}</div>
          </div>
          {l.status === 'ACTIVE' && (
            <button onClick={() => refresh(l.id)} disabled={!!busy} aria-label={tr('Fetch new transactions')} style={{ ...btn, padding: '7px 10px', background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              {busy === l.id ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
            </button>
          )}
        </div>
      ))}

      {inbox.length > 0 && (
        <button id="bank-review" onClick={() => setReviewing(true)} style={{ ...btn, justifySelf: 'start' }}>
          {tr('Review')} {inbox.length} {tr('bank transactions')}
        </button>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input id="bank-mobile" inputMode="numeric" placeholder={tr('Mobile number linked to your bank')} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ''))}
          style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        <button onClick={link} disabled={busy === 'link' || mobile.replace(/\D/g, '').length < 10} style={btn}>
          {busy === 'link' ? <Loader2 size={14} className="spin" /> : <ExternalLink size={14} />} {links.length ? tr('Link another') : tr('Link bank')}
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--expense)', fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{tr('Nothing is added to your entries until you review it. Entries you already have — typed, captured or imported — are left out, so nothing is counted twice.')}</span>
      </div>

      {reviewing && (
        <StatementImport
          transactions={transactions} income={income} settings={settings}
          onAddTransaction={onAddTransaction} onAddIncome={onAddIncome}
          onClose={() => { setReviewing(false); load().catch(() => {}); }}
          preset={{
            lines: inbox,
            title: tr('Review bank transactions'),
            subtitle: tr('From your linked bank — tick what to add'),
            onSaved: () => clearBankInbox(uid, inbox.map((i) => i.id)),
          }}
        />
      )}
    </div>
  );
}
