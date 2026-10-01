import { Inject, Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import {
  Action,
  ActionsSubject,
  INITIAL_STATE,
  ReducerManager,
  Store,
  createSelector,
  MemoizedSelectorWithProps,
  MemoizedSelector,
} from '@ngrx/store';
import { MockState } from './mock_state';
import { MockSelector } from './mock_selector';
import { MOCK_SELECTORS } from './tokens';

type OnlyMemoized<T, Result> = T extends string | MemoizedSelector<any, any>
  ? MemoizedSelector<any, Result>
  : T extends MemoizedSelectorWithProps<any, any, any>
    ? MemoizedSelectorWithProps<any, any, Result>
    : never;

type Memoized<Result> =
  MemoizedSelector<any, Result> | MemoizedSelectorWithProps<any, any, Result>;

@Injectable()
export class MockStore<T = object> extends Store<T> {
  private readonly selectors = new Map<Memoized<any> | string, any>();

  readonly scannedActions$: Observable<Action>;
  private lastState?: T;

  constructor(
    private mockState$: MockState<T>,
    actionsObserver: ActionsSubject,
    reducerManager: ReducerManager,
    @Inject(INITIAL_STATE) private initialState: T,
    @Inject(MOCK_SELECTORS) mockSelectors: MockSelector[] = []
  ) {
    super(mockState$, actionsObserver, reducerManager);
    this.resetSelectors();
    this.setState(this.initialState);
    this.scannedActions$ = actionsObserver.asObservable();
    for (const mockSelector of mockSelectors) {
      this.overrideSelector(mockSelector.selector, mockSelector.value);
    }
  }

  setState(nextState: T): void {
    this.mockState$.next(nextState);
    this.lastState = nextState;
  }

  // A string key always gets a new MemoizedSelector.
  overrideSelector<Value>(
    selector: string,
    value: Value
  ): MemoizedSelector<any, Value>;
  overrideSelector<
    Selector extends Memoized<Result>,
    Value extends Result,
    Result = Selector extends MemoizedSelector<any, infer T>
      ? T
      : Selector extends MemoizedSelectorWithProps<any, any, infer U>
        ? U
        : Value,
  >(
    selector: Selector | string,
    value: Value
  ): OnlyMemoized<typeof selector, Result>;
  overrideSelector(
    selector: Memoized<unknown> | string,
    value: unknown
  ): Memoized<unknown> {
    this.selectors.set(selector, value);

    const resultSelector: Memoized<unknown> =
      typeof selector === 'string'
        ? createSelector(
            () => undefined,
            () => value
          )
        : selector;

    resultSelector.setResult(value);

    return resultSelector;
  }

  resetSelectors() {
    for (const selector of this.selectors.keys()) {
      if (typeof selector !== 'string') {
        selector.release();
        selector.clearResult();
      }
    }

    this.selectors.clear();
  }

  // Store's signatures, repeated: an override with only the implementation
  // signature would type every result as Observable<any>.
  override select<K>(mapFn: (state: T) => K): Observable<K>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<K, Props = any>(
    mapFn: (state: T, props: Props) => K,
    props: Props
  ): Observable<K>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<a extends keyof T>(key: a): Observable<T[a]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<a extends keyof T, b extends keyof T[a]>(
    key1: a,
    key2: b
  ): Observable<T[a][b]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<
    a extends keyof T,
    b extends keyof T[a],
    c extends keyof T[a][b],
  >(key1: a, key2: b, key3: c): Observable<T[a][b][c]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<
    a extends keyof T,
    b extends keyof T[a],
    c extends keyof T[a][b],
    d extends keyof T[a][b][c],
  >(key1: a, key2: b, key3: c, key4: d): Observable<T[a][b][c][d]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<
    a extends keyof T,
    b extends keyof T[a],
    c extends keyof T[a][b],
    d extends keyof T[a][b][c],
    e extends keyof T[a][b][c][d],
  >(key1: a, key2: b, key3: c, key4: d, key5: e): Observable<T[a][b][c][d][e]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<
    a extends keyof T,
    b extends keyof T[a],
    c extends keyof T[a][b],
    d extends keyof T[a][b][c],
    e extends keyof T[a][b][c][d],
    f extends keyof T[a][b][c][d][e],
  >(
    key1: a,
    key2: b,
    key3: c,
    key4: d,
    key5: e,
    key6: f
  ): Observable<T[a][b][c][d][e][f]>;
  /**
   * @deprecated Selectors with props are deprecated and will be removed in v23. For more info see {@link https://github.com/ngrx/platform/issues/2980 Github Issue}
   */
  override select<
    a extends keyof T,
    b extends keyof T[a],
    c extends keyof T[a][b],
    d extends keyof T[a][b][c],
    e extends keyof T[a][b][c][d],
    f extends keyof T[a][b][c][d][e],
    K = any,
  >(
    key1: a,
    key2: b,
    key3: c,
    key4: d,
    key5: e,
    key6: f,
    ...paths: string[]
  ): Observable<K>;
  // Every argument is passed on, so a key path keeps all its keys.
  override select(selector: any, ...rest: any[]): Observable<any> {
    if (typeof selector === 'string' && this.selectors.has(selector)) {
      return new BehaviorSubject<any>(
        this.selectors.get(selector)
      ).asObservable();
    }

    return (super.select as (...args: any[]) => Observable<any>).call(
      this,
      selector,
      ...rest
    );
  }

  override addReducer() {
    /* noop */
  }

  override removeReducer() {
    /* noop */
  }

  /**
   * Refreshes the existing state.
   */
  refreshState() {
    if (this.lastState) this.setState({ ...this.lastState });
  }
}
