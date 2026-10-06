import { describe, it, expect } from 'vitest';
import { cleanEnvValue } from '../../services/firebaseConfig';

describe('cleanEnvValue', () => {
  it('strips carriage returns, quotes and a pasted NAME= prefix', () => {
    expect(cleanEnvValue('abc\r', 'K')).toBe('abc');
    expect(cleanEnvValue('  "abc"\n', 'K')).toBe('abc');
    expect(cleanEnvValue('VITE_FIREBASE_API_KEY=AIzaXYZ\r', 'VITE_FIREBASE_API_KEY')).toBe('AIzaXYZ');
    expect(cleanEnvValue("'nistha'", 'K')).toBe('nistha');
    expect(cleanEnvValue(undefined, 'K')).toBe('');
  });
});
