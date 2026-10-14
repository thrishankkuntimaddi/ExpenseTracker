import { describe, it, expect } from 'vitest';
import { pinProblem, makePinRecord, checkPin, lockoutFor, waitLabel, shouldRelock, MAX_TRIES } from '../../security/pin';

describe('app lock PIN', () => {
  it('rejects weak or malformed PINs', () => {
    expect(pinProblem('12a4')).toMatch(/digits only/);
    expect(pinProblem('123')).toMatch(/4 to 6/);
    expect(pinProblem('1234567')).toMatch(/4 to 6/);
    expect(pinProblem('0000')).toMatch(/same digit/);
    expect(pinProblem('1234')).toMatch(/straight run/);
    expect(pinProblem('6543')).toMatch(/straight run/);
    expect(pinProblem('2580')).toBeNull();
    expect(pinProblem('190426')).toBeNull();
  });
  it('stores only a salted hash and checks against it', async () => {
    const rec = await makePinRecord('2580');
    expect(JSON.stringify(rec)).not.toContain('2580');
    expect(rec.length).toBe(4);
    expect(await checkPin('2580', rec)).toBe(true);
    expect(await checkPin('2581', rec)).toBe(false);
    expect(await checkPin('2580', null)).toBe(false);
    const again = await makePinRecord('2580');
    expect(again.pinHash).not.toBe(rec.pinHash);           // different salt
  });
  it('waits longer after each wrong PIN, then needs a fresh sign-in', () => {
    expect(lockoutFor(4)).toBe(0);
    expect(lockoutFor(5)).toBe(30e3);
    expect(lockoutFor(7)).toBe(300e3);
    expect(lockoutFor(9)).toBe(3600e3);
    expect(lockoutFor(MAX_TRIES)).toBe(Infinity);
    expect(waitLabel(30e3)).toBe('30 s');
    expect(waitLabel(300e3)).toBe('5 min');
    expect(waitLabel(Infinity)).toMatch(/sign in/);
  });
  it('relocks after the chosen time away', () => {
    const now = 1_000_000;
    expect(shouldRelock({ enabled: true, lockAfter: 60 }, now - 59e3, now)).toBe(false);
    expect(shouldRelock({ enabled: true, lockAfter: 60 }, now - 61e3, now)).toBe(true);
    expect(shouldRelock({ enabled: true, lockAfter: 0 }, now - 1, now)).toBe(true);
    expect(shouldRelock({ enabled: false, lockAfter: 0 }, now - 1e6, now)).toBe(false);
  });
});
