import { describe, it, expect, vi } from 'vitest';
vi.mock('../../services/firebase', () => ({ db: null }));
const { liveBanners, liveGate } = await import('../../services/liveConfig');

describe('live config — banners', () => {
  const cfg = { banners: [
    { id: 'a', text: 'For everyone' },
    { id: 'b', text: 'Android only', platforms: ['android'] },
    { id: 'c', text: 'Ended', until: 1000 },
    { id: 'd', text: 'Dismissed', dismissible: true },
    { id: 'e', text: 'Stays', dismissible: false },
    { id: 'f', text: '' },
  ] };
  it('shows what is for this app, not ended, not dismissed (unless it must stay)', () => {
    const ids = liveBanners(cfg, { platform: 'web', now: 5000, dismissed: ['d', 'e'] }).map((b) => b.id);
    expect(ids).toEqual(['a', 'e']);
    expect(liveBanners(cfg, { platform: 'android', now: 5000 }).map((b) => b.id)).toContain('b');
    expect(liveBanners(null)).toEqual([]);
  });
});

describe('live config — gate', () => {
  it('maintenance locks everyone but the owner, until it ends', () => {
    const cfg = { maintenance: { on: true, until: 10_000 } };
    expect(liveGate(cfg, { now: 5000 })).toBe('maintenance');
    expect(liveGate(cfg, { now: 5000, admin: true })).toBe(null);
    expect(liveGate(cfg, { now: 20_000 })).toBe(null);
  });
  it('an app older than the minimum version must update', () => {
    expect(liveGate({ minVersion: '4.6.0' }, { version: '4.5.4' })).toBe('update');
    expect(liveGate({ minVersion: '4.6.0' }, { version: '4.6.0' })).toBe(null);
    expect(liveGate({ minVersion: '4.6.0' }, { version: '4.10.0' })).toBe(null);
    expect(liveGate({ minVersion: '' }, { version: '1.0.0' })).toBe(null);
    expect(liveGate({ minVersion: '4.6.0' }, { version: 'web' })).toBe(null);   // dev builds have no number
  });
});
