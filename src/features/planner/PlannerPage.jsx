// ─── Planner ─────────────────────────────────────────────────────
// Long-term calculators: retirement, FIRE, a child's education and a
// step-up SIP (utils/planner.js). Inputs start from your own numbers —
// what you spend, earn and have saved — and are remembered in
// settings.planner. A result can become a Savings goal.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Target, ChevronRight, Info, Bookmark, X, Lightbulb } from 'lucide-react';
import { PageHeader, PrimaryPill } from '../../components/Page';
import { useShell } from '../../app/shellContext';
import { retirement, fire, education, stepUpSip, loan, RETIREMENT_DEFAULTS, FIRE_DEFAULTS, EDUCATION_DEFAULTS, SIP_DEFAULTS, LOAN_DEFAULTS } from '../../utils/planner';
import { taxSummary, taxSaved } from '../../utils/tax';
import { toKey as dayKey } from '../../utils/recurring';
import { bucketTotals, emergencyCover } from '../../utils/moneyPlan';
import { formatBig, formatMoneyCompact, currencySymbol } from '../../utils/money';
import { localMonthKey } from '../../utils/dateHelpers';
import { generateId } from '../../utils/storage';
import { toKey } from '../../utils/recurring';
import { incomeKind } from '../../utils/finance';
import { EMPTY_RULES } from '../../utils/categories';
import { fieldStyle } from '../../components/formTokens';
import { t as tr } from '../../i18n';

const TABS = [
  { key: 'retirement', label: 'Retirement' },
  { key: 'fire', label: 'FIRE' },
  { key: 'education', label: 'Education' },
  { key: 'sip', label: 'SIP' },
  { key: 'loan', label: 'Loan' },
  { key: 'tax', label: 'Tax' },
];
/* What each calculator is for, in plain words — shown above its inputs */
const GUIDE = {
  retirement: { q: 'How much money do I need to stop working at 60 — and what should I put away each month to get there?', how: 'Enter your age, when you want to retire and what you spend a month today. The rest are sensible assumptions you can leave alone.', then: 'The answer is one monthly amount. Tap “Make it a goal” and Savings tracks it for you.' },
  fire: { q: 'Could I stop working early — say at 45 — and live off my investments?', how: 'FIRE means “financial independence, retire early”: once your investments are about 25 times your yearly expenses, they can pay for your life. Enter what you earn, spend and have invested.', then: 'You see the amount you need, whether you reach it, and the earliest age you could stop.' },
  education: { q: 'What will my child’s college cost when they get there, and how much should I save each month for it?', how: 'Enter the child’s age, the age they’ll need the money, and what the course costs today. Fees rise fast, so the future cost is much higher.', then: 'Pick the monthly, yearly or one-time amount that suits you, or check a plan you already have.' },
  sip: { q: 'If I invest a fixed amount every month (a SIP), what will it grow to?', how: 'Enter the monthly amount, for how many years, and how much you’ll raise it each year. Save one plan per SIP — a mutual fund, gold, a recurring deposit.', then: 'Compare what you put in with what it becomes. Add it as a monthly payment in Bills so it is not forgotten.' },
  loan: { q: 'What will this loan really cost me — the monthly EMI, the total interest — and how much do I save by paying a little extra?', how: 'Enter the amount, interest rate and years. Save one plan per loan (home, car, personal) to see all your EMIs together.', then: 'Try an extra amount each month: even a small one cuts years and a lot of interest.' },
  tax: { q: 'Am I using the tax savings I’m allowed this financial year?', how: 'Built from your own entries — insurance, PF, investments, home-loan interest. Pick your tax slab.', then: 'It shows what is still unused under each section, and the tax that would save.' },
};
const HEADLINE = {
  retirement: (v) => `${tr("needs")} ${formatBig(retirement(v).corpus)}`,
  fire: (v) => `${tr("needs")} ${formatBig(fire(v).fireNumber)}`,
  education: (v) => `${tr("needs")} ${formatBig(education(v).corpus)}`,
  sip: (v) => `${formatMoneyCompact(v.monthly)} ${tr("a month")}`,
  loan: (v) => `EMI ${formatMoneyCompact(loan(v).emi)}`,
};
const TOTAL = {
  sip: (list) => `${tr("All your SIPs:")} ${formatMoneyCompact(list.reduce((t, p) => t + (Number(p.v.monthly) || 0), 0))} ${tr("a month")}`,
  loan: (list) => `${tr("All your loans:")} ${formatMoneyCompact(list.reduce((t, p) => t + (loan(p.v).emi || 0), 0))} ${tr("EMI a month ·")} ${formatBig(list.reduce((t, p) => t + (Number(p.v.principal) || 0), 0))} ${tr("borrowed")}`,
};
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

