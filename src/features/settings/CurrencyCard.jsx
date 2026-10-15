// ─── Currency (Profile) ──────────────────────────────────────────
// The currency the app shows totals in. Changing it never rewrites history:
// every entry keeps the currency it was made in. Budgets and goal targets
// are plans, so they can be re-stated at today's rate in the same step.
import { useEffect, useMemo, useState } from 'react';
import { CardFrame } from './SettingsGroup';
import { Coins, RefreshCw } from 'lucide-react';
import CurrencySelect from '../../components/CurrencySelect';
import { CURRENCY_NAMES, currencyOf, formatMoney, entryCurrency } from '../../utils/money';
import { convertSettingsMoney } from '../../utils/fx';
import { latestRates, rateBetween, refreshLatest, useRatesVersion } from '../../services/rates';
import { formatDateShort } from '../../utils/dateHelpers';

export default function CurrencyCard({ settings, transactions = [], income = [], onPatchSettings, bare = false }) {
  useRatesVersion();
  const current = settings?.currency ?? 'INR';
  const [pending, setPending] = useState(null);          // a new currency waiting for confirmation
  const [convertPlans, setConvertPlans] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { refreshLatest(); }, []);

  // Currencies your entries actually use, besides the display one
  const used = useMemo(() => {
    const n = {};
    [...transactions, ...income].forEach((e) => { const c = currencyOf(e.orig ?? e); if (c !== current) n[c] = (n[c] ?? 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [transactions, income, current]);
  const hasPlans = !!(settings?.budgets?.total || Object.keys(settings?.budgets?.categories ?? {}).length || settings?.goals?.length);
  const latest = latestRates();

  function apply() {
    const rate = rateBetween(current, pending);
    onPatchSettings?.({ currency: pending, ...(convertPlans && hasPlans ? convertSettingsMoney(settings, rate) : {}) });
    entryCurrency.set(pending);
    setPending(null);
  }

  return (
    <CardFrame bare={bare} id="group-currency" title="Currency">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="settings-icon" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--income)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Coins size={16} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Show money in</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{CURRENCY_NAMES[current]} · all your devices</div>
          </div>
        </div>
        <CurrencySelect id="display-currency" value={pending ?? current} onChange={(c) => setPending(c === current ? null : c)} style={{ marginTop: 12 }} />

        {pending && (
          <div id="currency-confirm" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--surface2)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <div>Totals will show in <strong style={{ color: 'var(--text)' }}>{CURRENCY_NAMES[pending]}</strong>. Your entries keep their own currency — nothing you logged changes.</div>
            <div style={{ marginTop: 4 }}>Today: 1 {current} = {formatMoney(rateBetween(current, pending) ?? 0, pending)}</div>
            {hasPlans && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                <input id="currency-convert-plans" type="checkbox" checked={convertPlans} onChange={(e) => setConvertPlans(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
                <span>Also convert my budgets and goal targets at today’s rate</span>
              </label>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button id="currency-apply" onClick={apply} style={btn(true)}>Switch to {pending}</button>
              <button onClick={() => setPending(null)} style={btn(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>How amounts in other currencies count</strong><br />
          Spending, income and reports use the rate of the <em>day it happened</em> — $10 of fuel in March stays what it cost in March.
          Your <em>balance</em> is money you still hold, so it’s valued at <em>today’s</em> rate, per currency.
          Pick a currency for one entry with the sign next to the amount, or type it: “taxi 30 AED”.
        </div>

        {used.length > 0 && (
          <div id="currency-rates" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {used.slice(0, 6).map((c) => (
              <span key={c} style={{ padding: '4px 9px', borderRadius: 99, background: 'var(--surface2)', fontSize: 11, fontWeight: 650, color: 'var(--text-secondary)' }}>
                1 {c} = {formatMoney(rateBetween(c, current) ?? 0, current)}
              </span>
            ))}
            <button title="Refresh rates" disabled={busy} onClick={async () => { setBusy(true); await refreshLatest({ force: true }); setBusy(false); }}
              style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
              <RefreshCw size={12} style={busy ? { animation: 'spin 1s linear infinite' } : undefined} /> {latest.date ? formatDateShort(latest.date) : 'Refresh'}
            </button>
          </div>
        )}
    </CardFrame>
  );
}

const btn = (primary) => ({
  padding: '8px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer',
  background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--on-accent, #fff)' : 'var(--text-secondary)',
});
