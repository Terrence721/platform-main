import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { CurrentUser } from '@helpdesk/contract';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { AppComponent } from './app.component';
import { PageSection, selectCurrentSection } from './router.selectors';
import { ToolbarActions } from './session/session.actions';
import { initialSessionState, SessionState } from './session/session.feature';
import { SignInLauncher } from './sign-in/sign-in-launcher';
import { SOUND_STORAGE, Sounds } from './sound/sounds';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

describe('AppComponent', () => {
  const launcher = { open: vi.fn() };

  /**
   * Renders the shell with the URL on `current`. The session defaults to
   * signed out, with the start-up check done.
   */
  function render(
    current: PageSection | null = null,
    session: Partial<SessionState> = { checked: true }
  ) {
    launcher.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: { session: { ...initialSessionState, ...session } },
        }),
        { provide: SignInLauncher, useValue: launcher },
        // Not the browser's storage: each test starts with sound on.
        { provide: SOUND_STORAGE, useValue: null },
      ],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectCurrentSection, current);
    const dispatch = vi.spyOn(store, 'dispatch');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return {
      shell: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
      dispatch,
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

  // For customers, who have no account to sign in with (#1026).
  it('links to Report an issue before Sign in, signed out', () => {
    const { shell } = render();

    const report = shell.querySelector<HTMLAnchorElement>(
      'mat-toolbar nav a.report-link'
    );
    expect(report?.textContent?.trim()).toBe('Report an issue');
    expect(report?.getAttribute('href')).toBe('/report');
    const signIn = shell.querySelector('mat-toolbar nav button') as Node;
    expect(
      (report?.compareDocumentPosition(signIn) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

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

  it('offers neither Sign in nor Sign out until the start-up check answers', async () => {
    const { shell, loader } = render(null, { checked: false });

    expect(await loader.getAllHarnesses(MatButtonHarness)).toEqual([]);
    expect(shell.querySelector('mat-toolbar nav')).toBeNull();
    expect(shell.querySelector('.who')).toBeNull();
  });

  describe('signed in', () => {
    const signedIn = () => render(null, { user: sam, checked: true });

    it('shows who is signed in, and their role', () => {
      const who = signedIn().shell.querySelector('.who');

      expect(who?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Sam Rivera · agent'
      );
      expect(getComputedStyle(who?.querySelector('.role') as Element)).toEqual(
        expect.objectContaining({ textTransform: 'capitalize' })
      );
    });

    it('offers the sound toggle and Sign out instead of Sign in and the landing sections', async () => {
      const { shell, loader } = signedIn();

      const buttons = await loader.getAllHarnesses(MatButtonHarness);
      expect(await Promise.all(buttons.map((b) => b.getText()))).toEqual([
        'volume_up',
        'logout Sign out',
      ]);
      expect(await buttons[1].getAppearance()).toBe('outlined');
      expect(shell.querySelector('mat-toolbar nav')).toBeNull();
    });

    describe('sound toggle', () => {
      const toggle = (shell: HTMLElement) =>
        shell.querySelector<HTMLButtonElement>(
          'button.sound-toggle'
        ) as HTMLButtonElement;

      it('says sound is on, and offers to mute it', () => {
        const button = toggle(signedIn().shell);

        expect(button.getAttribute('aria-label')).toBe('Mute sounds');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.textContent?.trim()).toBe('volume_up');
      });

      it('mutes the sounds, then turns them back on', async () => {
        const { shell, loader } = signedIn();
        const sounds = TestBed.inject(Sounds);
        const harness = await loader.getHarness(
          MatButtonHarness.with({ selector: '.sound-toggle' })
        );

        await harness.click();
        expect(sounds.muted()).toBe(true);
        expect(toggle(shell).getAttribute('aria-label')).toBe('Turn sounds on');
        expect(toggle(shell).getAttribute('aria-pressed')).toBe('true');
        expect(toggle(shell).textContent?.trim()).toBe('volume_off');

        await harness.click();
        expect(sounds.muted()).toBe(false);
      });
    });

    it('signs out from the toolbar', async () => {
      const { loader, dispatch } = signedIn();

      await (
        await loader.getHarness(MatButtonHarness.with({ text: /Sign out/ }))
      ).click();

      expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        ToolbarActions.signOutClicked()
      );
    });

    it("links the logo to the user's own page", () => {
      expect(
        signedIn().shell.querySelector('a.brand')?.getAttribute('href')
      ).toBe('/agent');
    });
  });
});
