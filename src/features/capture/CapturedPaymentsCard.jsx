// ─── Detected payments (Android) ──────────────────────────────────
// UPI and bank notifications read on this phone, waiting for one tap.
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, X, ScanLine } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';
import { categoryMeta, inferCategory } from '../../utils/categories';
import { useShell } from '../../app/shellContext';
import { captureUsable } from '../../native/paymentCapture';
import { t as tr } from '../../i18n';

const time = (ms) => {
  const d = new Date(ms), today = new Date();
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? t : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${t}`;
};

export default function CapturedPaymentsCard({ capture, rules }) {
  const shell = useShell();
  const [busy, setBusy] = useState(false);
  const list = capture.detections;
  if (!capture.supported || !captureUsable(capture.status) || !capture.status.enabled || !list.length) return null;

  async function addOne(d) {
    const e = await capture.add(d);
    shell?.toast?.(`${tr('Added')} ${e.name} · ${formatAmount(e.amount)}`);
  }
  async function addAll() {
    setBusy(true);
    try { for (const d of list) await capture.add(d); shell?.toast?.(`${tr('Added')} ${list.length} ${tr('payments')}`); } finally { setBusy(false); }
  }

  return (
    <div id="captured-payments" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 4px 8px' }}>
        <p className="section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><ScanLine size={12} /> {tr('Detected payments')} · {list.length}</p>
        {list.length > 1 && <button onClick={addAll} disabled={busy} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('Add all')}</button>}
      </div>
      <div className="card">
        {list.slice(0, 6).map((d, i) => {
          const debit = d.direction === 'debit';
          const name = d.payee || tr(debit ? 'UPI payment' : 'Money received');
          return (
            <div key={d.ids.join('|')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: debit ? 'var(--expense-bg)' : 'var(--income-bg)', color: debit ? 'var(--expense)' : 'var(--income)' }}>
                {debit ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {debit ? categoryMeta(inferCategory(name, rules)).label : tr('Income')} · {d.source}{d.account ? ` ${d.account}` : ''} · {time(d.time)}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: debit ? 'var(--expense)' : 'var(--income)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{debit ? '' : '+'}{formatAmount(d.amount)}</span>
              <button onClick={() => addOne(d)} aria-label={`${tr('Add')} ${name}`} style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><Check size={13} /> {tr('Add')}</button>
              <button onClick={() => capture.dismiss(d)} aria-label={`${tr('Ignore')} ${name}`} style={{ width: 30, height: 30, border: 'none', borderRadius: 9, background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={14} /></button>
            </div>
          );
        })}
        {list.length > 6 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>+{list.length - 6} {tr('more — add these first')}</div>}
      </div>
    </div>
  );
}
