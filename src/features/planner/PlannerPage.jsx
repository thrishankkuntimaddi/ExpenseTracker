// ─── Planner ─────────────────────────────────────────────────────
// Long-term calculators: retirement, FIRE, a child's education and a
// step-up SIP (utils/planner.js). Inputs start from your own numbers —
// what you spend, earn and have saved — and are remembered in
// settings.planner. A result can become a Savings goal.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Target, ChevronRight, Info } from 'lucide-react';
import { PageHeader, PrimaryPill } from '../../components/Page';
import { useShell } from '../../app/shellContext';
import { retirement, fire, education, stepUpSip, RETIREMENT_DEFAULTS, FIRE_DEFAULTS, EDUCATION_DEFAULTS, SIP_DEFAULTS } from '../../utils/planner';
import { bucketTotals, emergencyCover } from '../../utils/moneyPlan';
import { formatBig, formatMoneyCompact, currencySymbol } from '../../utils/money';
import { localMonthKey } from '../../utils/dateHelpers';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';
import { incomeKind } from '../../utils/finance';
import { EMPTY_RULES } from '../../utils/categories';
import { fieldStyle } from '../../components/formTokens';

const TABS = [
  { key: 'retirement', label: 'Retirement' },
  { key: 'fire', label: 'FIRE' },
  { key: 'education', label: 'Education' },
  { key: 'sip', label: 'SIP' },
];
const big = (n) => formatBig(n);
const money = (n) => formatMoneyCompact(n);

/* Your last three full months, for sensible starting values */
function useYourNumbers(transactions, income, rules) {
  return useMemo(() => {
    const now = new Date();
    const keys = [1, 2, 3].map((i) => localMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 15).toISOString()));
    const spends = keys.map((k) => { const b = bucketTotals(transactions, k, rules); return b.essentials + b.lifestyle + b.emis; }).filter((v) => v > 0);
    const incomes = keys.map((k) => income.filter((i) => localMonthKey(i.date) === k && !i.isCarryForward && incomeKind(i) === 'income')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)).filter((v) => v > 0);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const r100 = (n) => Math.round(n / 100) * 100;
    return {
      monthlySpend: r100(avg(spends)),
      annualIncome: r100(avg(incomes) * 12),
      saved: r100(emergencyCover(transactions, keys[0], rules).saved),
    };
  }, [transactions, income, rules]);
}

