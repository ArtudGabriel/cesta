import {
  isAllowedOrigin,
  parseCorsWhitelist,
  VERCEL_PREVIEW_REGEX,
} from './cors-origin';

describe('isAllowedOrigin', () => {
  const whitelist = [
    'https://cesta-web.vercel.app',
    'http://localhost:3000',
  ];

  it('allows origin in the whitelist (production URL)', () => {
    expect(isAllowedOrigin('https://cesta-web.vercel.app', whitelist)).toBe(true);
  });

  it('allows localhost dev origin', () => {
    expect(isAllowedOrigin('http://localhost:3000', whitelist)).toBe(true);
  });

  it('allows Vercel preview URLs for the Cesta project', () => {
    expect(
      isAllowedOrigin(
        'https://cesta-web-git-feat-sprint-73-gabriels-projects-f5aa3b24.vercel.app',
        whitelist,
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        'https://cesta-web-git-main-gabriels-projects-f5aa3b24.vercel.app',
        whitelist,
      ),
    ).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isAllowedOrigin('https://evil.example.com', whitelist)).toBe(false);
  });

  it('rejects a Vercel preview URL under a different team', () => {
    expect(
      isAllowedOrigin(
        'https://cesta-web-git-x-attacker-team.vercel.app',
        whitelist,
      ),
    ).toBe(false);
  });

  it('allows undefined origin (server-to-server / curl)', () => {
    expect(isAllowedOrigin(undefined, whitelist)).toBe(true);
  });

  it('regex only matches the exact preview shape', () => {
    expect(
      VERCEL_PREVIEW_REGEX.test(
        'https://cesta-web-git-abc-gabriels-projects-f5aa3b24.vercel.app',
      ),
    ).toBe(true);
    expect(
      VERCEL_PREVIEW_REGEX.test(
        'https://cesta-web-git-abc-gabriels-projects-f5aa3b24.vercel.app.evil.com',
      ),
    ).toBe(false);
    expect(
      VERCEL_PREVIEW_REGEX.test(
        'http://cesta-web-git-abc-gabriels-projects-f5aa3b24.vercel.app',
      ),
    ).toBe(false);
  });
});

describe('parseCorsWhitelist', () => {
  it('returns [] for empty / undefined env var', () => {
    expect(parseCorsWhitelist(undefined)).toEqual([]);
    expect(parseCorsWhitelist('')).toEqual([]);
  });

  it('trims whitespace around each origin', () => {
    expect(
      parseCorsWhitelist(
        '  https://cesta-web.vercel.app , http://localhost:3000 ',
      ),
    ).toEqual(['https://cesta-web.vercel.app', 'http://localhost:3000']);
  });

  it('dedupes repeated origins', () => {
    expect(
      parseCorsWhitelist(
        'https://a.example.com,https://a.example.com,https://b.example.com',
      ),
    ).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('ignores trailing / interstitial commas', () => {
    expect(parseCorsWhitelist('https://a.example.com,')).toEqual([
      'https://a.example.com',
    ]);
    expect(
      parseCorsWhitelist('https://a.example.com,,https://b.example.com,'),
    ).toEqual(['https://a.example.com', 'https://b.example.com']);
  });
});
