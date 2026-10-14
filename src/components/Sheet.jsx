// ─── Sheet ────────────────────────────────────────────────────────
// A small spreadsheet for fast entry (Trips, Billings, Debts):
//   • every cell is a plain input — click and type
//   • Enter moves to the next cell, then the next row; ↑/↓ move between rows
//   • there is always one empty row at the bottom: typing in it adds a row
//   • "pick" cells complete as you type ("ra" → Ravi, "g" → Got back);
//     a new name is accepted when the column allows it
//   • amount cells take sums: "120+80" becomes 200
//   • paste a block copied from Excel / Google Sheets and it fills rows
//   • × removes a row at once, with Undo
//
// Columns: { key, label, type: 'text' | 'amount' | 'pick' | 'date', width,
//   placeholder, options: [{ value, label }] (pick), onCreate(label) → value
//   (pick, optional: accept new values), align }
import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { evalAmount, parseDateText } from '../utils/sheetValues';

const matchOption = (options, text) => { const t = text.trim().toLowerCase(); return t ? options.find((o) => o.label.toLowerCase() === t) : null; };
const completeOption = (options, text) => { const t = text.toLowerCase(); return t ? options.find((o) => o.label.toLowerCase().startsWith(t)) : null; };

export default function Sheet({ id, columns, rows, onChange, makeRow, readOnly = false, tone = 'accent', footer, rowLabel = (r) => r.name ?? r.title ?? r.person ?? 'row' }) {
  const [ghost, setGhost] = useState(() => makeRow(rows));
  const [removed, setRemoved] = useState(null);   // { row, index } — for Undo
  const all = readOnly ? rows : [...rows, ghost];
  const template = `34px ${columns.map((c) => c.width ?? '1fr').join(' ')}${readOnly ? '' : ' 30px'}`;
  // Narrower than this and the sheet scrolls sideways inside its box (never the page)
  const minWidth = 34 + (readOnly ? 0 : 30) + columns.reduce((t, c) => t + (Number(String(c.width ?? '').match(/(\d+)px/)?.[1]) || 90), 0);
  const line = { gridTemplateColumns: template, minWidth };

  // Right away when the cell is on screen; a frame later for a row that is about to appear
  const focusCell = (r, c) => {
    const find = () => document.querySelector(`[data-sheet="${id}"][data-r="${r}"][data-c="${c}"]`);
    const go = (el) => { el.focus(); el.select?.(); };
    const el = find();
    if (el) go(el); else requestAnimationFrame(() => { const later = find(); if (later) go(later); });
  };

  function setCells(r, patch) {
    setRemoved(null);
    if (r >= rows.length) {   // the empty row: becomes a real row, and a new empty row appears
      const added = { ...ghost, ...patch };
      const next = [...rows, added];
      onChange(next);
      setGhost(makeRow(next));
    } else {
      onChange(rows.map((row, i) => (i === r ? { ...row, ...patch } : row)));
    }
  }

  function move(r, c, key) {
    if (key === 'next') return c + 1 < columns.length ? focusCell(r, c + 1) : focusCell(r + 1, 0);
    if (key === 'down' && r + 1 < all.length + (readOnly ? 0 : 1)) return focusCell(r + 1, c);
    if (key === 'up' && r > 0) return focusCell(r - 1, c);
  }

  function remove(r) {
    const row = rows[r];
    onChange(rows.filter((_, i) => i !== r));
    setRemoved({ row, index: r });
  }
  function undo() {
    if (!removed) return;
    const next = rows.slice(); next.splice(Math.min(removed.index, next.length), 0, removed.row);
    onChange(next); setRemoved(null);
  }

  /* Paste a block from a spreadsheet: tab-separated cells, one row per line */
  function paste(e, r, c) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[\t\n]/.test(text.trim())) return;   // a single value: normal paste
    e.preventDefault();
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
    const next = rows.slice();
    let g = ghost;
    lines.forEach((line, i) => {
      const at = r + i;
      const base = at < next.length ? next[at] : g;
      const patch = {};
      line.split('\t').forEach((raw, j) => {
        const col = columns[c + j]; if (!col) return;
        const v = raw.trim();
        if (col.type === 'amount') { const n = evalAmount(v); patch[col.key] = Number.isFinite(n) ? String(n) : ''; }
        else if (col.type === 'date') patch[col.key] = parseDateText(v) || base[col.key];
        else if (col.type === 'pick') { const m = matchOption(col.options ?? [], v); patch[col.key] = m ? m.value : v && col.onCreate ? col.onCreate(v) : base[col.key]; }
        else patch[col.key] = v;
      });
      if (at < next.length) next[at] = { ...next[at], ...patch };
      else { next.push({ ...g, ...patch }); g = makeRow(next); }
    });
    onChange(next); setGhost(g); setRemoved(null);
    focusCell(r + lines.length, c);
  }

  return (
    <div className={`sheet sheet-${tone}`} data-sheet-root={id}>
      <div className="sheet-head" style={line}>
        <span className="sheet-num">#</span>
        {columns.map((c) => <span key={c.key} style={{ textAlign: c.type === 'amount' ? 'right' : 'left' }}>{c.label}</span>)}
        {!readOnly && <span />}
      </div>
      {all.map((row, r) => {
        const isGhost = !readOnly && r === rows.length;
        return (
          <div key={row.id} className={`sheet-row${isGhost ? ' sheet-ghost' : ''}`} style={line}>
            <span className="sheet-num">{isGhost ? '+' : r + 1}</span>
            {columns.map((col, c) => {
              const cell = { 'data-sheet': id, 'data-r': r, 'data-c': c, className: 'sheet-cell', 'aria-label': `${col.label}, row ${r + 1}`, disabled: readOnly,
                onPaste: (e) => paste(e, r, c), placeholder: isGhost || !row[col.key] ? col.placeholder : undefined };
              const nav = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); move(r, c, 'next'); }
                else if (e.key === 'ArrowDown' && col.type !== 'date') { e.preventDefault(); e.currentTarget.blur(); move(r, c, 'down'); }
                else if (e.key === 'ArrowUp' && col.type !== 'date') { e.preventDefault(); e.currentTarget.blur(); move(r, c, 'up'); }
                else if (e.key === 'Escape') e.currentTarget.blur();
              };
              if (col.type === 'pick') return <PickCell key={col.key} cell={cell} col={col} value={row[col.key] ?? ''} onCommit={(v) => { if (v !== (row[col.key] ?? '')) setCells(r, { [col.key]: v }); }} onKeyDown={nav} />;
              if (col.type === 'amount') return <AmountCell key={col.key} cell={cell} value={row[col.key] ?? ''} onCommit={(v) => { if (v !== String(row[col.key] ?? '')) setCells(r, { [col.key]: v }); }} onKeyDown={nav} />;
              if (col.type === 'date') return <input key={col.key} {...cell} type="date" value={row[col.key] ?? ''} onChange={(e) => e.target.value && setCells(r, { [col.key]: e.target.value })} onKeyDown={nav} />;
              return <input key={col.key} {...cell} type="text" value={row[col.key] ?? ''} autoComplete="off" onChange={(e) => setCells(r, { [col.key]: e.target.value })} onKeyDown={nav} />;
            })}
            {!readOnly && (isGhost
              ? <span />
              : <button type="button" className="sheet-del" aria-label={`Remove row ${r + 1}`} tabIndex={-1} onClick={() => remove(r)}><X size={13} /></button>)}
          </div>
        );
      })}
      {(footer || removed) && (
        <div className="sheet-foot" style={{ minWidth }}>
          {removed
            ? <span>Removed “{rowLabel(removed.row) || `row ${removed.index + 1}`}” · <button type="button" className="sheet-undo" onClick={undo}>Undo</button></span>
            : <span />}
          {footer}
        </div>
      )}
    </div>
  );
}

