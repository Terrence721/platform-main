import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { routes } from '../app.routes';
import LandingPage from './landing.page';

describe('LandingPage', () => {
  function render() {
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

  it('sets the hero in the centered content column', () => {
    const { page } = render();

    expect(page.querySelector('section.hero > .column h1')).not.toBeNull();
  });

  it('leaves signing in to the toolbar', async () => {
    const { loader } = render();

    expect(
      await loader.getAllHarnesses(MatButtonHarness.with({ text: /Sign in/ }))
    ).toHaveLength(0);
  });

  it('is the first page, at the root address', async () => {
    const route = routes.find((candidate) => candidate.path === '');

    expect(route?.title).toBe('Helpdesk');
    expect(await route?.loadComponent?.()).toEqual(
      expect.objectContaining({ default: LandingPage })
    );
  });
});
