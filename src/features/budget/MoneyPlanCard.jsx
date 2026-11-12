// ─── Money plan: the month's health check ────────────────────────
// Five buckets as a share of income — essentials, lifestyle, EMIs,
// investments, left over — each against a simple rule of thumb, plus how
// many months your savings would carry you. Built from real entries.
import { useMemo, useState } from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { computeMoneyPlan, EMERGENCY_MONTHS } from '../../utils/moneyPlan';
import { formatMoneyCompact } from '../../utils/money';
import { monthName } from '../../app/month';

import { t as tr } from '../../i18n';
const round = (n) => formatMoneyCompact(n);
const pctText = (p) => `${p !== 0 && Math.abs(p) < 1 ? p.toFixed(1) : Math.round(p)}%`;
const rule = (r) => (r.key === 'investments' ? `aim ${r.limit}%+` : r.key === 'leftover' ? null : `under ${r.limit}%`);

export default function MoneyPlanCard({ transactions, income, monthKey, rules, incomeBase }) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(
    () => computeMoneyPlan({ transactions, income, monthKey, rules, incomeBase }),
    [transactions, income, monthKey, rules, incomeBase],
  );
  if (!plan.hasData && !plan.hasIncome) return null;
  const em = plan.emergency;
  const bars = plan.rows.filter((r) => r.value > 0);
  const total = Math.max(plan.income, plan.outflow);

  return (
    <div className="card money-plan" id="money-plan" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {tr("Money plan ·")} {monthName(monthKey, { month: 'long' })}
        </span>
        {plan.hasIncome && (
          <span style={{ fontSize: 12, fontWeight: 750, color: plan.score >= 3 ? 'var(--income)' : plan.score === 2 ? 'var(--lent)' : 'var(--expense)' }}>
            {plan.score} {tr("of")} {plan.scoreOf} {tr("healthy")}
          </span>
        )}
      </div>

      {!plan.hasIncome ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
          {tr("Add this month’s income (or a recurring salary in Bills) to see how your spending, EMIs and investments compare with it.")}
        </div>
      ) : (
        <>
          {/* Where the income went, in one bar */}
          <div aria-hidden style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', margin: '12px 0 4px', background: 'var(--surface2)' }}>
            {bars.map((r) => (
              <span key={r.key} style={{ width: `${(r.value / total) * 100}%`, background: `var(--${r.tone})` }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            {tr("Of")} {round(plan.income)} {plan.received >= plan.income ? 'that came in' : 'expected'}{plan.leftover < 0 ? ` · ${round(-plan.leftover)} more went out` : ''}
          </div>

          {plan.rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${r.tone})`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{r.label}</span>
                  {rule(r) && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{rule(r)}</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: r.ok ? 'var(--text-secondary)' : 'var(--expense)', marginTop: 1 }}>{tr(r.text)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: r.value < 0 ? 'var(--expense)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{r.value < 0 ? '−' : ''}{round(Math.abs(r.value))}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.ok ? 'var(--income)' : 'var(--expense)', fontVariantNumeric: 'tabular-nums' }}>{pctText(r.pct)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Emergency fund */}
      {em?.months != null && (
        <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <button id="money-plan-emergency" onClick={() => setOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <ShieldCheck size={15} style={{ color: em.months >= EMERGENCY_MONTHS ? 'var(--income)' : 'var(--lent)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {tr("Emergency fund:")} <strong style={{ color: 'var(--text)' }}>{em.months >= 10 ? Math.floor(em.months) : em.months.toFixed(1)} {tr("of")} {EMERGENCY_MONTHS} {tr("months")}</strong> {tr("covered")}
            </span>
            <ChevronRight size={13} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (em.months / EMERGENCY_MONTHS) * 100)}%`, background: em.months >= EMERGENCY_MONTHS ? 'var(--income)' : 'var(--lent)' }} />
          </div>
          {open && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
              {tr("Your essentials and EMIs come to about")} <strong style={{ color: 'var(--text-secondary)' }}>{round(em.monthlyNeed)}</strong> {tr("a month. Six months of that is")} <strong style={{ color: 'var(--text-secondary)' }}>{round(em.target)}</strong>{tr("; your savings so far are")} {round(em.saved)}.
              {em.months < EMERGENCY_MONTHS ? tr(" Fill this before taking on new investments or loans.") : tr(" You’re covered — extra money can go into investments.")}
            </div>
          )}
        </div>
      )}
      {plan.lent > 0 && plan.hasIncome && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{tr("Not counted:")} {round(plan.lent)} {tr("lent this month (it should come back).")}</div>
      )}
    </div>
  );
}
