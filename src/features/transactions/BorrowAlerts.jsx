// ─── Home: borrowed money that looks unused ──────────────────────
// One card per borrowing the app is asking about (utils/borrowed.js):
// pay some back, say what it's for, or keep it on purpose.
import { useState } from 'react';
import { AlertCircle, Undo2, PenLine, Check } from 'lucide-react';
import { formatAmount } from '../../utils/dateHelpers';

import { t as tr } from '../../i18n';
const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function BorrowAlerts({ alerts = [], onPatch, onPayBack }) {
  const [noting, setNoting] = useState(null);   // alert id
  const [text, setText] = useState('');
  if (!alerts.length) return null;

  function saveNote(a) {
    if (!text.trim()) return;
    onPatch(a, { note: text.trim() });
    setNoting(null); setText('');
  }

  return (
    <div className="home-borrow" id="home-borrow" style={{ marginBottom: 14 }}>
      <p className="section-label" style={{ margin: '4px 4px 8px' }}>{tr("Borrowed money")}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.slice(0, 3).map((a) => (
          <div key={a.id} className="card borrow-alert" id={`borrow-alert-${a.id}`} style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--borrowed-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={16} style={{ color: 'var(--borrowed)' }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {a.kind === 'unused' ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>
                      {formatAmount(a.outstanding)} {tr("from")} {a.name} {tr("looks unused")}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                      {tr("Borrowed")} {fmt(a.day)} ({a.days} {tr("day")}{a.days === 1 ? '' : 's'} {tr("ago)")}{a.entry.note ? ` for ${a.entry.note}` : ''}{tr(". Since then only")} {formatAmount(a.spentSince)} {tr("has gone out. Pay some back, or note what it’s for.")}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>
                      {tr("What was the")} {formatAmount(a.amount)} {tr("from")} {a.name} {tr("for?")}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                      {tr("Borrowed")} {fmt(a.day)}{tr(", paid back")} {fmt(a.repaidDay)} {tr("— but only")} {formatAmount(a.spentSince)} {tr("went out in between. If you spent it, add that expense so your month adds up.")}
                    </div>
                  </>
                )}
              </div>
            </div>

            {noting === a.id ? (
              <form onSubmit={(e) => { e.preventDefault(); saveNote(a); }} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Bike repair, rent advance…")} aria-label={tr("What it was for")}
                  style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: 13, border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', borderRadius: 10, fontFamily: 'inherit' }} />
                <button type="submit" disabled={!text.trim()} style={{ ...btn, background: 'var(--borrowed)', color: '#fff', border: 'none', flex: '0 0 auto' }}><Check size={13} /> {tr("Save")}</button>
              </form>
            ) : (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {a.kind === 'unused' && <button id={`borrow-payback-${a.id}`} onClick={() => onPayBack(a)} style={{ ...btn, background: 'var(--borrowed)', color: '#fff', border: 'none' }}><Undo2 size={13} /> {tr("Pay back")}</button>}
                <button id={`borrow-note-${a.id}`} onClick={() => { setNoting(a.id); setText(a.entry.note ?? ''); }} style={btn}><PenLine size={13} /> {a.kind === 'unused' ? tr("It’s for…") : tr("It was for…")}</button>
                <button id={`borrow-keep-${a.id}`} onClick={() => onPatch(a, { borrowAck: true })} style={btn}>{a.kind === 'unused' ? tr("Keeping it") : tr("Never mind")}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = { flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap' };
