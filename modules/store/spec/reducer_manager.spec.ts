import { TestBed } from '@angular/core/testing';
import {
  ActionReducerFactory,
  ActionsSubject,
  createReducer,
  ReducerManager,
  StoreModule,
} from '..';

describe(ReducerManager.name, () => {
  it('should provide reducers being registered in store', () => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({
          'feature-1': createReducer(0),
        }),
      ],
    });

    const reducerManager = TestBed.inject(ReducerManager);

    expect(Object.keys(reducerManager.currentReducers)).toContain('feature-1');
  });

  it('should provide reducers being registered at runtime', () => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({
          'feature-1': createReducer(0),
        }),
      ],
    });

    const reducerManager = TestBed.inject(ReducerManager);

    reducerManager.addReducer('feature-2', createReducer(0));

    expect(Object.keys(reducerManager.currentReducers)).toContain('feature-1');
    expect(Object.keys(reducerManager.currentReducers)).toContain('feature-2');
  });

  it('should forward error() to asObservable() subscribers', () => {
    // Constructed directly rather than via StoreModule.forRoot() + TestBed -
    // that wiring also creates State, which subscribes to this same
    // reducer$ stream via the shorthand next-only form (real code,
    // state.ts), no error handler. Isolating avoids turning this into an
    // unrelated unhandled exception from a different component entirely.
    const stubReducerFactory: ActionReducerFactory<any, any> =
      (reducers, initialState) =>
      (state = initialState) =>
        state;
    const reducerManager = new ReducerManager(
      new ActionsSubject() as any,
      undefined,
      {},
      stubReducerFactory
    );
    const failure = new Error('boom');
    let seenError: unknown;

    reducerManager.asObservable().subscribe({
      error: (err) => (seenError = err),
    });
    reducerManager.error(failure);

    expect(seenError).toBe(failure);
  });
});
