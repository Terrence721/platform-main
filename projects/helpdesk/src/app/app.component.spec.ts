import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { AppComponent } from './app.component';
import { PageSection, selectCurrentSection } from './router.selectors';
import { SignInLauncher } from './sign-in/sign-in-launcher';

describe('AppComponent', () => {
  const launcher = { open: vi.fn() };

  function render(current: PageSection | null = null) {
    launcher.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore(),
        { provide: SignInLauncher, useValue: launcher },
      ],
    });
    TestBed.inject(MockStore).overrideSelector(selectCurrentSection, current);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return {
      shell: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
    };
  }

  it('links the app name and logo home', () => {
    const brand = render().shell.querySelector('mat-toolbar a.brand');

    expect(brand?.getAttribute('href')).toBe('/');
    expect(brand?.getAttribute('aria-label')).toBe('Helpdesk home');
    expect(brand?.textContent?.trim()).toBe('Helpdesk');
    expect(brand?.querySelector('svg')).not.toBeNull();
  });

  it('leaves the main heading to the page', () => {
    expect(render().shell.querySelector('mat-toolbar h1')).toBeNull();
  });

  it('offers a filled Sign in button that opens the sign-in popup', async () => {
    const signIn = await render().loader.getHarness(
      MatButtonHarness.with({ text: /Sign in/ })
    );

    expect(await signIn.getAppearance()).toBe('filled');
    expect(await (await signIn.host()).getAttribute('href')).toBeNull();
    await signIn.click();
    expect(launcher.open).toHaveBeenCalledOnce();
  });

  const sectionLinks = (shell: HTMLElement) =>
    [...shell.querySelectorAll('nav a.section-link')].map((link) => ({
      label: link.textContent?.trim(),
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    }));

  it('links to each section of the landing page from a "Page" nav', () => {
    const { shell } = render();

    expect(
      shell.querySelector('mat-toolbar nav')?.getAttribute('aria-label')
    ).toBe('Page');
    expect(sectionLinks(shell).map(({ label, href }) => [label, href])).toEqual(
      [
        ['Features', '/#features'],
        ['How it works', '/#workflow'],
        ['Roles', '/#roles'],
      ]
    );
  });

  it('marks the link to the section the URL points at, and only that one', () => {
    const links = sectionLinks(render('workflow').shell);

    expect(links.map(({ current }) => current)).toEqual([
      null,
      'location',
      null,
    ]);
  });

  it('marks no link when the URL points at no section', () => {
    expect(
      sectionLinks(render(null).shell).every(({ current }) => current === null)
    ).toBe(true);
  });

  it('renders routed pages inside main', () => {
    expect(render().shell.querySelector('main router-outlet')).not.toBeNull();
  });
});
