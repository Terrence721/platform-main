import { inject, Injectable } from '@angular/core';
import { TicketDto } from '@helpdesk/contract';
import { ComponentStore } from '@ngrx/component-store';
import { Store } from '@ngrx/store';
import { interval, Observable, tap } from 'rxjs';
import { landingFeature } from './landing.feature';

export type SlaTone = 'overdue' | 'soon' | 'ok' | 'none';

const MINUTE = 60_000;
/** Due within this many minutes counts as "soon". */
const SOON_MINUTES = 4 * 60;

/** A duration in minutes as people read it: "25m", "2h", "1d 4h". */
function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${rest}m`;
}

/** How a ticket stands against its SLA at `now`, in words and as a tone. */
export function slaLabel(
  slaDueAt: string | null,
  now: Date
): { text: string; tone: SlaTone } {
  if (slaDueAt === null) {
    return { text: 'No SLA', tone: 'none' };
  }
  const minutes = Math.round(
    (new Date(slaDueAt).getTime() - now.getTime()) / MINUTE
  );
  if (minutes < 0) {
    return { text: `Overdue ${formatDuration(-minutes)}`, tone: 'overdue' };
  }
  return {
    text: `Due in ${formatDuration(minutes)}`,
    tone: minutes <= SOON_MINUTES ? 'soon' : 'ok',
  };
}

/** One row of the preview: a ticket, its SLA label now, and if it is open. */
export interface PreviewRow {
  ticket: TicketDto;
  sla: { text: string; tone: SlaTone };
  expanded: boolean;
}

interface TicketPreviewState {
  now: Date;
  /** The row showing its description; `null` when none is. */
  expandedId: string | null;
}

/**
 * The "My tickets" card's own state, which nothing else in the app needs:
 * the current time, kept current once a minute so SLA labels count on while
 * the page is open, and which row is expanded. The tickets themselves come
 * from the app store. Provided by the card, so it lives as long as the card.
 */
@Injectable()
export class TicketPreviewStore extends ComponentStore<TicketPreviewState> {
  private readonly tickets$ = inject(Store).select(
    landingFeature.selectAllTickets
  );

  readonly setNow = this.updater((state, now: Date): TicketPreviewState => ({
    ...state,
    now,
  }));

  /** Opens a row, or closes it if it is the open one. */
  readonly toggleExpanded = this.updater(
    (state, id: string): TicketPreviewState => ({
      ...state,
      expandedId: state.expandedId === id ? null : id,
    })
  );

  /** Moves `now` to the current time at each tick. */
  readonly keepTime = this.effect((ticks$: Observable<number>) =>
    ticks$.pipe(tap(() => this.setNow(new Date())))
  );

  readonly rows$: Observable<PreviewRow[]> = this.select(
    this.tickets$,
    this.select((state) => state),
    (tickets, { now, expandedId }) =>
      tickets.map((ticket) => ({
        ticket,
        sla: slaLabel(ticket.slaDueAt, now),
        expanded: ticket.id === expandedId,
      }))
  );

  constructor() {
    super({ now: new Date(), expandedId: null });
    this.keepTime(interval(MINUTE));
  }
}
