import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { SignInLauncher } from '../sign-in/sign-in-launcher';
import { SignInCta } from './sign-in-cta';

describe('SignInCta', () => {
  const launcher = { open: vi.fn() };

  function render() {
    launcher.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SignInLauncher, useValue: launcher },
      ],
    });
    const fixture = TestBed.createComponent(SignInCta);
    fixture.detectChanges();
    return {
      panel: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
    };
  }

  it('asks the support team to sign in, under an h2 the page can label it by', () => {
    const { panel } = render();
    const heading = panel.querySelector('h2');

    expect(heading?.id).toBe('signin-title');
    expect(heading?.textContent).toBe('Ready to pick up the next ticket?');
    expect(panel.querySelector('p')?.textContent).toBe(
      'Sign in with the account your admin set up for you.'
    );
  });

  // A customer who has read this far has no account to sign in with (#1026).
  it('points someone not on the team to Report an issue', () => {
    const { panel } = render();
    const line = panel.querySelector('.customers');
    const link = line?.querySelector('a');

    expect(line?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Not on the team? Report an issue with your account or an order.'
    );
    expect(link?.textContent?.trim()).toBe('Report an issue');
    expect(link?.getAttribute('href')).toBe('/report');
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
});
