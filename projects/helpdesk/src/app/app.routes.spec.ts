import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { landingFeature } from './landing/landing.feature';

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideStore(), provideEffects()],
    });
  });

  it('opens the landing page at the root address', async () => {
    const harness = await RouterTestingHarness.create('/');

    expect(
      harness.routeNativeElement?.querySelector('h1')?.textContent
    ).toContain('Every request answered');
  });

  it('registers the landing state and loads its showcase tickets', async () => {
    await RouterTestingHarness.create('/');
    const store = TestBed.inject(Store);

    expect(
      await firstValueFrom(store.select(landingFeature.selectLoadState))
    ).toBe('loaded');
    expect(
      (await firstValueFrom(store.select(landingFeature.selectAllTickets))).map(
        ({ ticketNumber }) => ticketNumber
      )
    ).toEqual([1042, 1039, 1035, 1031]);
  });
});
