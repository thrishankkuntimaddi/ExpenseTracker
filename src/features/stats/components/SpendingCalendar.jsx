// ─── SpendingCalendar ─────────────────────────────────────────────
// A month heat-map: each day shaded by how much was spent. Tap a day to
// see its entries. Months with no data can still be browsed.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { formatAmount, localDateKey, localMonthKey } from '../../../utils/dateHelpers';
import { sumAmounts } from '../../../utils/finance';
import { categoryOf, categoryColor } from '../../../utils/categories';
import { CategoryIcon } from '../../../components/CategoryPicker';

const pad2 = (n) => String(n).padStart(2, '0');
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function SpendingCalendar({ transactions = [], initialMonth, rules = {}, theme }) {
  const nowKey = localMonthKey(new Date().toISOString());
  const [monthKey, setMonthKey] = useState(initialMonth ?? nowKey);
  const [selected, setSelected] = useState(null);

  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const todayKey = localDateKey(new Date().toISOString());

  const byDay = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      if (localMonthKey(t.date) !== monthKey) return;
      const k = localDateKey(t.date);
      (map[k] ||= []).push(t);
    });
    return map;
  }, [transactions, monthKey]);

  const totals = useMemo(() => Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, sumAmounts(v)])), [byDay]);
  const values = Object.values(totals);
  const max = values.length ? Math.max(...values) : 0;
  const monthTotal = sumAmounts(values.map((v) => ({ amount: v })));
  const spentDays = values.filter((v) => v > 0).length;
  const elapsed = monthKey === nowKey ? new Date().getDate() : monthKey < nowKey ? daysInMonth : 0;

  function shift(n) {
    const d = new Date(y, m - 1 + n, 1);
    setMonthKey(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    setSelected(null);
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthKey}-${pad2(d)}`);

  const selEntries = selected ? (byDay[selected] ?? []).slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)) : [];

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Spending Calendar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NavBtn onClick={() => shift(-1)} aria="Previous month"><ChevronLeft size={13} /></NavBtn>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 90, textAlign: 'center' }}>
            {new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </span>
          <NavBtn onClick={() => shift(1)} disabled={monthKey >= nowKey} aria="Next month"><ChevronRight size={13} /></NavBtn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DOW.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((k, i) => {
          if (!k) return <div key={`e${i}`} />;
          const v = totals[k] ?? 0;
          const intensity = max > 0 ? v / max : 0;
          const isFuture = k > todayKey;
          const isSel = selected === k;
          const isToday = k === todayKey;
          const alpha = v > 0 ? 0.18 + intensity * 0.72 : 0;
          return (
            <button key={k} type="button" onClick={() => setSelected(isSel ? null : k)} disabled={isFuture}
              title={v > 0 ? `${formatAmount(v)} · ${byDay[k].length} entr${byDay[k].length === 1 ? 'y' : 'ies'}` : isFuture ? '' : 'No spend'}
              style={{
                aspectRatio: '1', borderRadius: 8, position: 'relative', fontFamily: 'inherit', cursor: isFuture ? 'default' : 'pointer',
                border: `1.5px solid ${isSel ? 'var(--accent)' : isToday ? 'var(--text-muted)' : 'transparent'}`,
                background: v > 0 ? `rgba(225, 29, 72, ${alpha})` : isFuture ? 'transparent' : 'var(--surface2)',
                color: intensity > 0.55 ? '#fff' : isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: isFuture ? 0.4 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: 0,
              }}>
              <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, lineHeight: 1 }}>{Number(k.slice(-2))}</span>
              {v > 0 && <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, opacity: 0.9 }}>{v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : Math.round(v)}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--text-secondary)' }}>{formatAmount(monthTotal)}</strong> spent</span>
        {elapsed > 0 && <span><strong style={{ color: 'var(--income)' }}>{Math.max(0, elapsed - spentDays)}</strong> no-spend day{elapsed - spentDays === 1 ? '' : 's'} · {spentDays} spend day{spentDays === 1 ? '' : 's'}</span>}
        {max > 0 && <span>peak <strong style={{ color: 'var(--expense)' }}>{formatAmount(max)}</strong></span>}
      </div>

      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--expense)' }}>{formatAmount(totals[selected] ?? 0)}</span>
          </div>
          {selEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No expenses logged — a no-spend day.</div>
          ) : selEntries.map((t) => {
            const c = categoryOf(t, rules);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                <CategoryIcon category={c} size={12} style={{ color: categoryColor(c, theme), flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{t.name}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatAmount(t.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavBtn({ children, onClick, disabled, aria }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={aria} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}
