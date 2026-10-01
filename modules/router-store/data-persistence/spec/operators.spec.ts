import { Component } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Action } from '@ngrx/store';
import { Observable, of, Subject, throwError } from 'rxjs';
import { describe, expect, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it (#301).
import {
  ActionStateStream,
  fetch,
  FetchOpts,
  navigation,
  optimisticUpdate,
  pessimisticUpdate,
} from '@ngrx/router-store/data-persistence';
import { ROUTER_NAVIGATION } from '@ngrx/router-store';

interface Update extends Action {
  type: 'update';
  id: number;
}
const update = (id: number): Update => ({ type: 'update', id });
const done = (id: number): Action => ({ type: `done ${id}` });

function collect(stream: Observable<Action>) {
  const actions: Action[] = [];
  const errors: unknown[] = [];
  stream.subscribe({
    next: (action) => actions.push(action),
    error: (error) => errors.push(error),
  });
  return { actions, errors };
}

describe('pessimisticUpdate', () => {
  it('emits what run returns: an action, an Observable or nothing', () => {
    const source = of(update(1), update(2), update(3));
    const { actions } = collect(
      source.pipe(
        pessimisticUpdate<[], Update>({
          run: (a) =>
            a.id === 1 ? done(1) : a.id === 2 ? of(done(2)) : undefined,
          onError: () => ({ type: 'error' }),
        })
      )
    );
    expect(actions).toEqual([done(1), done(2)]);
  });

  it('emits onError for an error thrown or emitted by run', () => {
    const { actions } = collect(
      of(update(1), update(2)).pipe(
        pessimisticUpdate<[], Update>({
          run: (a) => {
            if (a.id === 1) {
              throw new Error('sync');
            }
            return throwError(() => new Error('async'));
          },
          onError: (a, e: Error) => ({ type: `failed ${a.id}: ${e.message}` }),
        })
      )
    );
    expect(actions).toEqual([
      { type: 'failed 1: sync' },
      { type: 'failed 2: async' },
    ]);
  });

  it('passes the state slices that come with the action', () => {
    const source: Observable<[Update, string, number]> = of([
      update(1),
      'slice',
      42,
    ]);
    const { actions } = collect(
      source.pipe(
        pessimisticUpdate<[string, number], Update>({
          run: (a, text, count) => ({ type: `${a.id} ${text} ${count}` }),
          onError: () => undefined,
        })
      )
    );
    expect(actions).toEqual([{ type: '1 slice 42' }]);
  });

  it('runs one update after another', () => {
    const server = [new Subject<Action>(), new Subject<Action>()];
    const { actions } = collect(
      of(update(0), update(1)).pipe(
        pessimisticUpdate<[], Update>({
          run: (a) => server[a.id],
          onError: () => undefined,
        })
      )
    );
    server[1].next(done(1));
    expect(actions).toEqual([]);
    server[0].next(done(0));
    server[0].complete();
    server[1].next(done(1));
    expect(actions).toEqual([done(0), done(1)]);
  });
});

describe('optimisticUpdate', () => {
  it('emits the undo action when the update fails', () => {
    const { actions } = collect(
      of(update(1), update(2)).pipe(
        optimisticUpdate<[], Update>({
          run: (a) =>
            a.id === 1 ? done(1) : throwError(() => new Error('rejected')),
          undoAction: (a) => ({ type: `undo ${a.id}` }),
        })
      )
    );
    expect(actions).toEqual([done(1), { type: 'undo 2' }]);
  });
});

describe('fetch', () => {
  it('without id, runs the fetches in order', () => {
    const server = [new Subject<Action>(), new Subject<Action>()];
    const { actions } = collect(
      of(update(0), update(1)).pipe(
        fetch<[], Update>({ run: (a) => server[a.id] })
      )
    );
    server[0].next(done(0));
    server[0].complete();
    server[1].next(done(1));
    expect(actions).toEqual([done(0), done(1)]);
  });

  it('with id, a new fetch for the same id cancels the running one', () => {
    const source = new Subject<Update>();
    const server: Subject<Action>[] = [];
    const { actions } = collect(
      source.pipe(
        fetch<[], Update>({
          id: (a) => a.id,
          run: () => {
            const response = new Subject<Action>();
            server.push(response);
            return response;
          },
        })
      )
    );
    source.next(update(1)); // server[0]
    source.next(update(2)); // server[1], another id: runs alongside
    source.next(update(1)); // server[2], same id: cancels server[0]
    server[0].next({ type: 'stale 1' });
    server[1].next(done(2));
    server[2].next(done(1));
    expect(actions).toEqual([done(2), done(1)]);
  });

  it('emits onError when given one', () => {
    const { actions } = collect(
      of(update(1)).pipe(
        fetch<[], Update>({
          run: () => throwError(() => new Error('down')),
          onError: (a, e: Error) => ({ type: `failed ${a.id}: ${e.message}` }),
        })
      )
    );
    expect(actions).toEqual([{ type: 'failed 1: down' }]);
  });

  it('without onError, errors with the error from run, not a TypeError', () => {
    const asyncFailure = collect(
      of(update(1)).pipe(
        fetch<[], Update>({ run: () => throwError(() => new Error('down')) })
      )
    );
    const syncFailure = collect(
      of(update(1)).pipe(
        fetch<[], Update>({
          run: () => {
            throw new Error('thrown');
          },
        })
      )
    );
    expect(asyncFailure.errors).toEqual([new Error('down')]);
    expect(syncFailure.errors).toEqual([new Error('thrown')]);
  });
});

describe('navigation', () => {
  @Component({ template: '' })
  class BooksComponent {}
  @Component({ template: '' })
  class OtherComponent {}

  const snapshot = (
    component: unknown,
    children: ActivatedRouteSnapshot[] = []
  ) =>
    ({
      routeConfig: component ? { component } : null,
      children,
    }) as unknown as ActivatedRouteSnapshot;

  const navigated = (root: ActivatedRouteSnapshot) => ({
    type: ROUTER_NAVIGATION,
    payload: { routerState: { root }, event: {} },
  });

  it('runs for a navigation that activates the component', () => {
    const books = snapshot(BooksComponent);
    const seen: ActivatedRouteSnapshot[] = [];
    collect(
      of<Action[]>(
        navigated(snapshot(null, [snapshot(OtherComponent), books])),
        navigated(snapshot(null, [snapshot(OtherComponent)])),
        { type: 'not a navigation' }
      ).pipe(
        navigation(BooksComponent, {
          run: (route) => {
            seen.push(route);
            return undefined;
          },
        })
      )
    );
    expect(seen).toEqual([books]);
  });
});

describe('types', () => {
  it('names the options and the action stream', () => {
    expectTypeOf<FetchOpts<[string], Update>['run']>().toEqualTypeOf<
      (a: Update, ...slices: [string]) => Observable<Action> | Action | void
    >();
    expectTypeOf<ActionStateStream<string, Update>>().toEqualTypeOf<
      Observable<Update | [Update, string]>
    >();
  });
});
