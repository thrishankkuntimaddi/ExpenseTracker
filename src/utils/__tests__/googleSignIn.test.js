import { describe, it, expect } from 'vitest';
import { buildDesktopAuthUrl, parseLoopbackQuery, pkceChallenge } from '../../native/googleSignIn';

describe('desktop Google sign-in (PKCE + loopback)', () => {
  it('PKCE challenge matches the RFC 7636 example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
  it('builds an auth URL with PKCE and a placeholder for the loopback redirect', () => {
    const u = buildDesktopAuthUrl({ clientId: 'abc.apps.googleusercontent.com', challenge: 'CH', state: 'ST' });
    expect(u).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?redirect_uri=__REDIRECT_URI__&/);
    const q = new URLSearchParams(u.split('?')[1]);
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('scope')).toBe('openid email profile');
    expect(q.get('state')).toBe('ST');
  });
  it('reads the redirect: code, cancel, error, wrong state', () => {
    expect(parseLoopbackQuery('code=4%2F0Ab&state=ST&scope=email', 'ST')).toEqual({ code: '4/0Ab' });
    expect(parseLoopbackQuery('error=access_denied&state=ST', 'ST')).toEqual({ cancelled: true });
    expect(() => parseLoopbackQuery('error=invalid_client', 'ST')).toThrow(/invalid_client/);
    expect(() => parseLoopbackQuery('code=x&state=OTHER', 'ST')).toThrow(/state mismatch/);
  });
});