export default function PlannerPage({ transactions = [], income = [], settings, onPatchSettings, recurring }) {
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
    loan: { ...LOAN_DEFAULTS, ...saved.loan },
    tax: { slab: 0.2, ...saved.tax },
  }));

  // Named plans kept per calculator — one per loan, per SIP, per child …
  const [plans, setPlans] = useState(() => saved.plans ?? {});
  const [rev, setRev] = useState(0);   // loading a plan re-mounts the inputs with its values
  const savePlan = (name) => setPlans((p) => {
    const list = p[tab] ?? [];
    const same = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const next = same ? list.map((x) => (x === same ? { ...x, v: inputs[tab] } : x)) : [...list, { id: generateId(), name, v: inputs[tab] }].slice(-20);
    shell?.toast?.(same ? `Updated “${same.name}”` : `Saved “${name}”`);
    return { ...p, [tab]: next };
  });
  const loadPlan = (pl) => { setInputs((s) => ({ ...s, [tab]: { ...s[tab], ...pl.v } })); setRev((r) => r + 1); };
  const removePlan = (id) => setPlans((p) => ({ ...p, [tab]: (p[tab] ?? []).filter((x) => x.id !== id) }));

  // Remember inputs (quietly, a moment after the last change)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const t = setTimeout(() => onPatchSettings?.({ planner: { ...inputs, tab, plans } }), 700);
    return () => clearTimeout(t);
  }, [inputs, tab, plans]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <PageHeader title={tr("Planner")} subtitle={tr("Retirement, FIRE, education, SIPs, loans, tax")} />
      <div className="tab-body">
        <div className="tl-ranges planner-tabs" role="tablist" aria-label={tr("Calculator")}>
          {TABS.map((tb) => (
            <button key={tb.key} id={`planner-tab-${tb.key}`} role="tab" aria-selected={tab === tb.key} className={tab === tb.key ? 'on' : ''} onClick={() => setTab(tb.key)}>{tr(tb.label)}</button>
          ))}
        </div>
        <Guide tab={tab} />
        {tab !== 'tax' && <SavedPlans key={tab} tab={tab} list={plans[tab] ?? []} current={inputs[tab]} onSave={savePlan} onLoad={loadPlan} onRemove={removePlan} />}
        <div key={`${tab}-${rev}`}>
        {tab === 'retirement' && <Retirement v={inputs.retirement} set={set('retirement')} onGoal={makeGoal} />}
        {tab === 'fire' && <Fire v={inputs.fire} set={set('fire')} onGoal={makeGoal} />}
        {tab === 'education' && <Education v={inputs.education} set={set('education')} onGoal={makeGoal} />}
        {tab === 'sip' && <Sip v={inputs.sip} set={set('sip')} />}
        {tab === 'loan' && <Loan v={inputs.loan} set={set('loan')} />}
        {tab === 'tax' && <Tax v={inputs.tax} set={set('tax')} transactions={transactions} recurringRules={recurring?.rules ?? []} rules={rules} />}
        </div>
        <p style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '14px 2px 0' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {tr("Estimates, not advice. Returns and inflation are assumptions — change them to see how the picture moves.")}
        </p>
      </div>
    </div>
  );
}

/* ── What this calculator answers ───────────────────────────────── */
function Guide({ tab }) {
  const g = GUIDE[tab];
  if (!g) return null;
  return (
    <div className="card planner-guide" id="planner-guide" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10 }}>
      <Lightbulb size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{tr(g.q)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{tr(g.how)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{tr(g.then)}</div>
      </div>
    </div>
  );
}

