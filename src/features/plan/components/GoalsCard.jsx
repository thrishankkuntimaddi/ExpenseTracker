// ─── GoalsCard ────────────────────────────────────────────────────
// Savings goals: how far along, where the money is kept, this month's
// share. Each goal can take money (a savings entry for it), move to another
// holder ("Pritam → Muzammil → cash"), end as used before reaching it, or —
// once reached — be collected. Finished goals stay listed for the record.
import { useState } from 'react';
import { Flag, Plus, Pencil, Trophy, AlertTriangle, ArrowRightLeft, CheckCircle2, RotateCcw, ChevronDown } from 'lucide-react';
import { formatAmount } from '../../../utils/dateHelpers';
import { computeGoalProgress, isGoalOpen, moveGoal, endGoal, reopenGoal, GOAL_STATUS } from '../../../utils/goals';
import { toKey } from '../../../utils/recurring';
import { formatMoneyCompact } from '../../../utils/money';

const monthLabel = (key) => new Date(key).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export default function GoalsCard({ goals = [], transactions = [], onAdd, onEdit, onUpdate, onContribute, compact = false }) {
  const [showDone, setShowDone] = useState(false);
  const open = goals.filter(isGoalOpen);
  const done = goals.filter((g) => !isGoalOpen(g));

  if (!goals.length) {
    return (
      <div className="card" style={{ padding: compact ? 14 : 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--savings-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Flag size={17} style={{ color: 'var(--savings)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>No goals yet</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.5 }}>{formatMoneyCompact(100000)} by April? Put a share aside each month — with a friend, in cash or a bank — and see where it stands.</div>
        </div>
        {onAdd && (
          <button id="goal-add-empty" onClick={onAdd} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, background: 'var(--savings)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Goal
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="goals">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 4px 8px' }}>
        <span className="section-label" style={{ margin: 0 }}>Goals · {open.length}</span>
        {onAdd && <button id="goal-add" onClick={onAdd} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Plus size={13} /> New goal</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {open.map((g) => <GoalItem key={g.id} goal={g} transactions={transactions} onEdit={onEdit} onUpdate={onUpdate} onContribute={onContribute} />)}
        {!open.length && <div className="card" style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>No goals in progress.</div>}
      </div>

      {done.length > 0 && (
        <>
          <button id="goals-finished-toggle" onClick={() => setShowDone((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 4px 8px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span className="section-label" style={{ margin: 0 }}>Finished · {done.length}</span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {showDone && (
            <div className="card">
              {done.map((g, i) => {
                const p = computeGoalProgress(g, transactions);
                return (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {GOAL_STATUS[g.status]?.label}{g.endedOn ? ` · ${new Date(g.endedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''} · {formatAmount(p.saved)} of {formatAmount(p.target)}{g.endNote ? ` · ${g.endNote}` : ''}
                      </div>
                    </div>
                    {onUpdate && <button aria-label={`Reopen ${g.name}`} title="Reopen" onClick={() => onUpdate(reopenGoal(g))} style={iconBtn}><RotateCcw size={13} /></button>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const iconBtn = { width: 30, height: 30, border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const actBtn = { flex: 1, padding: '8px 6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap' };

function GoalItem({ goal: g, transactions, onEdit, onUpdate, onContribute }) {
  const [mode, setMode] = useState(null);   // null | 'move' | 'used'
  const [text, setText] = useState('');
  const p = computeGoalProgress(g, transactions);
  const today = toKey(new Date());
  const color = p.done ? 'var(--income)' : p.overdue ? 'var(--expense)' : 'var(--savings)';
  const lastMove = g.moves?.[g.moves.length - 1];

  function confirm() {
    if (mode === 'move') { const next = moveGoal(g, text, today); if (next !== g) onUpdate?.(next); }
    if (mode === 'used') onUpdate?.(endGoal(g, 'used', today, text || 'Used before reaching it'));
    setMode(null); setText('');
  }

  return (
    <div className="card goal-item" id={`goal-${g.id}`} style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {g.heldWith ? <>Kept with <strong style={{ color: 'var(--text-secondary)' }}>{g.heldWith}</strong></> : 'Where it’s kept: not set'}
            {lastMove ? ` · was with ${lastMove.from || '—'} until ${new Date(lastMove.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color }}>{Math.round(p.pct)}%</span>
        {onEdit && <button aria-label={`Edit ${g.name}`} onClick={() => onEdit(g)} style={iconBtn}><Pencil size={12} /></button>}
      </div>

      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
        <div style={{ height: '100%', width: `${p.pct}%`, background: color, borderRadius: 99, transition: 'width .5s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--text)' }}>{formatAmount(p.saved)}</strong> of {formatAmount(p.target)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {p.done ? <><Trophy size={12} style={{ color: 'var(--income)' }} /> Reached</>
            : p.overdue ? <><AlertTriangle size={11} style={{ color: 'var(--expense)' }} /> Past {monthLabel(g.deadline)} · {formatAmount(p.remaining)} short</>
            : g.deadline ? `by ${monthLabel(g.deadline)}${p.onTrack === false ? ' · behind' : p.onTrack ? ' · on track' : ''}`
            : `${formatAmount(p.remaining)} to go`}
        </span>
      </div>

      {Number(g.monthly) > 0 && !p.done && (
        <div style={{ marginTop: 8, padding: '8px 10px', fontSize: 12, background: p.monthlyDue > 0 ? 'var(--savings-bg)' : 'var(--income-bg)', color: p.monthlyDue > 0 ? 'var(--savings)' : 'var(--income)', fontWeight: 650, borderRadius: 10 }}>
          {p.monthlyDue > 0 ? `${formatAmount(p.monthlyDue)} still to put aside this month (plan ${formatAmount(g.monthly)}/month)` : `This month’s ${formatAmount(g.monthly)} is in ✓`}
        </div>
      )}

      {p.done ? (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--income-bg)', borderRadius: 12 }}>
          <CheckCircle2 size={18} style={{ color: 'var(--income)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>Goal reached — collect {formatAmount(p.saved)}{g.heldWith ? ` from ${g.heldWith}` : ''} when you need it.</span>
          {onUpdate && <button id={`goal-collect-${g.id}`} onClick={() => onUpdate(endGoal(g, 'collected', today))} style={{ padding: '7px 12px', border: 'none', background: 'var(--income)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Collected</button>}
        </div>
      ) : mode ? (
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setMode(null); }}
            placeholder={mode === 'move' ? 'Now kept with — a person, cash, a bank…' : 'What was it used for? (optional)'}
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={confirm} disabled={mode === 'move' && !text.trim()} style={{ padding: '0 12px', border: 'none', background: mode === 'used' ? 'var(--expense)' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{mode === 'move' ? 'Move' : 'End goal'}</button>
          <button onClick={() => setMode(null)} style={{ padding: '0 10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
        </div>
      ) : (onContribute || onUpdate) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {onContribute && <button id={`goal-contribute-${g.id}`} onClick={() => onContribute(g)} style={{ ...actBtn, border: 'none', background: 'var(--savings)', color: '#fff' }}><Plus size={13} /> Add money</button>}
          {onUpdate && <button id={`goal-move-${g.id}`} onClick={() => { setMode('move'); setText(''); }} style={actBtn}><ArrowRightLeft size={12} /> Moved it</button>}
          {onUpdate && <button id={`goal-used-${g.id}`} onClick={() => { setMode('used'); setText(''); }} style={actBtn}>Used it</button>}
        </div>
      )}
    </div>
  );
}
