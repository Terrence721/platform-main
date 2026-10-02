import { TicketDto, TicketStatus } from '@helpdesk/contract';
import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { LandingApiActions, LandingPageActions } from './landing.actions';

/** The landing page's state: the example tickets its preview shows. */
export interface LandingState extends EntityState<TicketDto> {
  /** The status the preview shows; `null` shows every status. */
  statusFilter: TicketStatus | null;
  loadState: 'loading' | 'loaded' | 'failed';
}

/**
 * Orders tickets by SLA due time, earliest (most urgent) first; tickets with
 * no SLA come last; the ticket number breaks ties. Due times are ISO 8601
 * strings in UTC in one format, so comparing them as text orders them in
 * time.
 */
export function compareBySlaDue(a: TicketDto, b: TicketDto): number {
  if (a.slaDueAt === b.slaDueAt) {
    return a.ticketNumber - b.ticketNumber;
  }
  if (a.slaDueAt === null) {
    return 1;
  }
  if (b.slaDueAt === null) {
    return -1;
  }
  return a.slaDueAt < b.slaDueAt ? -1 : 1;
}

export const landingAdapter = createEntityAdapter<TicketDto>({
  sortComparer: compareBySlaDue,
});

export const initialLandingState: LandingState = landingAdapter.getInitialState(
  { statusFilter: null, loadState: 'loading' }
);

export const landingFeature = createFeature({
  name: 'landing',
  reducer: createReducer(
    initialLandingState,
    on(
      LandingApiActions.exampleTicketsLoaded,
      (state, { tickets }): LandingState =>
        landingAdapter.setAll(tickets, { ...state, loadState: 'loaded' })
    ),
    on(LandingApiActions.exampleTicketsLoadFailed, (state): LandingState => ({
      ...state,
      loadState: 'failed',
    })),
    on(
      LandingPageActions.statusFilterChanged,
      (state, { status }): LandingState => ({ ...state, statusFilter: status })
    )
  ),
  extraSelectors: ({ selectLandingState, selectStatusFilter }) => {
    const { selectAll } = landingAdapter.getSelectors(selectLandingState);
    return {
      selectAllTickets: selectAll,
      /** The tickets the preview shows: those matching the status filter. */
      selectVisibleTickets: createSelector(
        selectAll,
        selectStatusFilter,
        (tickets, status) =>
          status === null
            ? tickets
            : tickets.filter((ticket) => ticket.status === status)
      ),
    };
  },
});
