import { Injectable } from '@angular/core';
import type { TicketDto } from '@helpdesk/contract';
import { defer, Observable, of } from 'rxjs';
import { showcaseTickets } from './showcase-tickets';

/**
 * Where the landing page gets its showcase tickets, built in the browser.
 * The only part that changes if the API ever serves them (it has no public
 * endpoint for them: every ticket route needs a signed-in user): `load()`
 * becomes an HTTP call.
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseTicketsService {
  /** The showcase tickets, timed against the moment of subscribing. */
  load(): Observable<TicketDto[]> {
    return defer(() => of(showcaseTickets(new Date())));
  }
}
