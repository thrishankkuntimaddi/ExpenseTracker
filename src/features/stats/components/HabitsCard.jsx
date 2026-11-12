// ─── Habits: streak, no-spend days, saving challenges ────────────
// settings.habits = { noSpendTarget?: number }   (days a month)
// A 52-week challenge is a Savings goal with challenge: { kind: '52week', base }.
import { useMemo, useState } from 'react';
import { Flame, CalendarCheck, Trophy, Plus } from 'lucide-react';
import { streak, noSpendDays, weekChallenge, newWeekChallenge } from '../../../utils/engagement';
import { computeGoalProgress, isGoalOpen } from '../../../utils/goals';
import { formatMoneyCompact } from '../../../utils/money';
import { generateId } from '../../../utils/storage';
import { monthName } from '../../../app/month';
import { useShell } from '../../../app/shellContext';

import { t as tr } from '../../../i18n';
const rupees = (n) => formatMoneyCompact(n);
const TARGETS = [4, 8, 12];
const BASES = [10, 50, 100];

export default function HabitsCard({ transactions, income, settings, onPatchSettings, monthKey, todayKey }) {
  const shell = useShell();
  const [picking, setPicking] = useState(false);
  const s = useMemo(() => streak(transactions, income, todayKey), [transactions, income, todayKey]);
  const ns = useMemo(() => noSpendDays(transactions, monthKey, todayKey), [transactions, monthKey, todayKey]);
  const target = Number(settings?.habits?.noSpendTarget) || null;
  const goals = settings?.goals ?? [];
  const challenges = goals.filter((g) => g.challenge?.kind === '52week' && isGoalOpen(g));
  const setTarget = (n) => onPatchSettings?.({ habits: { ...(settings?.habits ?? {}), noSpendTarget: n } });
  const startChallenge = (base) => {
    const g = newWeekChallenge(base, todayKey, generateId());
    onPatchSettings?.({ goals: [...goals, g] });
    setPicking(false);
    shell?.toast?.(`52-week challenge started · ${rupees(base)} this week`);
  };
  const [y, m] = monthKey.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const isNow = monthKey === todayKey.slice(0, 7);
  const nsSet = new Set(ns.days);

  return (
    <section id="stats-habits" className="card stats-card" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <h2 className="section-label" style={{ margin: '0 0 8px' }}>{tr("Habits")}</h2>

      {/* Streak */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 13, background: s.current ? 'var(--lent-bg)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Flame size={20} style={{ color: s.current ? 'var(--lent)' : 'var(--text-muted)' }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.current ? `${s.current}-day streak` : tr("No streak yet")}</div>
          <div style={{ fontSize: 12, color: s.atRisk ? 'var(--lent)' : 'var(--text-muted)', fontWeight: s.atRisk ? 650 : 400 }}>
            {s.atRisk ? tr("Log something today to keep it going") : s.current ? `Best ${s.best} days${s.next ? ` · ${s.next - s.current} to ${s.next}` : ''}` : tr("Log something every day — small ones count")}
          </div>
        </div>
      </div>
      {s.next && s.current > 0 && (
        <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', margin: '10px 0 0 52px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(s.current / s.next) * 100}%`, background: 'var(--lent)' }} />
        </div>
      )}

      {/* No-spend days */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--income-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarCheck size={19} style={{ color: 'var(--income)' }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {ns.count} {tr("no-spend day")}{ns.count === 1 ? '' : 's'}{target ? <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}> {tr("of")} {target}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {monthName(monthKey, { month: 'long' })}{ns.run >= 2 ? ` · ${ns.run} in a row now` : ''}{isNow && ns.todayClean ? ' · today so far too' : ''}
              {target && ns.count >= target ? ' · goal reached 🎉' : ''}
            </div>
          </div>
        </div>
        <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 3, margin: '10px 0 0 52px' }}>
          {Array.from({ length: dim }, (_, i) => {
            const k = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
            const future = i + 1 > ns.counted;
            return <span key={k} title={k} style={{ height: 8, borderRadius: 2, background: future ? 'var(--surface2)' : nsSet.has(k) ? 'var(--income)' : 'var(--border-dark)', opacity: future ? 0.6 : 1 }} />;
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '10px 0 0 52px', fontSize: 11.5, color: 'var(--text-muted)' }}>
          {tr("Goal a month:")}
          {TARGETS.map((n) => (
            <button key={n} id={`habit-target-${n}`} onClick={() => setTarget(target === n ? null : n)}
              style={{ padding: '3px 9px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${target === n ? 'var(--income)' : 'var(--border)'}`, background: target === n ? 'var(--income-bg)' : 'transparent', color: target === n ? 'var(--income)' : 'var(--text-secondary)' }}>
              {n} {tr("days")}
            </button>
          ))}
        </div>
      </div>

      {/* 52-week challenges */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        {challenges.map((g) => {
          const w = weekChallenge(g, todayKey);
          const p = computeGoalProgress(g, transactions);
          const behind = p.saved < w.dueSoFar;
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy size={18} style={{ color: 'var(--savings)' }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{tr("Week")} {w.week}{tr(": put")} <span style={{ color: 'var(--savings)' }}>{rupees(w.thisWeek)}</span> {tr("aside")}</div>
                <div style={{ fontSize: 12, color: behind ? 'var(--lent)' : 'var(--text-muted)' }}>
                  {rupees(p.saved)} {tr("of")} {rupees(w.target)} · {behind ? `${rupees(w.dueSoFar - p.saved)} behind` : 'on track'}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (p.saved / w.target) * 100)}%`, background: 'var(--savings)' }} />
                </div>
              </div>
              {shell && <button onClick={() => shell.goTo('savings')} style={{ padding: '6px 10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--savings)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>{tr("Add")}</button>}
            </div>
          );
        })}
        {!picking ? (
          <button id="habit-start-52" onClick={() => setPicking(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            <Plus size={14} /> {challenges.length ? tr("Another 52-week challenge") : tr("Start a 52-week saving challenge")}
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {tr("Save a little more each week — week 1 one step, week 52 fifty-two steps. Pick a step:")}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {BASES.map((b) => (
                <button key={b} id={`habit-52-${b}`} onClick={() => startChallenge(b)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--savings)', background: 'var(--savings-bg)', color: 'var(--savings)' }}>
                  {rupees(b)} → {rupees(b * 1378)} {tr("a year")}
                </button>
              ))}
              <button onClick={() => setPicking(false)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>{tr("Not now")}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