/* Completes as you type; commits on Enter / leaving the cell */
function PickCell({ cell, col, value, onCommit, onKeyDown }) {
  const options = col.options ?? [];
  const label = options.find((o) => o.value === value)?.label ?? (typeof value === 'string' ? value : '');
  const [text, setText] = useState(null);   // null: not editing
  const editing = useRef(null);
  const input = useRef(null);
  const selectFrom = useRef(null);   // highlight the completed part right after React updates the input
  useLayoutEffect(() => {
    if (selectFrom.current != null && input.current) { input.current.setSelectionRange(selectFrom.current, input.current.value.length); selectFrom.current = null; }
  });
  const commit = () => {
    if (editing.current == null) return;
    const t = editing.current.trim();
    editing.current = null; setText(null);
    if (!t) return onCommit('');
    const m = matchOption(options, t);
    if (m) return onCommit(m.value);
    if (col.onCreate) return onCommit(col.onCreate(t));
    // not a choice and new values aren't allowed: keep what was there
  };
  return (
    <input {...cell} ref={input} type="text" autoComplete="off" value={text ?? label}
      onFocus={(e) => { editing.current = label; setText(label); e.target.select(); }}
      onChange={(e) => {
        const t = e.target.value;
        const deleting = e.nativeEvent?.inputType?.startsWith('delete');
        const m = !deleting && completeOption(options, t);
        if (m && m.label.length > t.length) {
          // Set it on the input right now too: when the completion is the same as last
          // keystroke's ("K" → Kiran, "Ki" → Kiran) React has nothing to re-render
          e.target.value = m.label; e.target.setSelectionRange(t.length, m.label.length);
          editing.current = m.label; setText(m.label); selectFrom.current = t.length;
        } else { editing.current = t; setText(t); }
      }}
      onPaste={(e) => { cell.onPaste(e); if (e.defaultPrevented) { editing.current = null; setText(null); } }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commit(); onKeyDown(e); }} />
  );
}

/* Numbers and sums; commits on Enter / leaving the cell */
function AmountCell({ cell, value, onCommit, onKeyDown }) {
  const [text, setText] = useState(null);
  const editing = useRef(null);
  const commit = () => {
    if (editing.current == null) return;
    const t = editing.current; editing.current = null; setText(null);
    if (!t.trim()) return onCommit('');
    const n = evalAmount(t);
    onCommit(Number.isFinite(n) && n >= 0 ? String(n) : String(value ?? ''));
  };
  return (
    <input {...cell} type="text" inputMode="decimal" autoComplete="off" value={text ?? String(value ?? '')} style={{ textAlign: 'right', fontWeight: 700 }}
      onFocus={(e) => { editing.current = String(value ?? ''); setText(String(value ?? '')); e.target.select(); }}
      onChange={(e) => { const t = e.target.value; if (/^[\d.,+\-*/\s₹]*$/.test(t)) { editing.current = t; setText(t); } }}
      onPaste={(e) => { cell.onPaste(e); if (e.defaultPrevented) { editing.current = null; setText(null); } }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commit(); onKeyDown(e); }} />
  );
}
