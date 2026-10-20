// ─── TourHost ────────────────────────────────────────────────────
// Draws the running tour: the screen dims, the step's target is lit, and a
// card explains it — Back · Next (Enter / →) · Skip (Esc). Steps that open
// another page do so first, then wait for the target to appear.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Portal from '../components/Portal';
import { useShell } from '../app/shellContext';
import { useEscape } from '../hooks/useEscape';
import { useTour, stepTour, endTour } from './tour';

const PAD = 6;

function findTarget(selectors) {
  for (const sel of selectors ?? []) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;      // the first one actually on screen
    }
  }
  return null;
}

export default function TourHost() {
  const tour = useTour();
  if (!tour) return null;
  return <TourStep key={`${tour.name}-${tour.i}`} tour={tour} />;
}

function TourStep({ tour }) {
  const shell = useShell();
  const step = tour.steps[tour.i];
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(!step.target);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  useEscape(endTour);

  // Open the step's page, then find its target (pages load lazily: ~2 s)
  useEffect(() => {
    if (step.page && shell && shell.active !== step.page) shell.goTo(step.page);
    if (!step.target) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      const el = findTarget(step.target);
      if (el || ++tries > 30) {
        clearInterval(timer);
        if (!el && step.optional) { stepTour(tour.dir < 0 ? -1 : 1); return; }
        targetRef.current = el;
        el?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
        setTimeout(() => { setRect(el ? el.getBoundingClientRect() : null); setReady(true); }, el ? 260 : 0);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the target when the window resizes or the page scrolls
  useEffect(() => {
    const measure = () => { if (targetRef.current?.isConnected) setRect(targetRef.current.getBoundingClientRect()); };
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, []);

  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [ready, rect]);

  // Keyboard: → / Enter next, ← back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); stepTour(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepTour(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return <Portal><div className="tour-block" /><div className="tour-dim" /></Portal>;

  const vw = window.innerWidth, vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  const last = tour.i === tour.steps.length - 1;
  const text = typeof step.text === 'function' ? step.text({ desktop: !!shell?.desktop }) : step.text;

  // Card: under the target if it fits, else above, else pinned to the bottom
  let pos;
  if (!rect) {
    pos = { left: (vw - cardW) / 2, top: Math.max(16, (vh - cardH) / 2) };
  } else {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16);
    const below = rect.bottom + PAD + 12;
    const above = rect.top - PAD - 12 - cardH;
    if (below + cardH <= vh - 16) pos = { left, top: below };
    else if (above >= 16) pos = { left, top: above };
    else pos = { left: (vw - cardW) / 2, top: Math.max(16, vh - cardH - 24) };
  }

  return (
    <Portal>
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {rect
        ? <div className="tour-spot" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
        : <div className="tour-dim" />}
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" className="tour-card" style={{ width: cardW, ...pos }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div className="tour-dots" aria-label={`Step ${tour.i + 1} of ${tour.steps.length}`}>
            {tour.steps.map((_, j) => <span key={j} className={j === tour.i ? 'on' : j < tour.i ? 'done' : ''} />)}
          </div>
          <button id="tour-close" onClick={endTour} aria-label="Close the tour" className="tour-x"><X size={14} /></button>
        </div>
        <h2 id="tour-title" className="tour-title">{step.title}</h2>
        <p className="tour-text">{text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          {!last && <button id="tour-skip" onClick={endTour} className="tour-link">Skip</button>}
          <span style={{ flex: 1 }} />
          {tour.i > 0 && <button id="tour-back" onClick={() => stepTour(-1)} className="tour-btn tour-btn-ghost">Back</button>}
          <button id="tour-next" onClick={() => stepTour(1)} className="tour-btn" autoFocus>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </Portal>
  );
}