export default function PlannerPage({ transactions = [], income = [], settings, onPatchSettings }) {
  const shell = useShell();
  const rules = settings?.categoryRules ?? EMPTY_RULES;
  const yours = useYourNumbers(transactions, income, rules);
  const saved = settings?.planner ?? {};
  const [tab, setTab] = useState(saved.tab ?? 'retirement');

  // Starting values: what you saved here before, else your own numbers, else the defaults
  const [inputs, setInputs] = useState(() => ({
    retirement: { ...RETIREMENT_DEFAULTS, ...(yours.monthlySpend ? { monthlyExpense: yours.monthlySpend } : {}), ...(yours.saved ? { saved: yours.saved } : {}), ...saved.retirement },
    fire: {
      ...FIRE_DEFAULTS,
      ...(yours.annualIncome ? { annualIncome: yours.annualIncome } : {}),
      ...(yours.monthlySpend ? { annualExpense: yours.monthlySpend * 12 } : {}),
      ...(yours.saved ? { invested: yours.saved } : {}),
      ...saved.fire,
    },
    education: { ...EDUCATION_DEFAULTS, ...saved.education },
    sip: { ...SIP_DEFAULTS, ...saved.sip },
  }));

  // Remember inputs (quietly, a moment after the last change)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const t = setTimeout(() => onPatchSettings?.({ planner: { ...inputs, tab } }), 700);
    return () => clearTimeout(t);
  }, [inputs, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (calc) => (key, value) => setInputs((s) => ({ ...s, [calc]: { ...s[calc], [key]: value } }));

  function makeGoal({ name, target, years, monthly }) {
    const goals = settings?.goals ?? [];
    const d = new Date(); d.setFullYear(d.getFullYear() + Math.max(1, Math.round(years)));
    const goal = { id: generateId(), name, target: Math.round(target), startDate: toKey(new Date()), deadline: toKey(d), linked: true, ...(monthly > 0 ? { monthly: Math.round(monthly) } : {}) };
    onPatchSettings?.({ goals: [...goals, goal] });
    shell?.toast(`Goal added: ${name} · ${big(target)}`);
    shell?.goTo?.('savings');
  }

  return (
    <div className="tab-root planner-page">
      <PageHeader title="Planner" subtitle="Retirement, FIRE, education, SIPs — in today’s numbers" />
      <div className="tab-body">
        <div className="tl-ranges planner-tabs" role="tablist" aria-label="Calculator">
          {TABS.map((t) => (
            <button key={t.key} id={`planner-tab-${t.key}`} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {tab === 'retirement' && <Retirement v={inputs.retirement} set={set('retirement')} onGoal={makeGoal} />}
        {tab === 'fire' && <Fire v={inputs.fire} set={set('fire')} onGoal={makeGoal} />}
        {tab === 'education' && <Education v={inputs.education} set={set('education')} onGoal={makeGoal} />}
        {tab === 'sip' && <Sip v={inputs.sip} set={set('sip')} />}
        <p style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '14px 2px 0' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Estimates, not advice. Returns and inflation are assumptions — change them to see how the picture moves.
        </p>
      </div>
    </div>
  );
}

/* ── Inputs ─────────────────────────────────────────────────────── */
function Inputs({ children }) {
  return <div className="card planner-inputs" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px 12px' }}>{children}</div>;
}

const affix = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none' };

/** A number field; kind 'pct' shows 12 for 0.12, 'money' shows the currency, 'age'/'years' plain. */
function Num({ id, label, value, onChange, kind = 'money', hint }) {
  const toText = (v) => (kind === 'pct' ? String(Math.round(v * 1000) / 10) : String(v ?? ''));
  const [text, setText] = useState(() => toText(value));
  const suffix = kind === 'pct' ? '%' : kind === 'age' ? 'yrs' : kind === 'years' ? 'yrs' : null;
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        {kind === 'money' && <span aria-hidden style={{ ...affix, left: 11 }}>{currencySymbol()}</span>}
        <input id={id} value={text} inputMode="decimal" onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const t = e.target.value;
            if (t !== '' && !/^\d*\.?\d*$/.test(t)) return;
            setText(t);
            const n = Number(t) || 0;
            onChange(kind === 'pct' ? n / 100 : n);
          }}
          style={{ ...fieldStyle, padding: `9px ${suffix ? 34 : 11}px 9px ${kind === 'money' ? 26 : 11}px`, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
        {suffix && <span aria-hidden style={{ ...affix, right: 11 }}>{suffix}</span>}
      </span>
      {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  );
}

/* ── Results ────────────────────────────────────────────────────── */
function Result({ label, value, sub, tone = 'accent', children }) {
  return (
    <div className="card planner-result" style={{ padding: '16px', marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div className="planner-big" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: `var(--${tone})`, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Figures({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      {items.map((f) => (
        <div key={f.label} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{f.label}</div>
          <div style={{ fontSize: 15, fontWeight: 750, color: f.color ?? 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{f.value}</div>
          {f.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{f.sub}</div>}
        </div>
      ))}
    </div>
  );
}
function Verdict({ ok, children }) {
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, background: ok ? 'var(--income-bg)' : 'var(--lent-bg)', color: ok ? 'var(--income)' : 'var(--lent)' }}>{children}</div>
  );
}

/** Growth as small bars, one per year (the last bar highlighted). */
function Bars({ values, labels, highlightLast = true }) {
  const max = Math.max(1, ...values);
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, marginTop: 14 }}>
      {values.map((v, i) => (
        <div key={i} title={`${labels[i]} · ${big(v)}`} style={{ flex: 1, minWidth: 0, height: `${Math.max(2, (Math.max(0, v) / max) * 100)}%`, borderRadius: 3, background: 'var(--accent)', opacity: highlightLast && i === values.length - 1 ? 1 : highlightLast ? 0.35 : 0.55 }} />
      ))}
    </div>
  );
}

function Table({ id, head, rows }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button id={id} onClick={() => setOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        Year by year <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>{head.map((h, i) => <th key={h} style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '7px 8px', textAlign: i ? 'right' : 'left', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  {r.map((c, j) => <td key={j} style={{ padding: '6px 8px', textAlign: j ? 'right' : 'left', color: typeof c === 'string' && c.startsWith('−') ? 'var(--expense)' : 'var(--text)', whiteSpace: 'nowrap' }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const GoalButton = ({ id, onClick }) => (
  <div style={{ marginTop: 14 }}><PrimaryPill id={id} Icon={Target} onClick={onClick}>Make it a goal</PrimaryPill></div>
);

/* ── Retirement ─────────────────────────────────────────────────── */
function Retirement({ v, set, onGoal }) {
  const r = useMemo(() => retirement(v), [v]);
  const valid = v.retireAge > v.age && v.lifeAge > v.retireAge;
  return (
    <>
      <Inputs>
        <Num id="ret-age" label="Your age" kind="age" value={v.age} onChange={(n) => set('age', n)} />
        <Num id="ret-retire" label="Retire at" kind="age" value={v.retireAge} onChange={(n) => set('retireAge', n)} />
        <Num id="ret-life" label="Plan until age" kind="age" value={v.lifeAge} onChange={(n) => set('lifeAge', n)} />
        <Num id="ret-expense" label="Monthly expenses today" value={v.monthlyExpense} onChange={(n) => set('monthlyExpense', n)} />
        <Num id="ret-saved" label="Saved for it already" value={v.saved} onChange={(n) => set('saved', n)} />
        <Num id="ret-infl" label="Inflation till then" kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="ret-pre" label="Return while working" kind="pct" value={v.preReturn} onChange={(n) => set('preReturn', n)} />
        <Num id="ret-post" label="Return after retiring" kind="pct" value={v.postReturn} onChange={(n) => set('postReturn', n)} />
        <Num id="ret-postinfl" label="Inflation after retiring" kind="pct" value={v.postInflation} onChange={(n) => set('postInflation', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>Retire after your age, and plan until after you retire.</Verdict> : (
        <Result label={`You’ll need at ${v.retireAge}`} value={big(r.corpus)}
          sub={<>To spend <strong>{money(r.expenseAtRetirement)}</strong> a month then — what {money(v.monthlyExpense)} buys today — until {v.lifeAge}.</>}>
          <Figures items={[
            { label: 'Invest every month', value: money(r.sip), color: 'var(--accent)', sub: `for ${r.years} years` },
            { label: 'Your savings grow to', value: big(r.savedGrows) },
            { label: 'Still to build', value: big(r.gap), color: r.gap > 0 ? 'var(--expense)' : 'var(--income)' },
          ]} />
          <Bars values={r.drawdown.map((d) => d.start)} labels={r.drawdown.map((d) => `Age ${d.age}`)} highlightLast={false} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>The money after you retire, year by year — it runs out right at {v.lifeAge}.</div>
          <Table id="ret-table" head={['Age', 'Start', 'Spent', 'End']} rows={r.drawdown.map((d) => [d.age, big(d.start), big(d.expense), big(d.end)])} />
          <GoalButton id="ret-make-goal" onClick={() => onGoal({ name: 'Retirement', target: r.corpus, years: r.years, monthly: r.sip })} />
        </Result>
      )}
    </>
  );
}

/* ── FIRE ───────────────────────────────────────────────────────── */
function Fire({ v, set, onGoal }) {
  const f = useMemo(() => fire(v), [v]);
  const valid = v.fireAge >= v.age;
  return (
    <>
      <Inputs>
        <Num id="fire-age" label="Your age" kind="age" value={v.age} onChange={(n) => set('age', n)} />
        <Num id="fire-at" label="Stop working at" kind="age" value={v.fireAge} onChange={(n) => set('fireAge', n)} />
        <Num id="fire-income" label="Yearly income" value={v.annualIncome} onChange={(n) => set('annualIncome', n)} />
        <Num id="fire-expense" label="Yearly expenses" value={v.annualExpense} onChange={(n) => set('annualExpense', n)} />
        <Num id="fire-invested" label="Invested today" value={v.invested} onChange={(n) => set('invested', n)} />
        <Num id="fire-growth" label="Salary rise a year" kind="pct" value={v.salaryGrowth} onChange={(n) => set('salaryGrowth', n)} />
        <Num id="fire-infl" label="Inflation" kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="fire-return" label="Return while investing" kind="pct" value={v.preReturn} onChange={(n) => set('preReturn', n)} />
        <Num id="fire-post" label="Return after you stop" kind="pct" value={v.postReturn} onChange={(n) => set('postReturn', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>Pick an age from today onwards.</Verdict> : (
        <Result label={`Your FIRE number at ${v.fireAge}`} value={big(f.fireNumber)} tone={f.achieved ? 'income' : 'accent'}
          sub={<>25 years of your expenses then ({money(f.expenseAtFire)} a year) — the 4% rule. Safer, 30×: {big(f.fireNumber30)}.</>}>
          <Figures items={[
            { label: `You’d have at ${v.fireAge}`, value: big(f.corpus), color: f.achieved ? 'var(--income)' : 'var(--text)' },
            { label: 'Earliest you could stop', value: f.earliest ? `Age ${f.earliest}` : 'After 70', color: 'var(--accent)' },
            { label: 'Money lasts until', value: f.forever ? '100+' : `Age ${f.lastsUntil}` },
          ]} />
          <Verdict ok={f.achieved}>
            {f.achieved
              ? `You reach it — at ${v.fireAge} your investments cover 25 years of expenses.`
              : `Short by ${big(f.shortBy)}. Stop later, spend a little less, or invest more of each raise.`}
          </Verdict>
          <Bars values={f.rows.map((x) => x.end)} labels={f.rows.map((x) => `Age ${x.age}`)} />
          <Table id="fire-table" head={['Age', 'Income', 'Expenses', 'Invested', 'Value']} rows={f.rows.map((x) => [x.age, big(x.income), big(x.expense), big(x.invest), big(x.end)])} />
          <GoalButton id="fire-make-goal" onClick={() => onGoal({ name: 'Financial freedom', target: f.fireNumber, years: v.fireAge - v.age })} />
        </Result>
      )}
    </>
  );
}

/* ── A child's education ───────────────────────────────────────── */
function Education({ v, set, onGoal }) {
  const e = useMemo(() => education(v), [v]);
  const valid = v.goalAge > v.childAge;
  return (
    <>
      <Inputs>
        <Num id="edu-child" label="Child’s age" kind="age" value={v.childAge} onChange={(n) => set('childAge', n)} />
        <Num id="edu-goal" label="Needed at age" kind="age" value={v.goalAge} onChange={(n) => set('goalAge', n)} />
        <Num id="edu-cost" label="What it costs today" value={v.cost} onChange={(n) => set('cost', n)} />
        <Num id="edu-infl" label="Education inflation" kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="edu-return" label="Expected return" kind="pct" value={v.expectedReturn} onChange={(n) => set('expectedReturn', n)} />
        <Num id="edu-lump" label="Put in today (optional)" value={v.lumpSum} onChange={(n) => set('lumpSum', n)} />
        <Num id="edu-plan" label="You plan per month" value={v.plannedMonthly} onChange={(n) => set('plannedMonthly', n)} hint="Optional — we’ll check it" />
        <Num id="edu-step" label="Raised every year by" kind="pct" value={v.stepUp} onChange={(n) => set('stepUp', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>The goal age has to be after the child’s age.</Verdict> : (
        <Result label={`Needed in ${e.years} years`} value={big(e.corpus)}
          sub={<>What {big(v.cost)} costs today, after {Math.round(v.inflation * 100)}% inflation a year.</>}>
          <Figures items={[
            { label: 'Every month', value: money(e.monthly), color: 'var(--accent)' },
            { label: 'Or every year', value: big(e.yearly) },
            { label: 'Or once, today', value: big(e.lumpSumNeeded) },
          ]} />
          {e.planned && (
            <Verdict ok={e.planned.enough}>
              {e.planned.enough
                ? `Your plan works: ${money(v.plannedMonthly)} a month, raised ${Math.round(v.stepUp * 100)}% a year, grows to ${big(e.planned.value)}.`
                : `Your plan reaches ${big(e.planned.value)} — ${big(e.planned.shortBy)} short. Raise the monthly amount or the yearly step-up.`}
            </Verdict>
          )}
          <GoalButton id="edu-make-goal" onClick={() => onGoal({ name: 'Child’s education', target: e.corpus, years: e.years, monthly: e.monthly })} />
        </Result>
      )}
    </>
  );
}

/* ── Step-up SIP ────────────────────────────────────────────────── */
function Sip({ v, set }) {
  const s = useMemo(() => stepUpSip(v), [v]);
  const byAmount = Number(v.stepAmount) > 0;
  return (
    <>
      <Inputs>
        <Num id="sip-monthly" label="Monthly SIP to start" value={v.monthly} onChange={(n) => set('monthly', n)} />
        <Num id="sip-years" label="For" kind="years" value={v.years} onChange={(n) => set('years', n)} />
        <Num id="sip-return" label="Expected return" kind="pct" value={v.expectedReturn} onChange={(n) => set('expectedReturn', n)} />
        <Num id="sip-step" label="Raise every year by" kind="pct" value={v.stepPct} onChange={(n) => set('stepPct', n)} hint={byAmount ? 'Using the fixed amount instead' : null} />
        <Num id="sip-step-amt" label="…or by a fixed amount" value={v.stepAmount} onChange={(n) => set('stepAmount', n)} hint="Leave 0 to use the %" />
        <Num id="sip-hold" label="Then leave it for" kind="years" value={v.holding} onChange={(n) => set('holding', n)} hint="Nothing added" />
      </Inputs>
      <Result label={`In ${s.rows.length} years`} value={big(s.value)} tone="income"
        sub={<>You put in {big(s.invested)} — the rest, <strong>{big(s.gain)}</strong>, is growth.</>}>
        <Figures items={[
          { label: 'Without the raise', value: big(s.flatValue) },
          { label: 'The raise adds', value: big(s.value - s.flatValue), color: 'var(--income)' },
          { label: 'Last monthly SIP', value: money(s.rows.filter((r) => r.monthly > 0).at(-1)?.monthly ?? 0) },
        ]} />
        <Bars values={s.rows.map((x) => x.end)} labels={s.rows.map((x) => `Year ${x.year}`)} />
        <Table id="sip-table" head={['Year', 'Monthly', 'Value']} rows={s.rows.map((x) => [x.year, money(x.monthly), big(x.end)])} />
      </Result>
    </>
  );
}
