// ─── B · Rolling numbers ─────────────────────────────────────────
// A money figure that, when it changes, rolls each digit to its new value
// like a car's odometer (rightmost digit first). On first render — and
// whenever animations are off — it is plain text.
import { useLayoutEffect, useRef, useState } from 'react';
import { formatAmount } from '../utils/dateHelpers';
import { motionOn } from './motion';
import { play } from '../sound/sound';

const DIGITS = '0123456789';

export default function RollingNumber({ value, format = formatAmount, className, style, id, sound = false }) {
  const text = format(value);
  const shown = useRef(text);
  const [roll, setRoll] = useState(null);   // { from, to, key }
  const box = useRef(null);

  // A new value: roll from what was on screen
  useLayoutEffect(() => {
    if (shown.current === text) return;
    const from = shown.current;
    shown.current = text;
    if (motionOn()) {
      setRoll({ from, to: text, key: Date.now() });
      // cash rolling, as long as the digits roll (the headline totals only)
      if (sound) play('roll', { ms: 700 + Math.min(9, from.length) * 55 });
    } else setRoll(null);
  }, [text, sound]);

  useLayoutEffect(() => {
    if (!roll || !box.current) return undefined;
    const cols = [...box.current.querySelectorAll('.roll-col')];
    const runs = cols.map((col, i) => {
      const from = Number(col.dataset.from), to = Number(col.dataset.to);
      const order = cols.length - 1 - i;   // the last digit moves first
      return col.animate([{ transform: `translateY(${-from}em)` }, { transform: `translateY(${-to}em)` }],
        { duration: 700 + Math.abs(to - from) * 45, delay: order * 55, easing: 'cubic-bezier(.15,.85,.25,1)', fill: 'forwards' });
    });
    let done = false;
    Promise.all(runs.map((a) => a.finished)).then(() => { if (!done) setRoll(null); }, () => {});
    return () => { done = true; runs.forEach((a) => a.cancel()); };
  }, [roll]);

  if (!roll) return <span id={id} className={className} style={style}>{text}</span>;

  // Line the two strings up from the right so units sit over units
  const n = Math.max(roll.from.length, roll.to.length);
  const from = roll.from.padStart(n, ' '), to = roll.to.padStart(n, ' ');
  return (
    <span id={id} ref={box} className={`roll${className ? ` ${className}` : ''}`} style={style} aria-label={roll.to}>
      {[...to].map((ch, i) => {
        if (!DIGITS.includes(ch)) return ch === ' ' ? null : <span key={i} className="roll-ch" aria-hidden="true">{ch}</span>;
        const f = DIGITS.includes(from[i]) ? Number(from[i]) : 0;
        return (
          <span key={i} className="roll-win" aria-hidden="true">
            <span className="roll-col" data-from={f} data-to={ch} style={{ transform: `translateY(${-f}em)` }}>
              {[...DIGITS].map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
