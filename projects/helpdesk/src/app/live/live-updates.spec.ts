import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CurrentUser } from '@helpdesk/contract';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { MockInstance } from 'vitest';
import { SessionApiActions } from '../session/session.actions';
import { initialSessionState } from '../session/session.feature';
import {
  FIRST_RETRY_MS,
  type LiveUpdate,
  LiveUpdates,
  MAX_RETRY_MS,
  OPEN_EVENT_SOURCE,
} from './live-updates';

/** A stand-in for the browser's EventSource, driven by the test. */
class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  /** 0 connecting, 1 open, 2 closed, as the browser's. */
  readyState = 0;
  closed = false;

  constructor(readonly url: string) {}

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  /**
   * The connection breaks on the network: the browser tries again by
   * itself, so the source stays connecting.
   */
  breakOff(): void {
    this.readyState = 0;
    this.onerror?.();
  }

  /**
   * An HTTP error instead of the stream (a 502 from nginx while the API
   * restarts, a 401 once the session is over): the browser gives up.
   */
  failForGood(): void {
    this.readyState = 2;
    this.onerror?.();
  }

  /** The server sends `data` as a message. */
  send(data: unknown): void {
    this.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }
}

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};
const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};

describe('LiveUpdates', () => {
  /** Every stream opened, in order. */
  let opened: FakeEventSource[];
  let store: MockStore;
  let http: HttpTestingController;
  let dispatch: MockInstance;

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** The service with `user` signed in, and what it hands on. */
  function listen(
    user: CurrentUser | null,
    open: (url: string) => FakeEventSource | null = (url) => {
      const source = new FakeEventSource(url);
      opened.push(source);
      return source;
    }
  ) {
    opened = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { session: { ...initialSessionState, user } },
        }),
        { provide: OPEN_EVENT_SOURCE, useValue: open },
      ],
    });
    store = TestBed.inject(MockStore);
    http = TestBed.inject(HttpTestingController);
    dispatch = vi.spyOn(store, 'dispatch');
    const heard: LiveUpdate[] = [];
    const subscription = TestBed.inject(LiveUpdates).updates.subscribe(
      (update) => heard.push(update)
    );
    return { heard, subscription };
  }

  /** Signs `user` in, or out with `null`. */
  const signIn = (user: CurrentUser | null) =>
    store.setState({ session: { ...initialSessionState, user } });

  it('opens no stream while nobody is signed in, and one on sign-in', () => {
    listen(null);
    expect(opened).toEqual([]);

    signIn(sam);

    expect(opened.map(({ url }) => url)).toEqual(['/api/events']);
  });

  it('hands on the events from the stream', () => {
    const { heard } = listen(sam);

    opened[0].send({ type: 'ticket', ticketId: 'ticket-1' });
    opened[0].send({ type: 'accounts' });

    expect(heard).toEqual([
      { kind: 'event', event: { type: 'ticket', ticketId: 'ticket-1' } },
      { kind: 'event', event: { type: 'accounts' } },
    ]);
  });

  it('ignores anything on the stream that is not a live event', () => {
    const { heard } = listen(sam);

    opened[0].send('not json');
    opened[0].send({ type: 'ticket' });
    opened[0].send({ type: 'party', ticketId: 'ticket-1' });

    expect(heard).toEqual([]);
  });

  it('says reconnected after a break, not when it first opens', () => {
    const { heard } = listen(sam);

    opened[0].onopen?.();
    expect(heard).toEqual([]);
    // The connection breaks; the browser reconnects by itself.
    opened[0].breakOff();
    opened[0].onopen?.();

    expect(heard).toEqual([{ kind: 'reconnected' }]);
    // The browser saw to it: nothing is asked of the API.
    http.expectNone('/api/auth/me');
  });

  // An HTTP error (nginx's 502 while the API restarts, or a 401) closes an
  // EventSource for good: without this, live updates stopped, unseen, until
  // the page was reloaded.
  describe('when the browser gives up on the stream', () => {
    it('opens it again while still signed in, and says reconnected', () => {
      const { heard } = listen(sam);
      opened[0].onopen?.();

      opened[0].failForGood();
      http.expectOne('/api/auth/me').flush({ user: sam });

      expect(opened).toHaveLength(2);
      expect(opened[0].closed).toBe(true);
      opened[1].onopen?.();
      expect(heard).toEqual([{ kind: 'reconnected' }]);
    });

    // The account was closed, or the session ran out: say so now, not at
    // the person's next action.
    it('ends the session when nobody is signed in any more', () => {
      listen(sam);

      opened[0].failForGood();
      http.expectOne('/api/auth/me').flush({ user: null });

      expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        SessionApiActions.sessionEnded()
      );
      expect(opened).toHaveLength(1);
    });

    it('asks again while the API does not answer, waiting longer each time', () => {
      vi.useFakeTimers();
      listen(sam);

      opened[0].failForGood();
      http
        .expectOne('/api/auth/me')
        .error(new ProgressEvent('error'), { status: 502 });

      vi.advanceTimersByTime(FIRST_RETRY_MS - 1);
      http.expectNone('/api/auth/me');
      vi.advanceTimersByTime(1);
      http
        .expectOne('/api/auth/me')
        .error(new ProgressEvent('error'), { status: 502 });

      vi.advanceTimersByTime(FIRST_RETRY_MS * 2 - 1);
      http.expectNone('/api/auth/me');
      vi.advanceTimersByTime(1);
      http.expectOne('/api/auth/me').flush({ user: sam });

      expect(opened).toHaveLength(2);
    });

    it('never waits longer than a minute between tries', () => {
      vi.useFakeTimers();
      listen(sam);
      opened[0].failForGood();

      // Enough failures for the wait to have doubled past a minute.
      for (let i = 0; i < 8; i++) {
        http
          .expectOne('/api/auth/me')
          .error(new ProgressEvent('error'), { status: 502 });
        vi.advanceTimersByTime(MAX_RETRY_MS);
      }

      http.expectOne('/api/auth/me').flush({ user: sam });
      expect(opened).toHaveLength(2);
    });

    it('stops asking once signed out', () => {
      vi.useFakeTimers();
      listen(sam);
      opened[0].failForGood();
      http
        .expectOne('/api/auth/me')
        .error(new ProgressEvent('error'), { status: 502 });

      signIn(null);
      vi.advanceTimersByTime(MAX_RETRY_MS);

      http.expectNone('/api/auth/me');
      expect(opened).toHaveLength(1);
    });
  });

  it('closes the stream on sign-out', () => {
    listen(sam);

    signIn(null);

    expect(opened[0].closed).toBe(true);
    expect(opened).toHaveLength(1);
  });

  it('gives someone else signing in a stream of their own', () => {
    listen(sam);

    signIn(chris);

    expect(opened).toHaveLength(2);
    expect(opened[0].closed).toBe(true);
    expect(opened[1].closed).toBe(false);
  });

  it('keeps one stream when the same person is signed in again', () => {
    listen(sam);

    signIn({ ...sam });

    expect(opened).toHaveLength(1);
  });

  it('closes the stream when no page listens', () => {
    const { subscription } = listen(sam);

    subscription.unsubscribe();

    expect(opened[0].closed).toBe(true);
  });

  it('opens nothing where there is no stream (the in-browser demo)', () => {
    const { heard } = listen(sam, () => null);

    expect(heard).toEqual([]);
  });
});
