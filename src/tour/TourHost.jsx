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

/* Bring the target to the middle of the box that scrolls it (the page), never
   by scrolling the window — in the Android app that shifts the whole screen. */
function centreInScroller(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
      const box = n.getBoundingClientRect(), r = el.getBoundingClientRect();
      const offset = r.top - box.top - (box.height - Math.min(r.height, box.height)) / 2;
      if (Math.abs(offset) > 4) n.scrollTop += offset;
      return;
    }
  }
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
  const [quiet, setQuiet] = useState(!!(step.target && step.optional));
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  useEscape(endTour);

  // Open the step's page, then find its target. A page that has to open loads
  // lazily (allow ~2.5 s); on the page already showing, a missing target is
  // known at once — an optional step is skipped without a blank pause.
  useEffect(() => {
    const opening = !!(step.page && shell && shell.active !== step.page);
    if (opening) shell.goTo(step.page);
    if (!step.target) return undefined;
    let tries = 0, follow = 0, frame = 0;
    const unquiet = setTimeout(() => setQuiet(false), 300);
    const maxTries = opening ? 30 : 3;
    const timer = setInterval(() => {
      const el = findTarget(step.target);
      if (!el && ++tries <= maxTries) return;
      clearInterval(timer);
      if (!el && step.optional) { stepTour(tour.dir < 0 ? -1 : 1); return; }
      setQuiet(false);
      targetRef.current = el;
      if (el) centreInScroller(el);
      // Pages slide in and scrolling settles: keep the light on the target for a moment
      const started = performance.now();
      const track = () => {
        if (targetRef.current?.isConnected) setRect(targetRef.current.getBoundingClientRect());
        if (performance.now() - started < 900) frame = requestAnimationFrame(track);
      };
      follow = setTimeout(() => { setReady(true); track(); }, el ? 60 : 0);
    }, 80);
    return () => { clearInterval(timer); clearTimeout(follow); clearTimeout(unquiet); cancelAnimationFrame(frame); };
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

  // An optional step stays quiet for a moment (it may be skipped); after that
  // the card always shows — centred while a page is still opening
  if (quiet) return <Portal><div className="tour-block" /><div className="tour-dim" /></Portal>;
  const spot = ready ? rect : null;

  const vw = window.innerWidth, vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  const last = tour.i === tour.steps.length - 1;
  const text = typeof step.text === 'function' ? step.text({ desktop: !!shell?.desktop }) : step.text;

  // Card: under the target if it fits, else above, else pinned to the bottom
  let pos;
  if (!spot) {
    pos = { left: (vw - cardW) / 2, top: Math.max(16, (vh - cardH) / 2) };
  } else {
    const left = Math.min(Math.max(16, spot.left + spot.width / 2 - cardW / 2), vw - cardW - 16);
    const below = spot.bottom + PAD + 12;
    const above = spot.top - PAD - 12 - cardH;
    if (below + cardH <= vh - 16) pos = { left, top: below };
    else if (above >= 16) pos = { left, top: above };
    else pos = { left: (vw - cardW) / 2, top: Math.max(16, vh - cardH - 24) };
  }

  return (
    <Portal>
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {spot
        ? <div className="tour-spot" style={{ left: spot.left - PAD, top: spot.top - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 }} />
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
