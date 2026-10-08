import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CurrentUser } from '@helpdesk/contract';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { sessionEndedInterceptor } from './session-ended.interceptor';
import { SessionApiActions } from './session.actions';
import { sessionFeature } from './session.feature';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

/**
 * Sends GET `url`, which the API answers with `status`, signed in as
 * `user` (or nobody): what was dispatched, and whether the call failed.
 */
function answered(url: string, status: number, user: CurrentUser | null = sam) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([sessionEndedInterceptor])),
      provideHttpClientTesting(),
      provideMockStore({
        selectors: [{ selector: sessionFeature.selectUser, value: user }],
      }),
    ],
  });
  const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
  let failed = false;
  TestBed.inject(HttpClient)
    .get(url)
    .subscribe({ error: () => (failed = true) });
  TestBed.inject(HttpTestingController)
    .expectOne(url)
    .flush({ message: 'From the API.' }, { status, statusText: 'Refused' });
  return { dispatch, failed };
}

describe('sessionEndedInterceptor', () => {
  // The session ran out, or the account was deactivated or changed: every
  // action from now on would fail with its own "try again" message.
  it('ends the session on a 401 from the API, and still fails the call', () => {
    const { dispatch, failed } = answered('/api/tickets/mine', 401);

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      SessionApiActions.sessionEnded()
    );
    expect(failed).toBe(true);
  });

  // The session's own calls already say what a 401 means there.
  it.each(['/api/auth/me', '/api/auth/sign-in', '/api/auth/sign-out'])(
    'leaves a 401 from %s to the session effects',
    (url) => {
      expect(answered(url, 401).dispatch).not.toHaveBeenCalled();
    }
  );

  it.each([403, 404, 409, 500])('lets a %s through as it is', (status) => {
    const { dispatch, failed } = answered('/api/tickets/mine', status);

    expect(dispatch).not.toHaveBeenCalled();
    expect(failed).toBe(true);
  });

  it('does nothing when nobody is signed in', () => {
    expect(
      answered('/api/tickets/mine', 401, null).dispatch
    ).not.toHaveBeenCalled();
  });

  it('lets a successful answer through untouched', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionEndedInterceptor])),
        provideHttpClientTesting(),
        provideMockStore({
          selectors: [{ selector: sessionFeature.selectUser, value: sam }],
        }),
      ],
    });
    let body: unknown;
    TestBed.inject(HttpClient)
      .get('/api/tickets/mine')
      .subscribe((answer) => (body = answer));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/tickets/mine')
      .flush([]);

    expect(body).toEqual([]);
  });
});
