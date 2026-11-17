import {
  buildVercelPreviewRegex,
  isAllowedOrigin,
  isRejectedPreflight,
  parseCorsWhitelist,
  VERCEL_PREVIEW_REGEX,
} from './cors-origin';

describe('buildVercelPreviewRegex', () => {
  it('builds regex for the provided team slug', () => {
    const regex = buildVercelPreviewRegex('acme-team-1234');
    expect(regex.test('https://cesta-web-git-main-acme-team-1234.vercel.app')).toBe(true);
    expect(regex.test('https://cesta-web-git-main-other-team.vercel.app')).toBe(false);
  });

  it('falls back to default slug on empty input', () => {
    const regex = buildVercelPreviewRegex('');
    expect(
      regex.test(
        'https://cesta-web-git-main-gabriels-projects-f5aa3b24.vercel.app',
      ),
    ).toBe(true);
  });

  it('escapes regex meta chars in slug', () => {
    const regex = buildVercelPreviewRegex('team.with+meta');
    expect(regex.test('https://cesta-web-git-x-team.with+meta.vercel.app')).toBe(true);
    // confirma literalidade: `.` no slug não casa com outro char.
    expect(regex.test('https://cesta-web-git-x-teamXwithYmeta.vercel.app')).toBe(false);
  });
});

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

  it('allows Vercel preview URLs for the Cesta project (default slug)', () => {
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

  it('allows Vercel preview URLs for a custom team slug', () => {
    const regex = buildVercelPreviewRegex('acme');
    expect(
      isAllowedOrigin('https://cesta-web-git-x-acme.vercel.app', whitelist, regex),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        'https://cesta-web-git-x-gabriels-projects-f5aa3b24.vercel.app',
        whitelist,
        regex,
      ),
    ).toBe(false);
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

  it('default regex only matches the exact preview shape', () => {
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

describe('isRejectedPreflight', () => {
  const whitelist = ['https://cesta-web.vercel.app', 'http://localhost:3000'];

  it('rejects OPTIONS from unknown origin', () => {
    expect(
      isRejectedPreflight('OPTIONS', 'https://evil.example.com', whitelist),
    ).toBe(true);
  });

  it('allows OPTIONS from whitelisted origin', () => {
    expect(
      isRejectedPreflight('OPTIONS', 'https://cesta-web.vercel.app', whitelist),
    ).toBe(false);
  });

  it('allows OPTIONS from Vercel preview (default slug)', () => {
    expect(
      isRejectedPreflight(
        'OPTIONS',
        'https://cesta-web-git-feat-sprint-82-gabriels-projects-f5aa3b24.vercel.app',
        whitelist,
      ),
    ).toBe(false);
  });

  it('allows OPTIONS from custom team slug preview', () => {
    const regex = buildVercelPreviewRegex('acme');
    expect(
      isRejectedPreflight(
        'OPTIONS',
        'https://cesta-web-git-x-acme.vercel.app',
        whitelist,
        regex,
      ),
    ).toBe(false);
  });

  it('allows OPTIONS without origin (curl/S2S)', () => {
    expect(isRejectedPreflight('OPTIONS', undefined, whitelist)).toBe(false);
  });

  it('never rejects non-OPTIONS methods (delegated to cors package)', () => {
    expect(
      isRejectedPreflight('GET', 'https://evil.example.com', whitelist),
    ).toBe(false);
    expect(
      isRejectedPreflight('POST', 'https://evil.example.com', whitelist),
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
