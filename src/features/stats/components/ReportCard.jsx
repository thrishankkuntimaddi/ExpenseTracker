// ─── Monthly report ──────────────────────────────────────────────
// One report a month, on the day you pick, covering salary to salary (see
// utils/report.js): totals, what went up / down / stayed steady, bills you
// missed, categories over budget. Browse earlier reports with ‹ ›.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, AlertCircle, Target, FileText } from 'lucide-react';
import { buildReport, latestReportDay, shiftReportDay, windowLabel, getReportSettings, ordinal } from '../../../utils/report';
import { toKey, fromKey } from '../../../utils/recurring';
import { EMPTY_RULES } from '../../../utils/categories';
import { motionOn, useMotion } from '../../../motion/motion';
import { formatMoneyCompact, currencySymbol } from '../../../utils/money';
import { SMALL_SPEND } from '../../../utils/report';

/* ── F · Report unveil: each report arrives sealed, once per device ── */
const OPENED_KEY = 'et_reports_opened';
const openedReports = () => { try { return JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]'); } catch { return []; } };
const markOpened = (key) => { try { localStorage.setItem(OPENED_KEY, JSON.stringify([...openedReports().filter((k) => k !== key), key].slice(-24))); } catch { /* storage unavailable */ } };

const rupees = (n) => formatMoneyCompact(n);

export default function ReportCard({ transactions = [], income = [], settings, recurringRules = [], onPatchSettings }) {
  const { day } = getReportSettings(settings);
  const todayKey = toKey(new Date());
  const latest = latestReportDay(day, todayKey);
  const [back, setBack] = useState(0);   // how many reports before the latest
  const reportKey = shiftReportDay(latest, day, -back);
  const r = buildReport({
    transactions, income, rules: settings?.categoryRules ?? EMPTY_RULES, recurring: recurringRules,
    budgets: settings?.budgets, reportKey, day, todayKey,
  });
  const nextOn = fromKey(shiftReportDay(latest, day, 1)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

  // Sealed until opened (the latest report only, the first time on this device)
  const [sealed, setSealed] = useState(() => back === 0 && !r.empty && motionOn() && !openedReports().includes(reportKey));
  const [typed, setTyped] = useState(null);     // the headline, while it types itself
  const [grow, setGrow] = useState(0);          // bump to re-grow the week bars (after opening)
  const moving = useMotion();
  const cover = useRef(null), card = useRef(null);
  function unseal() {
    if (!cover.current) return;
    markOpened(reportKey);
    const c = cover.current;
    const ease = 'cubic-bezier(.2,.9,.25,1)';
    c.querySelector('.env-seal')?.animate([{ transform: 'scale(1) rotate(0)', opacity: 1 }, { transform: 'scale(1.3) rotate(-14deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(.2) rotate(40deg)', opacity: 0 }], { duration: 480, easing: ease, fill: 'forwards' });
    c.querySelector('.env-flap')?.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)', opacity: 0.6 }], { duration: 600, delay: 320, easing: ease, fill: 'forwards' });
    c.querySelector('.env-paper')?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-46px)' }], { duration: 600, delay: 700, easing: ease, fill: 'forwards' });
    const out = c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 420, delay: 1250, easing: ease, fill: 'forwards' });
    out.finished.then(() => { setSealed(false); setTyped(''); setGrow((g) => g + 1); }, () => setSealed(false));
  }
  // Open by itself when it scrolls into view (or on tap)
  useEffect(() => {
    if (!sealed || !card.current) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.intersectionRatio > 0.6) { io.disconnect(); setTimeout(unseal, 350); } }, { threshold: [0.6] });
    io.observe(card.current);
    return () => io.disconnect();
  }, [sealed]); // eslint-disable-line react-hooks/exhaustive-deps
  // The headline types itself after opening
  useEffect(() => {
    if (typed == null) return undefined;
    if (typed.length >= r.headline.length) { const t = setTimeout(() => setTyped(null), 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setTyped(r.headline.slice(0, typed.length + 2)), 18);
    return () => clearTimeout(t);
  }, [typed, r.headline]);

  const nav = { width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

  return (
    <div ref={card} className={`card report-card${moving ? ' report-grow' : ''}`} key={`${reportKey}-${grow}`} id="stats-report" style={{ padding: 0, overflow: 'hidden', scrollMarginTop: 12, position: 'relative' }}>
      {sealed && (
        <button ref={cover} type="button" className="report-seal-cover" id="report-unseal" onClick={unseal} aria-label="Open your new report">
          <span className="env">
            <span className="env-back" /><span className="env-paper"><i style={{ top: 12, width: '60%' }} /><i style={{ top: 26, width: '78%' }} /><i style={{ top: 40, width: '48%' }} /></span>
            <span className="env-front" /><span className="env-flap" /><span className="env-seal">{currencySymbol()}</span>
          </span>
          <span className="cover-title">Your new report is here</span>
          <span className="cover-hint">{windowLabel(r.start, r.last)} · tap to open</span>
        </button>
      )}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={16} style={{ color: 'var(--accent)' }} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>{back === 0 ? 'Latest report' : 'Earlier report'}</div>
          <div id="report-window" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{windowLabel(r.start, r.last)} · {r.days} days</div>
        </div>
        <button aria-label="Earlier report" id="report-prev" onClick={() => setBack((b) => b + 1)} style={nav}><ChevronLeft size={15} /></button>
        <button aria-label="Later report" id="report-next" onClick={() => setBack((b) => Math.max(0, b - 1))} disabled={back === 0} style={{ ...nav, opacity: back === 0 ? 0.35 : 1 }}><ChevronRight size={15} /></button>
      </div>

      {r.empty ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing was logged in these days.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '12px 16px' }}>
            <Fig label="Income" value={rupees(r.income)} tone="income" />
            <Fig label="Spent" value={rupees(r.spent)} tone="expense" sub={r.spentChange != null ? `${r.spentChange > 0 ? '+' : ''}${r.spentChange}% vs before` : null} />
            <Fig label="Saved" value={rupees(r.saved)} tone="savings" sub={r.savingsRate != null ? `${r.savingsRate}% of income` : null} />
            <Fig label="Left" value={rupees(r.left)} tone={r.left < 0 ? 'expense' : 'text'} />
          </div>
          <p id="report-headline" style={{ margin: 0, padding: '0 16px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, minHeight: '1.45em' }}>{typed ?? r.headline}</p>
          {r.spent > 0 && <Analysis a={r.analysis} spent={r.spent} />}

          <Group Icon={TrendingUp} tone="expense" title="Went up" empty="Nothing went up." rows={r.up}
            render={(c) => <>{c.label}<Amt>{c.change === 'new' ? `new · ${rupees(c.now)}` : `+${rupees(c.diff)} · ${rupees(c.now)}`}</Amt></>} />
          <Group Icon={TrendingDown} tone="income" title="Went down" empty="Nothing went down." rows={r.down}
            render={(c) => <>{c.label}<Amt>{c.change === 'stopped' ? `none this time (was ${rupees(c.before)})` : `−${rupees(-c.diff)} · ${rupees(c.now)}`}</Amt></>} />
          {r.steady.length > 0 && (
            <Group Icon={Minus} tone="text-muted" title="About the same" rows={r.steady} render={(c) => <>{c.label}<Amt>{rupees(c.now)}</Amt></>} />
          )}
          {r.missed.length > 0 && (
            <Group Icon={AlertCircle} tone="lent" title="Missed or skipped" rows={r.missed}
              render={(m) => <>{m.name} · {fromKey(m.dateKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<Amt>{m.skipped ? 'skipped' : 'not paid'} · {rupees(m.amount)}</Amt></>} />
          )}
          {(r.over.length > 0 || r.overTotal) && (
            <Group Icon={Target} tone="expense" title="Over budget" rows={[...(r.overTotal ? [{ key: '_total', label: 'Whole budget', spent: r.overTotal.spent, limit: r.overTotal.limit }] : []), ...r.over]}
              render={(c) => <>{c.label}<Amt>{rupees(c.spent)} of {rupees(c.limit)}</Amt></>} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <Fig label="Per day" value={rupees(r.avgPerDay)} />
            <Fig label="No-spend days" value={r.noSpendDays} />
            <Fig label="Biggest" value={r.biggest ? rupees(r.biggest.amount) : '—'} sub={r.biggest?.name} />
          </div>
        </>
      )}

      <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>A new report on the</span>
        <select id="report-day" value={day} aria-label="Report day" onChange={(e) => onPatchSettings?.({ report: { ...(settings?.report ?? {}), day: Number(e.target.value) } })}
          style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
        </select>
        <span>of every month · next on {nextOn}</span>
        <span style={{ flexBasis: '100%', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          It starts on the day your main income arrived the month before, so each report runs salary to salary.
        </span>
      </div>
    </div>
  );
}

/* Essentials vs lifestyle, week by week, and a few patterns */
function Analysis({ a, spent }) {
  const parts = [
    { key: 'essentials', label: 'Essentials', color: 'var(--income)' },
    { key: 'lifestyle', label: 'Lifestyle', color: 'var(--expense)' },
    { key: 'other', label: 'Unsorted', color: 'var(--text-muted)' },
  ].filter((p) => a.split[p.key] > 0);
  const maxWeek = Math.max(1, ...a.weeks.map((w) => w.amount));
  const lines = [
    a.top.length > 1 && <>Top {a.top.length} categories took <strong>{a.topShare}%</strong> of spending — {a.top.map((c) => `${c.label} ${c.share}%`).join(', ')}</>,
    a.weekend > 0 && a.weekday > 0 && Math.abs(a.weekend - a.weekday) / Math.max(a.weekend, a.weekday) >= 0.2 && (
      a.weekend > a.weekday
        ? <>Weekends cost more: <strong>{rupees(a.weekend)}</strong> a day vs {rupees(a.weekday)} on weekdays</>
        : <>Weekdays cost more: <strong>{rupees(a.weekday)}</strong> a day vs {rupees(a.weekend)} on weekends</>),
    a.frequent && <>Most often: <strong>{a.frequent.name}</strong> — {a.frequent.count} times, {rupees(a.frequent.amount)} in all</>,
    a.small.count >= 5 && <>{a.small.count} small spends under {formatMoneyCompact(SMALL_SPEND)} added up to <strong>{rupees(a.small.amount)}</strong></>,
  ].filter(Boolean);
  return (
    <div id="report-analysis" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--surface2)' }}>
          {parts.map((p) => <div key={p.key} style={{ width: `${(a.split[p.key] / spent) * 100}%`, background: p.color }} />)}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
          {parts.map((p) => (
            <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              {p.label} <strong style={{ color: 'var(--text)' }}>{rupees(a.split[p.key])}</strong> · {Math.round((a.split[p.key] / spent) * 100)}%
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Week by week</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${a.weeks.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'end' }}>
          {a.weeks.map((w) => (
            <div key={w.week} title={`Week ${w.week} · from ${fromKey(w.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{w.amount ? rupees(w.amount) : '—'}</span>
              <div style={{ width: '100%', height: 44, display: 'flex', alignItems: 'flex-end' }}>
                <div className="week-bar" style={{ width: '100%', height: `${Math.max(4, (w.amount / maxWeek) * 100)}%`, borderRadius: 6, background: 'var(--expense)', opacity: w.amount === maxWeek ? 1 : 0.4 }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>W{w.week}</span>
            </div>
          ))}
        </div>
      </div>
      {lines.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
          {lines.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: 12, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, borderRadius: 99, background: 'var(--accent)' }} />{l}</li>)}
        </ul>
      )}
    </div>
  );
}

function Fig({ label, value, tone, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: tone && tone !== 'text' ? `var(--${tone})` : 'var(--text)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

function Amt({ children }) {
  return <span style={{ marginLeft: 'auto', paddingLeft: 10, fontWeight: 650, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{children}</span>;
}

function Group({ Icon, tone, title, rows, render, empty }) {
  if (!rows.length && !empty) return null;
  return (
    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 750, letterSpacing: '0.04em', textTransform: 'uppercase', color: `var(--${tone})`, marginBottom: 4 }}>
        <Icon size={13} /> {title}
      </div>
      {rows.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{empty}</div>
        : rows.slice(0, 6).map((row, i) => (
          <div key={row.key ?? `${row.name}-${row.dateKey ?? i}`} style={{ display: 'flex', alignItems: 'baseline', fontSize: 13, color: 'var(--text)', padding: '3px 0', minWidth: 0 }}>{render(row)}</div>
        ))}
    </div>
  );
}
