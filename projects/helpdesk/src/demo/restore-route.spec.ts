import { restoreRoute } from './restore-route';

const BASE = 'https://terrence721.github.io/platform-main/helpdesk/';

describe('restoreRoute', () => {
  /** The address bar after the demo opens at `href`. */
  function after(href: string): string | null {
    const history = { replaceState: vi.fn() };
    restoreRoute({ href }, history, BASE);
    return history.replaceState.mock.calls[0]?.[2] ?? null;
  }

  it('opens the page a reload came back with', () => {
    expect(after(`${BASE}?route=%2Fagent`)).toBe(
      '/platform-main/helpdesk/agent'
    );
  });

  it('keeps its query and fragment', () => {
    expect(after(`${BASE}?route=${encodeURIComponent('/#roles')}`)).toBe(
      '/platform-main/helpdesk/#roles'
    );
  });

  it('leaves an ordinary visit alone', () => {
    expect(after(BASE)).toBeNull();
    expect(after(`${BASE}?other=1`)).toBeNull();
  });

  it.each([
    ['a route without its slash', 'agent'],
    ['another site', '//example.com/'],
    ['a full address', 'https://example.com/'],
  ])('ignores %s', (_, route) => {
    expect(after(`${BASE}?route=${encodeURIComponent(route)}`)).toBeNull();
  });
});
