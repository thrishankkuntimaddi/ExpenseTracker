// ─── D · Self-drawing signs ──────────────────────────────────────
// Small icons that draw themselves and act out what happened:
//   check   a tick draws inside a circle        (saved, settled)
//   wallet  a coin drops into an opening wallet (money in)
//   plane   a plane takes off along its route   (trips)
//   piggy   a coin drops into the piggy bank    (savings)
//   warn    a warning sign draws, then shakes   (over budget)
// They play once when they appear (change `key` to replay). With
// animations off they appear already drawn. Usable as a lucide-style
// Icon: <Sign kind="piggy" size={21} style={{ color }} />.
import { useMotion } from './motion';

const COLORS = { check: 'var(--income)', wallet: 'var(--income)', plane: 'var(--repayment-rec, #22d3ee)', piggy: 'var(--savings)', warn: 'var(--expense)' };

export default function Sign({ kind = 'check', size = 20, style, className, title }) {
  const on = useMotion();
  const color = style?.color ?? COLORS[kind];
  const common = { width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3.4, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: `sign sign-${kind}${on ? ' sign-play' : ''}${className ? ` ${className}` : ''}`, style: { ...style, color, overflow: 'visible' },
    role: title ? 'img' : undefined, 'aria-label': title, 'aria-hidden': title ? undefined : true };
  switch (kind) {
    case 'wallet':
      return (
        <svg {...common}>
          <rect className="s-draw" pathLength="1" x="6" y="15" width="36" height="25" rx="6" />
          <path className="s-draw s-d2 s-flap" pathLength="1" d="M6 21 V13 Q6 9 10 9 H36" />
          <circle className="s-drop" cx="33" cy="27.5" r="4.2" fill="#f6c453" stroke="none" />
        </svg>
      );
    case 'plane':
      return (
        <svg {...common} strokeWidth={2.6}>
          <path className="s-route" d="M4 42 Q18 44 26 29 T44 6" strokeDasharray="2.5 4" />
          <g className="s-fly"><path d="M-1 -2.5 L10 0 L-1 2.5 L1.5 0 Z M1 0 L-5 -6.5 L-2.5 -6.5 L5 -1 Z M1 0 L-5 6.5 L-2.5 6.5 L5 1 Z" fill="currentColor" stroke="none" /></g>
        </svg>
      );
    case 'piggy':
      return (
        <svg {...common} strokeWidth={3}>
          <g className="s-bounce">
            <ellipse className="s-draw" pathLength="1" cx="24" cy="29" rx="15" ry="11.5" />
            <path className="s-draw s-d2" pathLength="1" d="M18 39 V43 M30 39 V43 M38 27 Q43 27 42 32" />
            <path d="M20.5 18.5 H27.5" stroke="#f6c453" strokeWidth={3.2} />
            <circle cx="18" cy="27" r="1.4" fill="currentColor" stroke="none" />
          </g>
          <circle className="s-coin" cx="24" cy="4" r="4" fill="#f6c453" stroke="none" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...common}>
          <g className="s-shake">
            <path className="s-draw" pathLength="1" d="M24 6 L43 39 H5 Z" />
            <path className="s-draw s-d2" pathLength="1" d="M24 18 V28" strokeWidth={4} />
            <circle className="s-pop" cx="24" cy="33.5" r="1.9" fill="currentColor" stroke="none" />
          </g>
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle className="s-draw" pathLength="1" cx="24" cy="24" r="18" />
          <path className="s-draw s-d2" pathLength="1" d="M16 24.5 L22 30.5 L33 18.5" strokeWidth={4} />
        </svg>
      );
  }
}
