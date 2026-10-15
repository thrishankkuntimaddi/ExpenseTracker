import { describe, it, expect } from 'vitest';
import { otaDecision, versionCode, pickPendingBundle } from '../../native/updates';

describe('over-the-air decision (Android)', () => {
  const m = { version: '3.3.1', build: 2000, minNativeBuild: 30300, url: 'https://x/bundle.zip', sha256: 'ab'.repeat(32) };
  it('downloads a newer bundle the installed app can run', () => {
    expect(otaDecision(m, { build: 1000, nativeBuild: 30300 })).toBe('download');
  });
  it('stays put when already on that build or newer', () => {
    expect(otaDecision(m, { build: 2000, nativeBuild: 30300 })).toBe('current');
    expect(otaDecision(m, { build: 3000, nativeBuild: 30300 })).toBe('current');
  });
  it('asks for the new app when the bundle needs newer native code', () => {
    expect(otaDecision(m, { build: 1000, nativeBuild: 30200 })).toBe('native-needed');
  });
  it('ignores a broken manifest', () => {
    expect(otaDecision(null, { build: 1 })).toBe('invalid');
    expect(otaDecision({ build: 5 }, { build: 1 })).toBe('invalid');
    expect(otaDecision({ ...m, sha256: undefined }, { build: 1, nativeBuild: 30300 })).toBe('invalid');   // never unverified
  });
  it('versionCode matches android/app/build.gradle', () => {
    expect(versionCode('3.2.0')).toBe(30200);
    expect(versionCode('3.10.4')).toBe(31004);
  });
});

describe('pickPendingBundle', () => {
  const b = (id, version, status = 'pending') => ({ id, version, status });
  it('picks the newest downloaded bundle newer than the running build', () => {
    const list = [b('a', '3.4.0-100'), b('c', '3.5.0-300'), b('bb', '3.5.0-200')];
    expect(pickPendingBundle(list, { build: 150 })?.id).toBe('c');
  });
  it('skips failed, older, equal and current bundles', () => {
    expect(pickPendingBundle([b('x', '3.5.0-300', 'error')], { build: 100 })).toBeNull();
    expect(pickPendingBundle([b('x', '3.4.0-100')], { build: 100 })).toBeNull();
    expect(pickPendingBundle([b('x', '3.5.0-300', 'success')], { build: 100, currentId: 'x' })).toBeNull();
    expect(pickPendingBundle([{ id: 'builtin', version: '3.4.0' }], { build: 0 })).toBeNull();
    expect(pickPendingBundle(undefined, { build: 1 })).toBeNull();
  });
});

describe('quick boot after a self-restart', async () => {
  const { markQuickBoot, takeQuickBoot } = await import('../../app/quickBoot');
  it('skips the intro once, only right after the app restarted itself', () => {
    const store = {};
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    expect(takeQuickBoot()).toBe(false);
    markQuickBoot();
    expect(takeQuickBoot()).toBe(true);
    expect(takeQuickBoot()).toBe(false);          // once
    markQuickBoot();
    expect(takeQuickBoot(Date.now() + 120000)).toBe(false);   // a restart long ago doesn't count
  });
});
