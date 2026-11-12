// ─── Ask: questions about your money, answered on this device ────
import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import ModalShell from '../../../components/ModalShell';
import { answer, ASK_EXAMPLES } from '../../../utils/ask';
import { formatMoneyCompact } from '../../../utils/money';
import { fieldStyle } from '../../../components/formTokens';

const money = (n) => formatMoneyCompact(n);

export default function AskModal({ transactions, income, rules, todayKey, onClose, initial = '' }) {
  const [q, setQ] = useState(initial);
  const [asked, setAsked] = useState(initial);
  const a = useMemo(() => (asked.trim() ? answer(asked, { transactions, income, rules, todayKey }) : null), [asked, transactions, income, rules, todayKey]);
  const ask = (text) => { setQ(text); setAsked(text); };

  return (
    <ModalShell title="Ask" subtitle="About your money — answered on this device, nothing is sent anywhere" onClose={onClose} maxWidth={560}>
      <form onSubmit={(e) => { e.preventDefault(); setAsked(q); }} style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input id="ask-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" autoComplete="off"
          placeholder="How much on Swiggy this month?" aria-label="Your question"
          style={{ ...fieldStyle, padding: '12px 12px 12px 34px', fontSize: 15 }} />
      </form>

      {!a && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Try</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ASK_EXAMPLES.map((ex, i) => (
              <button key={ex} id={`ask-example-${i}`} onClick={() => ask(ex)} style={{ padding: '7px 11px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>{ex}</button>
            ))}
          </div>
        </div>
      )}

      {a && (
        <div id="ask-answer" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)' }}>
            <Sparkles size={13} style={{ color: 'var(--accent)' }} /> {a.title}
          </div>
          {a.value != null && (
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: a.signed ? (a.value > 0 ? 'var(--expense)' : 'var(--income)') : 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {a.unit === 'count' ? a.value : `${a.signed ? (a.value > 0 ? '+' : a.value < 0 ? '−' : '') : ''}${money(a.signed ? Math.abs(a.value) : a.value)}`}
            </div>
          )}
          {a.sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.sub}</div>}

          {a.rows?.length > 0 && (
            <div style={{ marginTop: 12, border: '1px solid var(--border)' }}>
              {a.rows.map((r, i) => (
                <div key={r.label} style={{ display: 'flex', gap: 8, padding: '9px 12px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}>{r.label}</span>
                  <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{money(r.value)}</strong>
                </div>
              ))}
            </div>
          )}

          {a.entries?.length > 0 && (
            <div style={{ marginTop: 12, border: '1px solid var(--border)', maxHeight: 280, overflow: 'auto' }}>
              {a.entries.map((t, i) => (
                <div key={t.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{money(t.amount)}</strong>
                </div>
              ))}
            </div>
          )}
          {a.value === 0 && !a.entries?.length && !a.rows?.length && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Nothing matched. Try a shop or category name, or a month — “petrol in October”.</div>
          )}
          <button onClick={() => { setQ(''); setAsked(''); }} style={{ marginTop: 12, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Ask something else</button>
        </div>
      )}
    </ModalShell>
  );
}
