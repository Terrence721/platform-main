import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { routes } from '../app.routes';
import { CapabilitiesService } from './capabilities.service';
import { LandingPageActions } from './landing.actions';
import { initialLandingState } from './landing.feature';
import LandingPage from './landing.page';

describe('LandingPage', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore({ initialState: { landing: initialLandingState } }),
        // The features section's own spec covers @ngrx/data.
        {
          provide: CapabilitiesService,
          useValue: { entities$: of([]), load: vi.fn() },
        },
      ],
    });
    const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    return {
      page: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
      dispatch,
    };
  }

  it('reports that it opened, which loads its showcase tickets', () => {
    const { dispatch } = render();

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      LandingPageActions.opened()
    );
  });

  it('shows the My tickets card beside the hero text', () => {
    const { page } = render();

    expect(
      page.querySelector('section.hero .hero-grid > .intro + hd-ticket-preview')
    ).not.toBeNull();
  });

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

  it('links from the hero down to the features', async () => {
    const { loader } = render();
    const tour = await loader.getHarness(
      MatButtonHarness.with({ text: 'See what it does' })
    );
    const host = await tour.host();

    expect(await tour.getAppearance()).toBe('outlined');
    expect(await host.matchesSelector('section.hero .intro > a')).toBe(true);
    expect(await host.getAttribute('href')).toBe('/#features');
  });

  it('shows the features section below the hero, named by its heading', () => {
    const { page } = render();
    const features = page.querySelector('section.hero + section#features');

    expect(features?.querySelector('.column > hd-capabilities')).not.toBeNull();
    expect(features?.getAttribute('aria-labelledby')).toBe(
      'capabilities-title'
    );
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
