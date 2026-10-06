import { TestBed } from '@angular/core/testing';
import type { CurrentUser } from '@helpdesk/contract';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import {
  type LiveUpdate,
  LiveUpdates,
  OPEN_EVENT_SOURCE,
} from './live-updates';

/** A stand-in for the browser's EventSource, driven by the test. */
class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {}

  close(): void {
    this.closed = true;
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
        provideMockStore({
          initialState: { session: { ...initialSessionState, user } },
        }),
        { provide: OPEN_EVENT_SOURCE, useValue: open },
      ],
    });
    store = TestBed.inject(MockStore);
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
    opened[0].onerror?.();
    opened[0].onopen?.();

    expect(heard).toEqual([{ kind: 'reconnected' }]);
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
