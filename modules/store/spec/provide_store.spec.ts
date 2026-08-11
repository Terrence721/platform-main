import { TestBed } from '@angular/core/testing';
import { Action } from '../src/models';
import { provideState, provideStore } from '../src/provide_store';
import { Store } from '../src/store';

describe('provideStore / provideState:', () => {
  it('wires each feature to its own reducer when multiple features are registered', () => {
    const counterReducer = (state = 0, action: Action) =>
      action.type === 'increment' ? state + 1 : state;
    const nameReducer = (
      state = 'anonymous',
      action: Action & { payload?: string }
    ) => (action.type === 'setName' ? (action.payload ?? state) : state);

    TestBed.configureTestingModule({
      providers: [
        provideStore(),
        provideState('counter', counterReducer),
        provideState('name', nameReducer),
      ],
    });

    const store: Store<{ counter: number; name: string }> =
      TestBed.inject(Store);
    let state: { counter: number; name: string } | undefined;
    store.state$.subscribe((s) => (state = s));

    // Each feature's reducer must resolve to that feature specifically -
    // not undefined, and not another feature's reducer. This exercises the
    // FEATURE_REDUCERS multi-provider wiring in provide_store.ts, which has
    // no other test coverage in this repo.
    expect(state).toEqual({ counter: 0, name: 'anonymous' });

    store.dispatch({ type: 'increment' });
    expect(state).toEqual({ counter: 1, name: 'anonymous' });

    store.dispatch({ type: 'setName', payload: 'ngrx' } as Action);
    expect(state).toEqual({ counter: 1, name: 'ngrx' });
  });
});
