import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import RollingNumber from '../RollingNumber';
import Sign from '../Sign';
import LiquidGauge from '../LiquidGauge';
import { motionOn } from '../motion';

describe('motion', () => {
  it('is off without a browser (server, tests)', () => {
    expect(motionOn()).toBe(false);
  });
  it('a rolling number first renders as plain text', () => {
    const html = renderToString(<RollingNumber value={4813.31} id="n" />);
    expect(html).toContain('₹4,813.31');
    expect(html).not.toContain('roll-col');
  });
  it('signs render every kind, drawn (still) when animations are off', () => {
    for (const kind of ['check', 'wallet', 'plane', 'piggy', 'warn']) {
      const html = renderToString(<Sign kind={kind} size={20} />);
      expect(html, kind).toContain(`sign-${kind}`);
      expect(html, kind).not.toContain('sign-play');
    }
  });
  it('the liquid gauge says how full it is', () => {
    expect(renderToString(<LiquidGauge fraction={0.68} />)).toContain('68% of budget used');
  });
});
