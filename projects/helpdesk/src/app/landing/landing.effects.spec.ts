import { TestBed } from '@angular/core/testing';
import { TicketDto } from '@helpdesk/contract';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, Subject, throwError } from 'rxjs';
import { LandingApiActions, LandingPageActions } from './landing.actions';
import { loadShowcaseTickets } from './landing.effects';
import { showcaseTickets } from './showcase-tickets';
import { ShowcaseTicketsService } from './showcase-tickets.service';

describe('loadShowcaseTickets', () => {
  const tickets = showcaseTickets(new Date('2026-10-02T12:00:00.000Z'));

  function run(load: () => Observable<TicketDto[]>) {
    const actions$ = new Subject<Action>();
    const service = { load: vi.fn(load) };
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(actions$),
        { provide: ShowcaseTicketsService, useValue: service },
      ],
    });

    const emitted: Action[] = [];
    TestBed.runInInjectionContext(() => loadShowcaseTickets()).subscribe(
      (action) => emitted.push(action)
    );
    return { actions$, service, emitted };
  }

  it('loads the showcase tickets when the page opens', () => {
    const { actions$, emitted } = run(() => of(tickets));

    actions$.next(LandingPageActions.opened());

    expect(emitted).toEqual([
      LandingApiActions.showcaseTicketsLoaded({ tickets }),
    ]);
  });

  it('reports a failed load in words the visitor can read', () => {
    const { actions$, emitted } = run(() =>
      throwError(() => new Error('HTTP 503'))
    );

    actions$.next(LandingPageActions.opened());

    expect(emitted).toEqual([
      LandingApiActions.showcaseTicketsLoadFailed({
        error: 'The example tickets could not be loaded.',
      }),
    ]);
  });

  it('keeps working after a failed load', () => {
    let attempt = 0;
    const { actions$, emitted } = run(() =>
      ++attempt === 1 ? throwError(() => new Error('HTTP 503')) : of(tickets)
    );

    actions$.next(LandingPageActions.opened());
    actions$.next(LandingPageActions.opened());

    expect(emitted.map(({ type }) => type)).toEqual([
      LandingApiActions.showcaseTicketsLoadFailed.type,
      LandingApiActions.showcaseTicketsLoaded.type,
    ]);
  });

  it('ignores another "opened" while a load is running', () => {
    const response = new Subject<TicketDto[]>();
    const { actions$, service, emitted } = run(() => response);

    actions$.next(LandingPageActions.opened());
    actions$.next(LandingPageActions.opened());
    response.next(tickets);
    response.complete();

    expect(service.load).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveLength(1);
  });

  it('does not react to other actions', () => {
    const { actions$, service, emitted } = run(() => of(tickets));

    actions$.next(LandingApiActions.showcaseTicketsLoaded({ tickets }));

    expect(service.load).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });
});
