// ─── Net worth ───────────────────────────────────────────────────
// Everything you own minus everything you owe — from your entries, plus
// anything you add by hand (settings.netWorth.items).
import { useMemo, useState } from 'react';
import { Plus, X, ChevronRight, Scale } from 'lucide-react';
import { netWorth } from '../../utils/netWorth';
import { formatBig, formatMoneyCompact, currencySymbol } from '../../utils/money';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';
import { fieldStyle } from '../../components/formTokens';

const IDEAS = { asset: ['House / flat', 'Gold at home', 'PF balance', 'Car', 'Land'], liability: ['Home loan', 'Car loan', 'Education loan', 'Credit card'] };

export default function NetWorthCard({ transactions, income, settings, onPatchSettings }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(null);   // 'asset' | 'liability' | null
  const n = useMemo(() => netWorth({ transactions, income, settings, todayKey: toKey(new Date()) }), [transactions, income, settings]);
  const items = settings?.netWorth?.items ?? [];
  const saveItems = (next) => onPatchSettings?.({ netWorth: { ...(settings?.netWorth ?? {}), items: next } });
  const remove = (id) => saveItems(items.filter((i) => i.id !== id));


  return (
    <div className="card" id="net-worth" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <button id="net-worth-toggle" onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Scale size={18} style={{ color: 'var(--accent)' }} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Net worth</span>
          <span style={{ display: 'block', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: n.netWorth < 0 ? 'var(--expense)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatBig(n.netWorth)}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{formatBig(n.totalAssets)} you own − {formatBig(n.totalLiabilities)} you owe</span>
        </span>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="section-label" style={{ margin: '0 0 2px' }}>You own</div>
          <Rows list={n.assets} tone="income" onRemove={remove} />
          <div className="section-label" style={{ margin: '10px 0 2px' }}>You owe</div>
          {n.liabilities.length ? <Rows list={n.liabilities} tone="expense" onRemove={remove} /> : <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Nothing — well done.</div>}
          {adding ? <AddItem kind={adding} onAdd={(it) => { saveItems([...items, it]); setAdding(null); }} onCancel={() => setAdding(null)} /> : (
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <button id="nw-add-asset" onClick={() => setAdding('asset')} style={linkBtn}><Plus size={13} /> Something you own</button>
              <button id="nw-add-liability" onClick={() => setAdding('liability')} style={linkBtn}><Plus size={13} /> A loan</button>
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '10px 0 0' }}>Savings are what you put in, not today’s market value — add a hand-entered item for that if you like.</p>
        </div>
      )}
    </div>
  );
}

function Rows({ list, tone, onRemove }) {
  return list.map((r) => (
    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}{r.auto ? '' : <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>added</span>}</span>
      <strong style={{ color: r.value < 0 ? 'var(--expense)' : `var(--${tone})`, fontVariantNumeric: 'tabular-nums' }}>{formatMoneyCompact(r.value)}</strong>
      {r.id && <button aria-label={`Remove ${r.label}`} onClick={() => onRemove(r.id)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>}
    </div>
  ));
}

const linkBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };

function AddItem({ kind, onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const ok = name.trim() && Number(value) > 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {IDEAS[kind].map((i) => <button key={i} onClick={() => setName(i)} style={{ padding: '4px 9px', fontSize: 11.5, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: name === i ? 'var(--accent-bg)' : 'transparent', color: name === i ? 'var(--accent)' : 'var(--text-secondary)' }}>{i}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input id="nw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'asset' ? 'What you own' : 'What you owe'} style={{ ...fieldStyle, flex: 1 }} />
        <input id="nw-value" value={value} inputMode="decimal" onChange={(e) => { const t = e.target.value; if (t === '' || /^\d*\.?\d*$/.test(t)) setValue(t); }} placeholder={`${currencySymbol()} value`} style={{ ...fieldStyle, width: 120 }}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok) onAdd({ id: generateId(), name: name.trim(), value: Number(value), kind }); }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        <button id="nw-save" disabled={!ok} onClick={() => onAdd({ id: generateId(), name: name.trim(), value: Number(value), kind })} style={{ ...linkBtn, opacity: ok ? 1 : 0.5 }}>Add</button>
        <button onClick={onCancel} style={{ ...linkBtn, color: 'var(--text-muted)' }}>Cancel</button>
      </div>
    </div>
  );
}