/* ── Your saved plans for this calculator ───────────────────────── */
function SavedPlans({ tab, list, current, onSave, onLoad, onRemove }) {
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const submit = () => { const n = name.trim().slice(0, 40); if (!n) return; onSave(n); setName(''); setNaming(false); };
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 11px', fontSize: 12, fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  return (
    <div id="planner-plans" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {list.map((pl) => {
          const on = same({ ...current, ...pl.v }, current);
          return (
            <span key={pl.id} style={{ ...chip, borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'var(--accent-bg)' : 'var(--surface2)' }}>
              <button type="button" onClick={() => onLoad(pl)} style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textAlign: 'left', color: 'inherit' }}>
                <strong>{pl.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {HEADLINE[tab]?.(pl.v)}</span>
              </button>
              <button type="button" aria-label={`Remove ${pl.name}`} onClick={() => onRemove(pl.id)} style={{ width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
            </span>
          );
        })}
        {naming ? (
          <span style={{ display: 'inline-flex', gap: 6, flex: '1 1 200px', maxWidth: 320 }}>
            <input id="planner-plan-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setNaming(false); }}
              placeholder={tab === 'loan' ? tr("Home loan, car loan…") : tab === 'sip' ? tr("Mutual fund, gold, RD…") : tr("A name for this plan")} style={{ ...fieldStyle, flex: 1, padding: '7px 10px', fontSize: 13 }} />
            <button type="button" id="planner-plan-save" onClick={submit} disabled={!name.trim()} style={{ padding: '0 12px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', opacity: name.trim() ? 1 : 0.5 }}>{tr("Save")}</button>
          </span>
        ) : (
          <button type="button" id="planner-plan-add" onClick={() => setNaming(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)' }}>
            <Bookmark size={12} /> {list.length ? tr("Save as another plan") : tr("Save this plan")}
          </button>
        )}
      </div>
      {list.length === 0 && !naming && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{tr("Have more than one? Save each with a name and switch between them.")}</div>}
      {list.length > 1 && TOTAL[tab] && <div id="planner-plans-total" style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', marginTop: 8 }}>{TOTAL[tab](list)}</div>}
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
        {tr("Year by year")} <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
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
  <div style={{ marginTop: 14 }}><PrimaryPill id={id} Icon={Target} onClick={onClick}>{tr("Make it a goal")}</PrimaryPill></div>
);

/* ── Retirement ─────────────────────────────────────────────────── */
function Retirement({ v, set, onGoal }) {
  const r = useMemo(() => retirement(v), [v]);
  const valid = v.retireAge > v.age && v.lifeAge > v.retireAge;
  return (
    <>
      <Inputs>
        <Num id="ret-age" label={tr("Your age")} kind="age" value={v.age} onChange={(n) => set('age', n)} />
        <Num id="ret-retire" label={tr("Retire at")} kind="age" value={v.retireAge} onChange={(n) => set('retireAge', n)} />
        <Num id="ret-life" label={tr("Plan until age")} kind="age" value={v.lifeAge} onChange={(n) => set('lifeAge', n)} />
        <Num id="ret-expense" label={tr("Monthly expenses today")} value={v.monthlyExpense} onChange={(n) => set('monthlyExpense', n)} />
        <Num id="ret-saved" label={tr("Saved for it already")} value={v.saved} onChange={(n) => set('saved', n)} />
        <Num id="ret-infl" label={tr("Inflation till then")} kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="ret-pre" label={tr("Return while working")} kind="pct" value={v.preReturn} onChange={(n) => set('preReturn', n)} />
        <Num id="ret-post" label={tr("Return after retiring")} kind="pct" value={v.postReturn} onChange={(n) => set('postReturn', n)} />
        <Num id="ret-postinfl" label={tr("Inflation after retiring")} kind="pct" value={v.postInflation} onChange={(n) => set('postInflation', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>{tr("Retire after your age, and plan until after you retire.")}</Verdict> : (
        <Result label={`You’ll need at ${v.retireAge}`} value={big(r.corpus)}
          sub={<>{tr("To spend")} <strong>{money(r.expenseAtRetirement)}</strong> {tr("a month then — what")} {money(v.monthlyExpense)} {tr("buys today — until")} {v.lifeAge}.</>}>
          <Figures items={[
            { label: tr("Invest every month"), value: money(r.sip), color: 'var(--accent)', sub: `for ${r.years} years` },
            { label: tr("Your savings grow to"), value: big(r.savedGrows) },
            { label: tr("Still to build"), value: big(r.gap), color: r.gap > 0 ? 'var(--expense)' : 'var(--income)' },
          ]} />
          <Bars values={r.drawdown.map((d) => d.start)} labels={r.drawdown.map((d) => `Age ${d.age}`)} highlightLast={false} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{tr("The money after you retire, year by year — it runs out right at")} {v.lifeAge}.</div>
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
        <Num id="fire-age" label={tr("Your age")} kind="age" value={v.age} onChange={(n) => set('age', n)} />
        <Num id="fire-at" label={tr("Stop working at")} kind="age" value={v.fireAge} onChange={(n) => set('fireAge', n)} />
        <Num id="fire-income" label={tr("Yearly income")} value={v.annualIncome} onChange={(n) => set('annualIncome', n)} />
        <Num id="fire-expense" label={tr("Yearly expenses")} value={v.annualExpense} onChange={(n) => set('annualExpense', n)} />
        <Num id="fire-invested" label={tr("Invested today")} value={v.invested} onChange={(n) => set('invested', n)} />
        <Num id="fire-growth" label={tr("Salary rise a year")} kind="pct" value={v.salaryGrowth} onChange={(n) => set('salaryGrowth', n)} />
        <Num id="fire-infl" label={tr("Inflation")} kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="fire-return" label={tr("Return while investing")} kind="pct" value={v.preReturn} onChange={(n) => set('preReturn', n)} />
        <Num id="fire-post" label={tr("Return after you stop")} kind="pct" value={v.postReturn} onChange={(n) => set('postReturn', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>{tr("Pick an age from today onwards.")}</Verdict> : (
        <Result label={`Your FIRE number at ${v.fireAge}`} value={big(f.fireNumber)} tone={f.achieved ? 'income' : 'accent'}
          sub={<>{tr("25 years of your expenses then (")}{money(f.expenseAtFire)} {tr("a year) — the 4% rule. Safer, 30×:")} {big(f.fireNumber30)}.</>}>
          <Figures items={[
            { label: `You’d have at ${v.fireAge}`, value: big(f.corpus), color: f.achieved ? 'var(--income)' : 'var(--text)' },
            { label: tr("Earliest you could stop"), value: f.earliest ? `Age ${f.earliest}` : 'After 70', color: 'var(--accent)' },
            { label: tr("Money lasts until"), value: f.forever ? '100+' : `Age ${f.lastsUntil}` },
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
        <Num id="edu-child" label={tr("Child’s age")} kind="age" value={v.childAge} onChange={(n) => set('childAge', n)} />
        <Num id="edu-goal" label={tr("Needed at age")} kind="age" value={v.goalAge} onChange={(n) => set('goalAge', n)} />
        <Num id="edu-cost" label={tr("What it costs today")} value={v.cost} onChange={(n) => set('cost', n)} />
        <Num id="edu-infl" label={tr("Education inflation")} kind="pct" value={v.inflation} onChange={(n) => set('inflation', n)} />
        <Num id="edu-return" label={tr("Expected return")} kind="pct" value={v.expectedReturn} onChange={(n) => set('expectedReturn', n)} />
        <Num id="edu-lump" label={tr("Put in today (optional)")} value={v.lumpSum} onChange={(n) => set('lumpSum', n)} />
        <Num id="edu-plan" label={tr("You plan per month")} value={v.plannedMonthly} onChange={(n) => set('plannedMonthly', n)} hint={tr("Optional — we’ll check it")} />
        <Num id="edu-step" label={tr("Raised every year by")} kind="pct" value={v.stepUp} onChange={(n) => set('stepUp', n)} />
      </Inputs>
      {!valid ? <Verdict ok={false}>{tr("The goal age has to be after the child’s age.")}</Verdict> : (
        <Result label={`Needed in ${e.years} years`} value={big(e.corpus)}
          sub={<>{tr("What")} {big(v.cost)} {tr("costs today, after")} {Math.round(v.inflation * 100)}{tr("% inflation a year.")}</>}>
          <Figures items={[
            { label: tr("Every month"), value: money(e.monthly), color: 'var(--accent)' },
            { label: tr("Or every year"), value: big(e.yearly) },
            { label: tr("Or once, today"), value: big(e.lumpSumNeeded) },
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
        <Num id="sip-monthly" label={tr("Monthly SIP to start")} value={v.monthly} onChange={(n) => set('monthly', n)} />
        <Num id="sip-years" label={tr("For")} kind="years" value={v.years} onChange={(n) => set('years', n)} />
        <Num id="sip-return" label={tr("Expected return")} kind="pct" value={v.expectedReturn} onChange={(n) => set('expectedReturn', n)} />
        <Num id="sip-step" label={tr("Raise every year by")} kind="pct" value={v.stepPct} onChange={(n) => set('stepPct', n)} hint={byAmount ? tr("Using the fixed amount instead") : null} />
        <Num id="sip-step-amt" label={tr("…or by a fixed amount")} value={v.stepAmount} onChange={(n) => set('stepAmount', n)} hint={tr("Leave 0 to use the %")} />
        <Num id="sip-hold" label={tr("Then leave it for")} kind="years" value={v.holding} onChange={(n) => set('holding', n)} hint={tr("Nothing added")} />
      </Inputs>
      <Result label={`In ${s.rows.length} years`} value={big(s.value)} tone="income"
        sub={<>{tr("You put in")} {big(s.invested)} {tr("— the rest,")} <strong>{big(s.gain)}</strong>{tr(", is growth.")}</>}>
        <Figures items={[
          { label: tr("Without the raise"), value: big(s.flatValue) },
          { label: tr("The raise adds"), value: big(s.value - s.flatValue), color: 'var(--income)' },
          { label: tr("Last monthly SIP"), value: money(s.rows.filter((r) => r.monthly > 0).at(-1)?.monthly ?? 0) },
        ]} />
        <Bars values={s.rows.map((x) => x.end)} labels={s.rows.map((x) => `Year ${x.year}`)} />
        <Table id="sip-table" head={['Year', 'Monthly', 'Value']} rows={s.rows.map((x) => [x.year, money(x.monthly), big(x.end)])} />
      </Result>
    </>
  );
}

/* ── Loan EMI & prepayment ──────────────────────────────────────── */
function Loan({ v, set }) {
  const l = useMemo(() => loan(v), [v]);
  const ym = (m) => `${Math.floor(m / 12) ? `${Math.floor(m / 12)} yr${Math.floor(m / 12) === 1 ? '' : 's'}` : ''}${m % 12 ? ` ${m % 12} mo` : ''}`.trim();
  return (
    <>
      <Inputs>
        <Num id="loan-amount" label={tr("Loan amount")} value={v.principal} onChange={(n) => set('principal', n)} />
        <Num id="loan-rate" label={tr("Interest a year")} kind="pct" value={v.rate} onChange={(n) => set('rate', n)} />
        <Num id="loan-years" label={tr("For")} kind="years" value={v.years} onChange={(n) => set('years', n)} />
        <Num id="loan-extra" label={tr("Pay extra each month")} value={v.extra} onChange={(n) => set('extra', n)} hint={tr("Optional — see what it saves")} />
      </Inputs>
      <Result label={tr("Your EMI")} value={money(l.emi)} sub={<>{tr("For")} {ym(l.months)} {tr("— you pay back")} <strong>{big(l.totalPaid)}</strong>{tr(", of which")} <strong>{big(l.totalInterest)}</strong> {tr("is interest.")}</>}>
        <Figures items={[
          { label: tr("Interest"), value: big(l.totalInterest), color: 'var(--expense)' },
          { label: tr("Interest share"), value: `${Math.round((l.totalInterest / Math.max(1, l.totalPaid)) * 100)}%` },
          { label: tr("Paid back in all"), value: big(l.totalPaid) },
        ]} />
        {l.prepay && (
          <Verdict ok>
            {tr("Paying")} {money(v.extra)} {tr("more a month saves")} <strong>{big(l.prepay.interestSaved)}</strong> {tr("in interest and closes the loan")} {ym(l.prepay.monthsSaved)} {tr("early.")}
          </Verdict>
        )}
        <Bars values={(l.prepay?.schedule ?? l.schedule).map((y) => y.end)} labels={(l.prepay?.schedule ?? l.schedule).map((y) => `Year ${y.year}`)} highlightLast={false} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{tr("What’s still owed at the end of each year")}</div>
        <Table id="loan-table" head={['Year', 'Interest', 'Principal', 'Still owed']} rows={(l.prepay?.schedule ?? l.schedule).map((y) => [y.year, big(y.interest), big(y.principal), big(y.end)])} />
      </Result>
    </>
  );
}

/* ── Tax saving (old regime) ────────────────────────────────────── */
const SLABS = [0.05, 0.2, 0.3];
function Tax({ v, set, transactions, recurringRules, rules }) {
  const todayKey = dayKey(new Date());
  const t = useMemo(() => taxSummary({ transactions, recurringRules, rules, todayKey }), [transactions, recurringRules, rules, todayKey]);
  const c80 = t.sections.find((x) => x.key === '80C');
  return (
    <>
      <Result label={`Tax saving · ${t.fy.label}`} value={big(t.deductible)} tone="income"
        sub={<>{tr("Found in your entries so far · about")} <strong>{money(taxSaved(t.deductible, v.slab))}</strong> {tr("less tax at the")} {Math.round(v.slab * 100)}{tr("% slab ·")} {t.daysLeft} {tr("days left in the year.")}</>}>
        <div role="radiogroup" aria-label={tr("Your tax slab")} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          {tr("Your slab:")}
          {SLABS.map((sl) => (
            <button key={sl} id={`tax-slab-${Math.round(sl * 100)}`} role="radio" aria-checked={v.slab === sl} onClick={() => set('slab', sl)}
              style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${v.slab === sl ? 'var(--income)' : 'var(--border)'}`, background: v.slab === sl ? 'var(--income-bg)' : 'transparent', color: v.slab === sl ? 'var(--income)' : 'var(--text-secondary)' }}>
              {Math.round(sl * 100)}%
            </button>
          ))}
        </div>
        <div id="tax-sections" style={{ marginTop: 14 }}>
          {t.sections.map((sec) => <TaxRow key={sec.key} sec={sec} />)}
        </div>
        {c80 && c80.left > 0 && (
          <Verdict ok={false}>{money(c80.left)} {tr("of 80C room left — PPF, ELSS or a tax-saver FD before 31 March would use it.")}</Verdict>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '12px 0 0' }}>
          {tr("Only the old tax regime allows these deductions. Entries are matched by name (PPF, ELSS, NPS, LIC, health insurance, tuition, rent); EPF taken from salary isn’t here unless you log it.")}
        </p>
      </Result>
    </>
  );
}
function TaxRow({ sec }) {
  const [open, setOpen] = useState(false);
  const pct = sec.limit ? Math.min(100, (sec.used / sec.limit) * 100) : null;
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <button id={`tax-${sec.key}`} onClick={() => setOpen((o) => !o)} disabled={!sec.entries.length}
        style={{ width: '100%', display: 'flex', alignItems: 'baseline', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: sec.entries.length ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sec.label}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sec.hint}</span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {money(sec.used)}{sec.limit ? <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}> / {big(sec.limit)}</span> : null}
        </span>
      </button>
      {pct != null && (
        <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', marginTop: 7, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--income)' : 'var(--accent)' }} />
        </div>
      )}
      {open && sec.entries.map((e) => (
        <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0 0 10px' }}>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          <strong style={{ color: 'var(--text)' }}>{money(e.amount)}</strong>
        </div>
      ))}
    </div>
  );
}
