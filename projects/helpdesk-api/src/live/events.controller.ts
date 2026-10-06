// The interfaces are imported as types: decorated methods record their
// parameter and return types at run time (emitDecoratorMetadata), and an
// interface has no run-time value to record.
import type { CurrentUser } from '@helpdesk/contract';
import { LiveEvents } from '@helpdesk/server';
import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import { SignedInUser } from '../auth/auth.guard';
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
  constructor(private readonly live: LiveEvents) {}

  /**
   * Server-sent events: each event that concerns the signed-in person
   * (see LiveEvents), as a `message` with the event as JSON; and every
   * KEEP_ALIVE_MS a `ping`, which the page's EventSource ignores. Any
   * signed-in role; signed out 401. It runs until the page closes it.
   */
  @Sse()
  @OnlyFor('agent', 'supervisor', 'admin')
  events(@SignedInUser() user: CurrentUser): Observable<MessageEvent> {
    return merge(
      this.live.for(user).pipe(map((event): MessageEvent => ({ data: event }))),
      interval(KEEP_ALIVE_MS).pipe(
        map((): MessageEvent => ({ type: 'ping', data: '' }))
      )
    );
  }
}
