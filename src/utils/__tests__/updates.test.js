import { describe, it, expect } from 'vitest';
import { otaDecision, versionCode } from '../../native/updates';

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
