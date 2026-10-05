import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CurrentUser } from '@helpdesk/contract';
import { DEFAULT_SEED_PASSWORD, NAMED_USERS } from '@helpdesk/server';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { SessionApiActions } from '../app/session/session.actions';
import type { DemoApi } from './demo-api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DemoBanner } from './demo-banner';
import { DEMO_API } from './demo-backend';

const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};

describe('DemoBanner', () => {
  /** Settles the demo's start: ready, or failed. */
  let ready: (api: DemoApi) => void;
  let fail: (error: Error) => void;

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore(),
        {
          provide: DEMO_API,
          useValue: new Promise<DemoApi>((resolve, reject) => {
            ready = resolve;
            fail = reject;
          }),
        },
      ],
    });
    const fixture = TestBed.createComponent(DemoBanner);
    fixture.detectChanges();
    const banner = fixture.nativeElement as HTMLElement;
    const store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    return {
      banner,
      store,
      http: TestBed.inject(HttpTestingController),
      /** Lets the demo's start settle, then renders. */
      settle: async () => {
        await Promise.resolve();
        await Promise.resolve();
        fixture.detectChanges();
      },
      detectChanges: () => fixture.detectChanges(),
      text: (selector: string) =>
        banner
          .querySelector(selector)
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      button: (label: string) =>
        [...banner.querySelectorAll<HTMLButtonElement>('button')].find(
          (candidate) => candidate.textContent?.trim() === label
        ),
    };
  }

  it('says what the demo is, and that it is starting', () => {
    const { text, banner } = render();

    expect(text('.about')).toBe(
      'Live demo: it runs entirely in your browser, and any changes reset when you reload.'
    );
    expect(text('[role="status"]')).toBe('Preparing the demo…');
    expect(banner.querySelectorAll('button')).toHaveLength(0);
  });

  it('offers a button per role once the demo is ready, and the password', async () => {
    const { banner, settle, text } = render();

    ready({} as DemoApi);
    await settle();

    expect(
      [...banner.querySelectorAll('button')].map((b) => b.textContent?.trim())
    ).toEqual(['Agent', 'Supervisor', 'Admin']);
    expect(text('.password')).toBe(
      'Or sign in with any user ID and the password helpdesk-dev-only.'
    );
  });

  it('signs in as the role chosen, and reports it as the app does', async () => {
    const { button, settle, http, store, detectChanges } = render();
    ready({} as DemoApi);
    await settle();

    button('Supervisor')?.click();
    detectChanges();
    const request = http.expectOne({
      method: 'POST',
      url: '/api/auth/sign-in',
    });
    expect(request.request.body).toEqual({
      userId: 'chris.taylor',
      password: DEMO_PASSWORD,
    });
    expect(button('Agent')?.disabled).toBe(true);
    request.flush({ user: chris });

    expect(store.dispatch).toHaveBeenCalledExactlyOnceWith(
      SessionApiActions.signedIn({ user: chris })
    );
  });

  it('says so when signing in does not work', async () => {
    const { button, settle, http, text, store, detectChanges } = render();
    ready({} as DemoApi);
    await settle();

    button('Agent')?.click();
    http
      .expectOne('/api/auth/sign-in')
      .flush(null, { status: 500, statusText: 'Error' });
    detectChanges();

    expect(text('.error')).toBe('That did not work. Try reloading the page.');
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('says so when the demo cannot start', async () => {
    const { settle, text, banner } = render();

    fail(new Error('No WebAssembly'));
    await settle();

    expect(text('[role="alert"]')).toBe(
      'The demo could not start in this browser. Try reloading the page.'
    );
    expect(banner.querySelectorAll('button')).toHaveLength(0);
  });
});

// The banner keeps its own copies, so it does not pull the server code into
// the app's first download; these keep them true to the seed.
describe("the demo banner's accounts", () => {
  it("use the seed's password and accounts", () => {
    expect(DEMO_PASSWORD).toBe(DEFAULT_SEED_PASSWORD);
    for (const { userId, role } of DEMO_ACCOUNTS) {
      expect(NAMED_USERS).toContainEqual(
        expect.objectContaining({ id: userId, role })
      );
    }
  });
});
