// ─── Wrapped: share your month or year as a picture ──────────────
import { useCallback, useMemo, useState } from 'react';
import ShareSummaryModal from '../../../components/ShareSummaryModal';
import { wrappedStats, wrappedCard, wrappedText, yearWindow } from '../../../utils/wrapped';
import { renderShareCard } from '../../../utils/shareCard';
import { formatMoneyCompact } from '../../../utils/money';
import { APP_URL } from '../../../config/sites';

export default function WrappedModal({ transactions, income, rules, monthWin, todayKey, onClose, initial = 'month' }) {
  const [period, setPeriod] = useState(initial);
  const [showAmounts, setShowAmounts] = useState(false);
  const { start: ms, last: ml, label: mlabel } = monthWin;
  const win = useMemo(() => (period === 'year' ? yearWindow(todayKey) : { start: ms, last: ml, label: mlabel }), [period, todayKey, ms, ml, mlabel]);
  const w = useMemo(() => wrappedStats({ transactions, income, rules, win }), [transactions, income, rules, win]);
  const opts = { money: formatMoneyCompact, showAmounts, appUrl: APP_URL };
  const makeImage = useCallback(() => renderShareCard(wrappedCard(w, { money: formatMoneyCompact, showAmounts, appUrl: APP_URL })), [w, showAmounts]);
  const chip = (on) => ({ flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' });

  const extra = (
    <div id="wrapped-options" style={{ display: 'grid', gap: 8 }}>
      <div role="radiogroup" aria-label="Period" style={{ display: 'flex', gap: 6 }}>
        <button id="wrapped-month" role="radio" aria-checked={period === 'month'} onClick={() => setPeriod('month')} style={chip(period === 'month')}>{monthWin.label}</button>
        <button id="wrapped-year" role="radio" aria-checked={period === 'year'} onClick={() => setPeriod('year')} style={chip(period === 'year')}>{yearWindow(todayKey).label}</button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input id="wrapped-amounts" type="checkbox" checked={showAmounts} onChange={(e) => setShowAmounts(e.target.checked)} />
        Show amounts (off: only shares and habits — safe to post anywhere)
      </label>
    </div>
  );

  return (
    <ShareSummaryModal title="Your money, wrapped" subtitle="A picture to share — your habits, not your bank balance."
      text={wrappedText(w, opts)} makeImage={makeImage} filename={`wrapped_${win.label}`} onClose={onClose} extra={extra} />
  );
}
