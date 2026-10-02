import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

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

  it('offers a filled Sign in button that goes to the sign-in page', async () => {
    const signIn = await render().loader.getHarness(
      MatButtonHarness.with({ text: /Sign in/ })
    );

    expect(await signIn.getAppearance()).toBe('filled');
    expect(await (await signIn.host()).getAttribute('href')).toBe('/sign-in');
  });

  it('renders routed pages inside main', () => {
    expect(render().shell.querySelector('main router-outlet')).not.toBeNull();
  });
});
