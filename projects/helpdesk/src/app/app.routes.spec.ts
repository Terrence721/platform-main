import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CurrentUser, Role } from '@helpdesk/contract';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore, Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { CapabilitiesService } from './landing/capabilities.service';
import { CAPABILITIES, CAPABILITY } from './landing/capability';
import { landingFeature } from './landing/landing.feature';
import { SessionApiActions } from './session/session.actions';
import { sessionFeature } from './session/session.feature';
import { SignInLauncher } from './sign-in/sign-in-launcher';

const userWith = (role: Role): CurrentUser => ({
  id: `${role}.user`,
  name: 'Someone',
  role,
  teamId: role === 'admin' ? null : 'atlas',
});

describe('routes', () => {
  const launcher = { open: vi.fn(async () => undefined) };

  beforeEach(() => {
    launcher.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideStore(),
        provideState(sessionFeature),
        provideEffects(),
        provideEntityData(
          { entityMetadata: { [CAPABILITY]: {} } },
          withEffects()
        ),
        { provide: SignInLauncher, useValue: launcher },
      ],
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

  // A typo or an old bookmark lands somewhere, not on an empty page.
  it('sends an address that matches nothing to the landing page', async () => {
    const harness = await RouterTestingHarness.create('/no-such-page');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(
      harness.routeNativeElement?.querySelector('h1')?.textContent
    ).toContain('Every request answered');
  });

  it('serves the capabilities from the app, not the server', async () => {
    await RouterTestingHarness.create('/');

    expect(
      await firstValueFrom(TestBed.inject(CapabilitiesService).load())
    ).toEqual(CAPABILITIES);
    TestBed.inject(HttpTestingController).verify();
  });

  describe('role pages', () => {
    /** Sets the session as the start-up check would, then opens `url`. */
    async function open(url: string, role: Role | null) {
      TestBed.inject(Store).dispatch(
        role === null
          ? SessionApiActions.noSession()
          : SessionApiActions.sessionRestored({ user: userWith(role) })
      );
      const harness = await RouterTestingHarness.create(url);
      return {
        url: TestBed.inject(Router).url,
        heading: harness.routeNativeElement
          ?.querySelector('h1')
          ?.textContent?.trim(),
        title: TestBed.inject(Title).getTitle(),
      };
    }

    it.each([
      ['agent', '/agent', 'My tickets'],
      ['supervisor', '/supervisor', 'My team'],
      ['admin', '/admin', 'Team accounts'],
    ] as const)('opens the %s page at %s', async (role, url, heading) => {
      expect(await open(url, role)).toEqual({
        url,
        heading,
        title: `${heading} · Helpdesk`,
      });
      expect(launcher.open).not.toHaveBeenCalled();
    });

    it('sends an agent who opens the admin page to their own', async () => {
      const page = await open('/admin', 'agent');

      expect(page.url).toBe('/agent');
      expect(page.heading).toBe('My tickets');
    });

    it('sends a signed-out visitor to the landing page, with the sign-in popup open', async () => {
      const page = await open('/supervisor', null);

      expect(page.url).toBe('/');
      expect(page.heading).toContain('Every request answered');
      expect(launcher.open).toHaveBeenCalledOnce();
    });
  });
});
