import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import LandingPage from './landing.page';

describe('LandingPage', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    return {
      page: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
    };
  }

  it('says what Helpdesk is for', () => {
    const { page } = render();

    expect(page.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'Customer support, organized'
    );
    expect(page.querySelector('h1')?.textContent?.trim()).toBe(
      'Every request answered, on time, by the right person'
    );
    expect(page.querySelector('.lede')?.textContent).toContain(
      'Helpdesk turns customer emails into tickets'
    );
  });

  it('names the hero section by its heading', () => {
    const { page } = render();
    const hero = page.querySelector('section.hero');
    const heading = page.querySelector('h1');

    expect(hero?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.id).toBeTruthy();
  });

  it('offers a filled Sign in button that goes to the sign-in page', async () => {
    const { page, loader } = render();
    const signIn = await loader.getHarness(
      MatButtonHarness.with({ text: /Sign in/ })
    );

    expect(await signIn.getAppearance()).toBe('filled');
    expect(await (await signIn.host()).getAttribute('href')).toBe('/sign-in');
    expect(
      page.querySelector('a[href="/sign-in"] mat-icon')?.textContent?.trim()
    ).toBe('login');
  });

  it('is the first page, at the root address', async () => {
    const route = routes.find((candidate) => candidate.path === '');

    expect(route?.title).toBe('Helpdesk');
    expect(await route?.loadComponent?.()).toEqual(
      expect.objectContaining({ default: LandingPage })
    );
  });
});
