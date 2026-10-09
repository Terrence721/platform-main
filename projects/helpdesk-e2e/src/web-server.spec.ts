import { expect, test } from '@playwright/test';

// The app image's web server (projects/helpdesk/nginx.conf, #1282): the
// headers every answer carries, how long each file may be kept, and
// compression.

/** What every answer says, pages and the API alike. */
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
  'referrer-policy': 'same-origin',
};

test.describe('the web server', () => {
  test('sends the security headers on the app and the API, and no version', async ({
    request,
  }) => {
    for (const path of ['/', '/agent', '/api/auth/me']) {
      const response = await request.get(path);

      expect(response.ok(), path).toBe(true);
      expect(response.headers(), path).toMatchObject(SECURITY_HEADERS);
      expect(response.headers()['server'], path).toBe('nginx');
    }
  });

  test('keeps hashed scripts for a year, never the page, and gzips scripts', async ({
    request,
  }) => {
    const page = await request.get('/');
    const script = /src="(main-[A-Za-z0-9_]{8}\.js)"/.exec(
      await page.text()
    )?.[1];
    expect(script).toBeDefined();

    const response = await request.get(`/${script}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });

    expect(page.headers()['cache-control']).toBe('no-cache');
    expect(response.headers()).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-encoding': 'gzip',
      ...SECURITY_HEADERS,
    });
  });
});
