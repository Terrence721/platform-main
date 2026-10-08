import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CurrentUser, SIGN_IN_FAILED_MESSAGE } from '@helpdesk/contract';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { SignInDialogActions } from '../sign-in/sign-in.actions';
import { SessionApiActions, ToolbarActions } from './session.actions';
import {
  goHomeAfterSignIn,
  leaveAfterSignOut,
  restoreSession,
  SIGN_IN_UNAVAILABLE_MESSAGE,
  signIn,
  signInSounds,
  signOut,
} from './session.effects';
import { Sounds } from '../sound/sounds';

const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};
const request = { userId: 'alex.morgan', password: 'helpdesk-dev-only' };

describe('session effects', () => {
  let actions$: Subject<Action>;
  let http: HttpTestingController;
  const navigateByUrl = vi.fn(async () => true);
  /** A stand-in for the sounds, to hear which play. */
  const sounds = { play: vi.fn() };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    navigateByUrl.mockClear();
    sounds.play.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockActions(() => actions$),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: Sounds, useValue: sounds },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Runs an effect and collects what it dispatches. */
  function run(effect: () => Observable<unknown>): unknown[] {
    const dispatched: unknown[] = [];
    TestBed.runInInjectionContext(effect).subscribe((action) =>
      dispatched.push(action)
    );
    return dispatched;
  }

  describe('restoreSession', () => {
    it('restores a session the browser still has', () => {
      const dispatched = run(restoreSession);
      actions$.next({ type: ROOT_EFFECTS_INIT });

      http.expectOne('/api/auth/me').flush({ user: alex });

      expect(dispatched).toEqual([
        SessionApiActions.sessionRestored({ user: alex }),
      ]);
    });

    it('finds no session when the API says nobody is signed in', () => {
      const dispatched = run(restoreSession);
      actions$.next({ type: ROOT_EFFECTS_INIT });

      http.expectOne('/api/auth/me').flush({ user: null });

      expect(dispatched).toEqual([SessionApiActions.noSession()]);
    });

    // An API from before "nobody" became a 200 answers 401 instead.
    it('finds no session on 401', () => {
      const dispatched = run(restoreSession);
      actions$.next({ type: ROOT_EFFECTS_INIT });

      http
        .expectOne('/api/auth/me')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(dispatched).toEqual([SessionApiActions.noSession()]);
    });

    it('finds no session when the API cannot be reached', () => {
      const dispatched = run(restoreSession);
      actions$.next({ type: ROOT_EFFECTS_INIT });

      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));

      expect(dispatched).toEqual([SessionApiActions.noSession()]);
    });
  });

  describe('signIn', () => {
    it('sends the user ID and password, and reports the user', () => {
      const dispatched = run(signIn);
      actions$.next(SignInDialogActions.submitted({ request }));

      const call = http.expectOne('/api/auth/sign-in');
      expect(call.request.method).toBe('POST');
      expect(call.request.body).toEqual(request);
      call.flush({ user: alex });

      expect(dispatched).toEqual([SessionApiActions.signedIn({ user: alex })]);
    });

    it('says the details are incorrect on 401', () => {
      const dispatched = run(signIn);
      actions$.next(SignInDialogActions.submitted({ request }));

      http
        .expectOne('/api/auth/sign-in')
        .flush(
          { message: SIGN_IN_FAILED_MESSAGE },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(dispatched).toEqual([
        SessionApiActions.signInFailed({ message: SIGN_IN_FAILED_MESSAGE }),
      ]);
    });

    it.each([
      ['a server error', { status: 500, statusText: 'Server Error' }],
      ['the API being down', null],
    ])('says signing in is unavailable on %s', (_, failure) => {
      const dispatched = run(signIn);
      actions$.next(SignInDialogActions.submitted({ request }));

      const call = http.expectOne('/api/auth/sign-in');
      if (failure === null) {
        call.error(new ProgressEvent('error'));
      } else {
        call.flush(null, failure);
      }

      expect(dispatched).toEqual([
        SessionApiActions.signInFailed({
          message: SIGN_IN_UNAVAILABLE_MESSAGE,
        }),
      ]);
    });

    // After too many failed tries the API answers 429 with Retry-After
    // (#1113): retrying at once would only be refused again, so say when.
    it.each([
      ['898', 'Please try again in 15 minutes.'],
      ['61', 'Please try again in 2 minutes.'],
      ['30', 'Please try again in a moment.'],
      [null, 'Please try again later.'],
      ['soon', 'Please try again later.'],
    ])(
      'says there were too many tries on 429, with Retry-After %s',
      (retryAfter, when) => {
        const dispatched = run(signIn);
        actions$.next(SignInDialogActions.submitted({ request }));

        http.expectOne('/api/auth/sign-in').flush(
          { message: 'Too many sign-in attempts. Please try again later.' },
          {
            status: 429,
            statusText: 'Too Many Requests',
            headers: retryAfter === null ? {} : { 'Retry-After': retryAfter },
          }
        );

        expect(dispatched).toEqual([
          SessionApiActions.signInFailed({
            message: `Too many sign-in attempts. ${when}`,
          }),
        ]);
      }
    );

    it('ignores a second send while the first is still on its way', () => {
      run(signIn);
      actions$.next(SignInDialogActions.submitted({ request }));
      actions$.next(SignInDialogActions.submitted({ request }));

      http.expectOne('/api/auth/sign-in').flush({ user: alex });
    });
  });

  describe('signInSounds', () => {
    it('chimes when signing in works', () => {
      run(signInSounds);

      actions$.next(SessionApiActions.signedIn({ user: alex }));

      expect(sounds.play).toHaveBeenCalledExactlyOnceWith('success');
    });

    it('plays the low tone when signing in is refused', () => {
      run(signInSounds);

      actions$.next(
        SessionApiActions.signInFailed({ message: SIGN_IN_FAILED_MESSAGE })
      );

      expect(sounds.play).toHaveBeenCalledExactlyOnceWith('error');
    });

    it('is quiet for the session found on start-up', () => {
      run(signInSounds);

      actions$.next(SessionApiActions.sessionRestored({ user: alex }));

      expect(sounds.play).not.toHaveBeenCalled();
    });
  });

  describe('goHomeAfterSignIn', () => {
    it.each([
      ['admin', '/admin'],
      ['supervisor', '/supervisor'],
      ['agent', '/agent'],
    ] as const)('sends a %s to %s', (role, page) => {
      run(goHomeAfterSignIn);
      actions$.next(SessionApiActions.signedIn({ user: { ...alex, role } }));

      expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith(page);
    });
  });

  describe('signing out', () => {
    it('ends the session with the API', () => {
      const dispatched = run(signOut);
      actions$.next(ToolbarActions.signOutClicked());

      const call = http.expectOne('/api/auth/sign-out');
      expect(call.request.method).toBe('POST');
      call.flush(null, { status: 204, statusText: 'No Content' });

      expect(dispatched).toEqual([SessionApiActions.signedOut()]);
    });

    it('counts as signed out even if the API cannot be reached', () => {
      const dispatched = run(signOut);
      actions$.next(ToolbarActions.signOutClicked());

      http.expectOne('/api/auth/sign-out').error(new ProgressEvent('error'));

      expect(dispatched).toEqual([SessionApiActions.signedOut()]);
    });

    it('goes back to the landing page', () => {
      run(leaveAfterSignOut);
      actions$.next(SessionApiActions.signedOut());

      expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/');
    });
  });
});
