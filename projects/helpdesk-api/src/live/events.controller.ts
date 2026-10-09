// The interfaces are imported as types: decorated methods record their
// parameter and return types at run time (emitDecoratorMetadata), and an
// interface has no run-time value to record.
import type { CurrentUser } from '@helpdesk/contract';
import { LiveHub } from '@helpdesk/server';
import { Controller, type MessageEvent, Req, Sse } from '@nestjs/common';
import {
  endWith,
  from,
  ignoreElements,
  interval,
  map,
  merge,
  type Observable,
  share,
  switchMap,
  takeUntil,
} from 'rxjs';
import { SESSION_COOKIE } from '../auth/auth-config';
import { type SessionRequest, SignedInUser } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { OnlyFor } from '../auth/role.guard';

/**
 * How often a quiet stream says it is still there, so proxies and load
 * balancers that close idle connections (often after 30 to 60 seconds)
 * leave it open.
 */
export const KEEP_ALIVE_MS = 25_000;

/** The live updates stream (/api/events, #950). */
@Controller('events')
export class EventsController {
  constructor(
    private readonly live: LiveHub,
    private readonly auth: AuthService
  ) {}

  /**
   * Server-sent events: each event that concerns the signed-in person
   * (see LiveHub), as a `message` with the event as JSON; and every
   * KEEP_ALIVE_MS a `ping`, which the page's EventSource ignores. Any
   * signed-in role; signed out 401. It runs until the page closes it, the
   * session ends, or the person's account changes (#1073); the page's
   * EventSource then reconnects, through the sign-in check again.
   */
  @Sse()
  @OnlyFor('agent', 'supervisor', 'admin')
  events(
    @SignedInUser() user: CurrentUser,
    @Req() request: SessionRequest
  ): Observable<MessageEvent> {
    const token = request.cookies?.[SESSION_COOKIE];
    return from(this.auth.sessionEndsAt(token)).pipe(
      switchMap((endsAt) => {
        // No end means no valid token (only if it expired just now): end at
        // once, and let the reconnect be refused.
        const events = this.live.for(user, endsAt ?? new Date(0)).pipe(
          map((event): MessageEvent => ({ data: event })),
          share()
        );
        // The pings stop with the events, or they would keep it open.
        const pings = interval(KEEP_ALIVE_MS).pipe(
          map((): MessageEvent => ({ type: 'ping', data: '' })),
          takeUntil(events.pipe(ignoreElements(), endWith(null)))
        );
        return merge(events, pings);
      })
    );
  }
}
