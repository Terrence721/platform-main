import { Injectable } from '@angular/core';
import { TicketDto } from '@helpdesk/contract';
import { defer, Observable, of } from 'rxjs';
import { showcaseTickets } from './showcase-tickets';

/**
 * Where the landing page gets its showcase tickets. The only part that
 * changes when the API exists: `load()` becomes an HTTP call.
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseTicketsService {
  /** The showcase tickets, timed against the moment of subscribing. */
  load(): Observable<TicketDto[]> {
    return defer(() => of(showcaseTickets(new Date())));
  }
}
