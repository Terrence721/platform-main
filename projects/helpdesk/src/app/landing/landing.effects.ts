import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { mapResponse } from '@ngrx/operators';
import { exhaustMap } from 'rxjs';
import { LandingApiActions, LandingPageActions } from './landing.actions';
import { ShowcaseTicketsService } from './showcase-tickets.service';

/**
 * Loads the showcase tickets when the landing page opens. A repeat "opened"
 * while a load is running is ignored.
 */
export const loadShowcaseTickets = createEffect(
  (actions$ = inject(Actions), showcase = inject(ShowcaseTicketsService)) => {
    return actions$.pipe(
      ofType(LandingPageActions.opened),
      exhaustMap(() =>
        showcase.load().pipe(
          mapResponse({
            next: (tickets) =>
              LandingApiActions.showcaseTicketsLoaded({ tickets }),
            error: () =>
              LandingApiActions.showcaseTicketsLoadFailed({
                error: 'The example tickets could not be loaded.',
              }),
          })
        )
      )
    );
  },
  { functional: true }
);
