// ─── Heads-up (this month only) ──────────────────────────────────
// Where the month will land, categories running hot this week, and the
// subscriptions found in your entries. Quiet when there's nothing to say.
import { useMemo, useState } from 'react';
import { TrendingUp, Flame, Repeat, ChevronRight } from 'lucide-react';
import { monthForecast, unusualSpending, findSubscriptions } from '../../../utils/insights';
import { formatMoneyCompact } from '../../../utils/money';

import { t as tr } from '../../../i18n';
const rupees = (n) => formatMoneyCompact(n);

export default function HeadsUpCard({ transactions, income, recurringRules, rules, todayKey, budgetTotal }) {
  const [showSubs, setShowSubs] = useState(false);
  const f = useMemo(() => monthForecast({ transactions, income, recurringRules, todayKey }), [transactions, income, recurringRules, todayKey]);
  const hot = useMemo(() => unusualSpending(transactions, rules, todayKey).slice(0, 2), [transactions, rules, todayKey]);
  const subs = useMemo(() => findSubscriptions(transactions, rules, todayKey), [transactions, rules, todayKey]);
  const subTotal = subs.reduce((s, x) => s + x.monthly, 0);
  if (f.spent === 0 && !hot.length && !subs.length) return null;

  const over = budgetTotal > 0 && f.projected > budgetTotal;
  return (
    <section id="stats-heads-up" className="card stats-card" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <h2 className="section-label" style={{ margin: '0 0 6px' }}>{tr("Heads-up")}</h2>
      {f.spent > 0 && (
        <Row Icon={TrendingUp} tone={over || (f.vsLast ?? 0) > 10 ? 'expense' : 'accent'}
          title={<>{tr("This month will end near")} <strong>{rupees(f.projected)}</strong> {tr("spent")}</>}
          text={[
            f.vsLast != null && `${f.vsLast > 0 ? `${f.vsLast}% more` : f.vsLast < 0 ? `${-f.vsLast}% less` : 'about the same'} than last month`,
            budgetTotal > 0 && (over ? `${rupees(f.projected - budgetTotal)} over the budget` : `within the ${rupees(budgetTotal)} budget`),
            f.dueBills > 0 && `${rupees(f.dueBills)} of bills and regular payments still to come`,
          ].filter(Boolean).join(' · ')} />
      )}
      {hot.map((c) => (
        <Row key={c.key} Icon={Flame} tone="lent"
          title={<>{c.label}: <strong>{rupees(c.amount)}</strong> {tr("in the last 7 days")}</>}
          text={`${c.times >= 10 ? 'Far' : `${c.times.toFixed(1)}×`} more than your usual week (${rupees(c.usual)})`} />
      ))}
      {subs.length > 0 && (
        <>
          <button id="heads-up-subs" onClick={() => setShowSubs((v) => !v)} style={{ width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <Row Icon={Repeat} tone="savings"
              title={<>{subs.length} {tr("subscription")}{subs.length === 1 ? '' : 's'} · <strong>{rupees(subTotal)}</strong> {tr("a month")}</>}
              text={`${rupees(subTotal * 12)} a year`}
              after={<ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: showSubs ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />} />
          </button>
          {showSubs && (
            <div style={{ margin: '0 0 4px 38px' }}>
              {subs.map((s) => (
                <div key={s.name} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', color: 'var(--text-secondary)' }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{tr("last")} {new Date(`${s.last}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <strong style={{ color: 'var(--text)' }}>{rupees(s.monthly)}</strong>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tr("Anything paid once a month at the same price. Cancel what you don’t use.")}</div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Row({ Icon, tone, title, text, after }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: `var(--${tone}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} style={{ color: `var(--${tone})` }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.35 }}>{title}</div>
        {text && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{text}</div>}
      </div>
      {after}
    </div>
  );
}
