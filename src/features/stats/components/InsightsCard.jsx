// ─── InsightsCard ─────────────────────────────────────────────────
// Plain-language observations from utils/insights.js. Tone → colour.
import { useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Info, ChevronDown, ChevronUp } from 'lucide-react';

const TONE = {
  good: { color: 'var(--income)',  bg: 'var(--income-bg)',  border: 'var(--income-border)',  Icon: TrendingDown },
  bad:  { color: 'var(--expense)', bg: 'var(--expense-bg)', border: 'var(--expense-border)', Icon: TrendingUp },
  info: { color: 'var(--accent)',  bg: 'var(--accent-bg)',  border: 'var(--accent-border)',  Icon: Info },
};

export default function InsightsCard({ insights = [], compact = false, initial = compact ? 3 : 5 }) {
  const [expanded, setExpanded] = useState(false);
  if (!insights.length) {
    return (
      <div className="card" style={{ padding: compact ? 14 : 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lightbulb size={17} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Insights appear after a few entries</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Trends, top categories, no-spend streaks and budget pace show up here.</div>
        </div>
      </div>
    );
  }
  const shown = expanded ? insights : insights.slice(0, initial);
  return (
    <div className="card">
      <div style={{ padding: compact ? '11px 14px' : '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lightbulb size={13} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Insights</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>this month</span>
      </div>
      {shown.map((ins, i) => {
        const t = TONE[ins.tone] ?? TONE.info;
        return (
          <div key={ins.id} style={{ display: 'flex', gap: 10, padding: compact ? '10px 14px' : '12px 16px', borderBottom: i < shown.length - 1 || insights.length > initial ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <t.Icon size={13} style={{ color: t.color }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{ins.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>{ins.detail}</div>
            </div>
          </div>
        );
      })}
      {insights.length > initial && (
        <button onClick={() => setExpanded((v) => !v)} style={{ width: '100%', padding: '8px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {expanded ? <><ChevronUp size={12} /> Show fewer</> : <><ChevronDown size={12} /> {insights.length - initial} more insight{insights.length - initial === 1 ? '' : 's'}</>}
        </button>
      )}
    </div>
  );
}
