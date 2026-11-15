// ─── SwipeRow: swipe actions on a list entry (phones) ────────────
//   swipe left a little  → Edit and Delete slide out (tap one)
//   swipe left all the way → Delete
//   swipe right           → Edit
// The row follows the finger and springs back; vertical scrolling is left
// alone (touch-action: pan-y), and the page-swipe navigation ignores it
// (data-no-swipe). Only one row is open at a time. Mouse / keyboard users
// keep the row's own buttons.
import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { t as tr } from '../i18n';

const ACTIONS_W = 136;      // two 68px buttons
const OPEN_AT = 48;         // past this, let go → actions stay open
const EDIT_AT = 76;         // swipe right past this → edit
const FULL_AT = 0.62;       // of the row's width → delete
let closeOpen = null;       // the row that's open now

export default function SwipeRow({ children, onEdit, onDelete, label = '' }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(320);
  const start = useRef(null);
  const root = useRef(null);
  const close = useRef(() => setX(0));

  useEffect(() => () => { if (closeOpen === close.current) closeOpen = null; }, []);

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const w = root.current?.offsetWidth || 320;
    setWidth(w);
    start.current = { x: t.clientX, y: t.clientY, base: x, axis: null, w };
  };
  const onTouchMove = (e) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (s.axis === 'x') { setDragging(true); if (closeOpen && closeOpen !== close.current) closeOpen(); }
    }
    if (s.axis !== 'x') return;
    // A little resistance past the actions and on the edit side
    let next = s.base + dx;
    if (next > 0) next = onEdit ? Math.min(next * 0.6, EDIT_AT + 30) : 0;
    setX(Math.max(next, -s.w));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== 'x') return;
    setDragging(false);
    if (x <= -s.w * FULL_AT) { setX(0); onDelete?.(); return; }
    if (x >= EDIT_AT * 0.6) { setX(0); onEdit?.(); return; }
    if (x < -OPEN_AT) { setX(-ACTIONS_W); closeOpen = close.current; return; }
    setX(0);
  };
  // A tap on an open row closes it instead of opening the entry
  const onClickCapture = (e) => {
    if (x !== 0 && !e.target.closest('.swipe-action')) { e.stopPropagation(); e.preventDefault(); setX(0); }
  };

  const deleting = x < 0 && x <= -(width * FULL_AT);
  return (
    <div ref={root} className="swipe-row" data-no-swipe onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} onClickCapture={onClickCapture}>
      {x > 0 && (
        <div className="swipe-under swipe-under-left" aria-hidden><Pencil size={17} /><span>{tr('Edit')}</span></div>
      )}
      {x < 0 && (
        <div className={`swipe-under swipe-under-right${deleting ? ' full' : ''}`} style={{ width: Math.max(-x, ACTIONS_W) }}>
          {!deleting && onEdit && (
            <button type="button" className="swipe-action swipe-edit" tabIndex={-1} aria-label={`${tr('Edit')} ${label}`} onClick={() => { setX(0); onEdit?.(); }}>
              <Pencil size={16} /><span>{tr('Edit')}</span>
            </button>
          )}
          <button type="button" className="swipe-action swipe-delete" tabIndex={-1} aria-label={`${tr('Delete')} ${label}`} onClick={() => { setX(0); onDelete?.(); }}>
            <Trash2 size={16} /><span>{tr('Delete')}</span>
          </button>
        </div>
      )}
      <div className="swipe-front" style={{ transform: x ? `translate3d(${x}px,0,0)` : undefined, transition: dragging ? 'none' : 'transform .28s cubic-bezier(0.16,1,0.3,1)' }}>
        {children}
      </div>
    </div>
  );
}
