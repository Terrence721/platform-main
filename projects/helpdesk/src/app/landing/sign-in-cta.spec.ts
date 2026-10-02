import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { SignInCta } from './sign-in-cta';

describe('SignInCta', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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

  it('offers a filled Sign in button that goes to the sign-in page', async () => {
    const signIn = await render().loader.getHarness(
      MatButtonHarness.with({ text: /Sign in/ })
    );

    expect(await signIn.getAppearance()).toBe('filled');
    expect(await (await signIn.host()).getAttribute('href')).toBe('/sign-in');
  });
});
