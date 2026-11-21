import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unslopOn, setUnslop, applyUnslop, barColor, UNSLOP_KEY, getLook, setLook, setGlassColour, glassColourOn, GLASS_COLOUR_KEY } from '../unslop';

// A tiny stand-in for the browser bits unslop.js touches (no DOM in these tests)
function fakeBrowser() {
  const store = new Map();
  const attrs = new Map([['data-theme', 'light']]);
  const meta = { content: '#EEF0F6', setAttribute(k, v) { if (k === 'content') this.content = v; } };
  const events = [];
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.document = {
    documentElement: {
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      hasAttribute: (k) => attrs.has(k),
      classList: { add() {}, remove() {} },
    },
    querySelector: () => meta,
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild() {} },
    body: { style: {} },
  };
  globalThis.window = { dispatchEvent: (e) => events.push(e.type), addEventListener() {}, removeEventListener() {} };
  return { store, attrs, meta, events };
}

describe('Unslop look', () => {
  let b;
  beforeEach(() => { b = fakeBrowser(); });
  afterEach(() => { delete globalThis.localStorage; delete globalThis.document; delete globalThis.window; });

  it('is off by default — the Liquid Glass UI stays as shipped', () => {
    expect(unslopOn()).toBe(false);
    applyUnslop();
    expect(b.attrs.has('data-unslop')).toBe(false);
    expect(b.meta.content).toBe('#EEF0F6');
  });

  it('switching on marks <html>, remembers it per device and recolours the bars', () => {
    setUnslop(true);
    expect(b.store.get(UNSLOP_KEY)).toBe('on');
    expect(b.attrs.get('data-unslop')).toBe('on');
    expect(b.meta.content).toBe('#F7F5F0');
    expect(b.events).toContain('et-unslop');
    expect(unslopOn()).toBe(true);
  });

  it('switching off removes every trace', () => {
    setUnslop(true);
    setUnslop(false);
    expect(b.store.has(UNSLOP_KEY)).toBe(false);
    expect(b.attrs.has('data-unslop')).toBe(false);
    expect(b.meta.content).toBe('#EEF0F6');
  });

  it('Unsloped builds on Unslop: both attributes, its own bar colour', () => {
    setLook('unsloped');
    expect(getLook()).toBe('unsloped');
    expect(unslopOn()).toBe(true);                         // unslop.css stays on underneath
    expect(b.attrs.get('data-unslop')).toBe('on');
    expect(b.attrs.has('data-unsloped')).toBe(true);
    expect(b.store.get(UNSLOP_KEY)).toBe('unsloped');
    expect(b.meta.content).toBe('#F2ECE0');
  });

  it('moving between the three looks leaves nothing behind', () => {
    setLook('unsloped');
    setLook('unslop');
    expect(b.attrs.has('data-unsloped')).toBe(false);
    expect(b.attrs.get('data-unslop')).toBe('on');
    setLook('glass');
    expect(b.attrs.has('data-unslop')).toBe(false);
    expect(b.attrs.has('data-unsloped')).toBe(false);
    expect(b.store.has(UNSLOP_KEY)).toBe(false);
    expect(getLook()).toBe('glass');
  });

  it('Glass background colour off: pure white / black bars, glass-plain attribute', () => {
    setGlassColour(false);
    expect(glassColourOn()).toBe(false);
    expect(b.store.get(GLASS_COLOUR_KEY)).toBe('off');
    expect(b.attrs.has('data-glass-plain')).toBe(true);
    expect(b.meta.content).toBe('#FFFFFF');
    expect(barColor('monoflow', 'glass', false)).toBe('#000000');
    // the notebook looks keep their own canvas whatever this says
    expect(barColor('light', 'unslop', false)).toBe('#F7F5F0');
    setGlassColour(true);
    expect(b.attrs.has('data-glass-plain')).toBe(false);
    expect(b.meta.content).toBe('#EEF0F6');
  });

  it('an unknown saved value falls back to Glass', () => {
    b.store.set(UNSLOP_KEY, 'something-else');
    expect(getLook()).toBe('glass');
    expect(unslopOn()).toBe(false);
  });

  it('bar colours follow look and theme', () => {
    expect(barColor('light', 'unsloped')).toBe('#F2ECE0');
    expect(barColor('monoflow', 'unsloped')).toBe('#13110E');
    expect(barColor('light', false)).toBe('#EEF0F6');
    expect(barColor('monoflow', false)).toBe('#06070B');
    expect(barColor('light', true)).toBe('#F7F5F0');
    expect(barColor('monoflow', true)).toBe('#161513');
  });
});
