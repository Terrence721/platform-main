import { PAGE_SECTIONS, selectCurrentSection } from './router.selectors';

describe('selectCurrentSection', () => {
  /** The app state as router-store keeps it, reduced to what is read. */
  const at = (fragment: string | null) =>
    ({
      router: {
        state: { url: fragment ? `/#${fragment}` : '/', root: { fragment } },
        navigationId: 1,
      },
    }) as never;

  it.each(PAGE_SECTIONS)(
    'is $fragment when the URL points at $label',
    ({ fragment }) => {
      expect(selectCurrentSection(at(fragment))).toBe(fragment);
    }
  );

  it('is null when the URL has no fragment', () => {
    expect(selectCurrentSection(at(null))).toBeNull();
  });

  it('is null when the fragment is not one of the sections', () => {
    expect(selectCurrentSection(at('feature'))).toBeNull();
  });

  it('is null before the router has navigated', () => {
    expect(selectCurrentSection({ router: undefined } as never)).toBeNull();
  });
});

describe('PAGE_SECTIONS', () => {
  it('lists the sections in page order', () => {
    expect(PAGE_SECTIONS.map(({ label }) => label)).toEqual([
      'Features',
      'How it works',
      'Roles',
    ]);
  });
});
