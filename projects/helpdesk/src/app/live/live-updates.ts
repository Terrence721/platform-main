import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  isLiveEvent,
  LIVE_EVENTS_API,
  type LiveEvent,
  type SessionResponse,
} from '@helpdesk/contract';
import { createSelector, Store } from '@ngrx/store';
import {
  distinctUntilChanged,
  EMPTY,
  Observable,
  share,
  type Subscription,
  switchMap,
} from 'rxjs';
import { SessionApiActions } from '../session/session.actions';
import { sessionFeature } from '../session/session.feature';

/**
 * Opens the live updates stream, or gives `null` where there is none: the
 * in-browser demo (one tab, no server) provides `() => null`, and where
 * the browser has no EventSource (the specs' simulated one) there is none
 * either. A seam the specs use to drive a stream of their own.
 */
export const OPEN_EVENT_SOURCE = new InjectionToken<
  (url: string) => EventSource | null
>('OPEN_EVENT_SOURCE', {
  providedIn: 'root',
  factory: () => (url) =>
    typeof EventSource === 'undefined' ? null : new EventSource(url),
});

/** The first wait before asking again whether the API is back, in ms. */
export const FIRST_RETRY_MS = 2_000;

/** The longest wait between those questions, in ms. */
export const MAX_RETRY_MS = 60_000;

/** EventSource.CLOSED, which the specs' simulated browser lacks. */
const CLOSED = 2;

/** Who is signed in, asked when the stream has given up. */
const SESSION_API = '/api/auth/me';

/**
 * Who the stream is for: only a change of person opens a new one, not the
 * same person's details read again.
 */
const selectSignedInUserId = createSelector(
  sessionFeature.selectUser,
  (user) => user?.id ?? null
);

/**
 * What an open page hears: a change it may show (load again), or that the
 * stream came back after a break, when anything may have changed unseen
 * (load again too).
 */
export type LiveUpdate =
  { kind: 'event'; event: LiveEvent } | { kind: 'reconnected' };

/**
 * Live updates (#950), for the whole app: while someone is signed in, one
 * stream of server-sent events (GET /api/events), shared by every page
 * that listens to `updates`. The stream opens when someone signs in and
 * closes when they sign out (or another person signs in). After a break
 * it comes back (the browser reconnects by itself after a network break;
 * after an HTTP error, such as while the API restarts, it is opened again
 * here), and `updates` says `reconnected`, as events sent during the break
 * are not sent again (they are notices, not data: the data is in the
 * database, a page only loads it again).
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly open = inject(OPEN_EVENT_SOURCE);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly updates: Observable<LiveUpdate> = this.store
    .select(selectSignedInUserId)
    .pipe(
      distinctUntilChanged(),
      switchMap((userId) => (userId === null ? EMPTY : this.stream())),
      share()
    );

  /** The stream while it is subscribed to; closed when nobody is. */
  private stream(): Observable<LiveUpdate> {
    return new Observable<LiveUpdate>((subscriber) => {
      let source: EventSource | null = null;
      let opened = false;
      let wait = FIRST_RETRY_MS;
      let retry: ReturnType<typeof setTimeout> | undefined;
      let asking: Subscription | undefined;

      const connect = () => {
        const current = this.open(LIVE_EVENTS_API);
        source = current;
        if (current === null) {
          return;
        }
        current.onopen = () => {
          if (opened) {
            subscriber.next({ kind: 'reconnected' });
          }
          opened = true;
          wait = FIRST_RETRY_MS;
        };
        current.onmessage = ({ data }: MessageEvent<string>) => {
          const event = parse(data);
          if (isLiveEvent(event)) {
            subscriber.next({ kind: 'event', event });
          }
        };
        // After a network break the browser tries again by itself, and
        // onerror only reports it. After an HTTP error instead of the
        // stream (a 502 while the API restarts, a 401 once the session is
        // over) it gives up for good: then ask who is signed in.
        current.onerror = () => {
          if (current.readyState === CLOSED) {
            current.close();
            askWhoIsSignedIn();
          }
        };
      };

      // Still signed in: open the stream again. Nobody: the session ended,
      // so say so now, not at the person's next action. No answer (the API
      // is still down): ask again later, waiting longer each time.
      const askWhoIsSignedIn = () => {
        asking = this.http.get<SessionResponse>(SESSION_API).subscribe({
          next: ({ user }) => {
            if (user === null) {
              this.store.dispatch(SessionApiActions.sessionEnded());
            } else {
              connect();
            }
          },
          error: () => {
            retry = setTimeout(askWhoIsSignedIn, wait);
            wait = Math.min(wait * 2, MAX_RETRY_MS);
          },
        });
      };

      connect();
      return () => {
        clearTimeout(retry);
        asking?.unsubscribe();
        source?.close();
      };
    });
  }
}

/** The JSON a message carries, or `undefined` if it is not JSON. */
function parse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}
