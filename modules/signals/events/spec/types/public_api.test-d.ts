import { inject, Provider, Signal } from '@angular/core';
import { signalStore, type, withState } from '@ngrx/signals';
import { Observable, OperatorFunction } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162).
import {
  Dispatcher,
  event,
  EventCreator,
  eventGroup,
  EventInstance,
  Events,
  EventScope,
  EventScopeConfig,
  injectDispatch,
  mapToScope,
  on,
  provideDispatcher,
  ReducerEvents,
  toScope,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';

const opened = event('[Dialog] Opened');
const saved = event('[Dialog] Saved', type<{ id: number }>());
const bookEvents = eventGroup({
  source: 'Books',
  events: { loaded: type<string[]>(), reset: type<void>() },
});

describe('@ngrx/signals/events public types', () => {
  it('event creates a typed creator, with or without a payload', () => {
    expectTypeOf(opened).toEqualTypeOf<EventCreator<'[Dialog] Opened', void>>();
    expectTypeOf(opened.type).toEqualTypeOf<'[Dialog] Opened'>();
    expectTypeOf(opened()).toEqualTypeOf<
      EventInstance<'[Dialog] Opened', void>
    >();
    expectTypeOf(saved({ id: 1 })).toEqualTypeOf<{
      type: '[Dialog] Saved';
      payload: { id: number };
    }>();
    // @ts-expect-error the payload is required
    saved();
  });

  it('eventGroup prefixes each event type with its source', () => {
    expectTypeOf(bookEvents.loaded).toEqualTypeOf<
      EventCreator<'[Books] loaded', string[]>
    >();
    expectTypeOf(bookEvents.reset.type).toEqualTypeOf<'[Books] reset'>();
  });

  it('Events.on narrows the stream to the given events', () => {
    const events = {} as Events;
    expectTypeOf(events.on(opened, saved)).toEqualTypeOf<
      Observable<
        | EventInstance<'[Dialog] Opened', void>
        | EventInstance<'[Dialog] Saved', { id: number }>
      >
    >();
    expectTypeOf(events.on()).toEqualTypeOf<
      Observable<EventInstance<string, unknown>>
    >();
    expectTypeOf<ReducerEvents['on']>().toEqualTypeOf<Events['on']>();
  });

  it('the dispatcher dispatches an event to a scope', () => {
    expectTypeOf<Dispatcher['dispatch']>().toEqualTypeOf<
      (event: EventInstance<string, unknown>, config?: EventScopeConfig) => void
    >();
    expectTypeOf<EventScope>().toEqualTypeOf<'self' | 'parent' | 'global'>();
    expectTypeOf(toScope('parent')).toEqualTypeOf<EventScopeConfig>();
    expectTypeOf(provideDispatcher()).toEqualTypeOf<Provider[]>();
    expectTypeOf(
      mapToScope<EventInstance<'[Dialog] Opened', void>>('global')
    ).toEqualTypeOf<
      OperatorFunction<
        EventInstance<'[Dialog] Opened', void>,
        [EventInstance<'[Dialog] Opened', void>, EventScopeConfig]
      >
    >();
  });

  it('injectDispatch turns an event group into dispatching functions', () => {
    type Dispatch = ReturnType<typeof injectDispatch<typeof bookEvents>>;
    expectTypeOf<Dispatch['loaded']>().toEqualTypeOf<
      (payload: string[]) => void
    >();
    expectTypeOf<Dispatch['reset']>().toEqualTypeOf<() => void>();
    expectTypeOf<Dispatch>().toBeCallableWith({ scope: 'parent' });
  });

  it('on and withReducer take case reducers of the store state', () => {
    // The state comes from the store withReducer is in (on uses NoInfer for
    // it), so a case reducer is typed in place, not annotated.
    signalStore(
      withState({ count: 0 }),
      withReducer(
        on(saved, opened, (event, state) => {
          expectTypeOf(event).toEqualTypeOf<
            | EventInstance<'[Dialog] Saved', { id: number }>
            | EventInstance<'[Dialog] Opened', void>
          >();
          expectTypeOf(state).toEqualTypeOf<{ count: number }>();
          return { count: state.count + 1 };
        })
      ),
      withEventHandlers((store, events = inject(Events)) => {
        expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
        return { log$: events.on(saved) };
      })
    );
  });
});
