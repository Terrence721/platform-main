import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  isLiveEvent,
  LIVE_EVENTS_API,
  type LiveEvent,
} from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import {
  distinctUntilChanged,
  EMPTY,
  map,
  Observable,
  share,
  switchMap,
} from 'rxjs';
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
 * closes when they sign out (or another person signs in). The browser
 * reconnects by itself after a break; then `updates` says `reconnected`,
 * as events sent during the break are not sent again (they are notices,
 * not data: the data is in the database, a page only loads it again).
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly open = inject(OPEN_EVENT_SOURCE);

  readonly updates: Observable<LiveUpdate> = inject(Store)
    .select(sessionFeature.selectUser)
    .pipe(
      map((user) => user?.id ?? null),
      distinctUntilChanged(),
      switchMap((userId) => (userId === null ? EMPTY : this.stream())),
      share()
    );

  /** The stream while it is subscribed to; closed when nobody is. */
  private stream(): Observable<LiveUpdate> {
    return new Observable<LiveUpdate>((subscriber) => {
      const source = this.open(LIVE_EVENTS_API);
      if (source === null) {
        return undefined;
      }
      let opened = false;
      source.onopen = () => {
        if (opened) {
          subscriber.next({ kind: 'reconnected' });
        }
        opened = true;
      };
      source.onmessage = ({ data }: MessageEvent<string>) => {
        const event = parse(data);
        if (isLiveEvent(event)) {
          subscriber.next({ kind: 'event', event });
        }
      };
      // While it reconnects by itself, onerror only reports the break. A
      // refusal (signed out, 401) closes it for good: the session, not the
      // stream, deals with that.
      source.onerror = () => undefined;
      return () => source.close();
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
