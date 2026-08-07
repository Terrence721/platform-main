import { Inject, Injectable, OnDestroy, Provider } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActionsSubject } from './actions_subject';
import {
  Action,
  ActionReducer,
  ActionReducerFactory,
  ActionReducerMap,
  StoreFeature,
} from './models';
import { INITIAL_REDUCERS, INITIAL_STATE, REDUCER_FACTORY } from './tokens';
import {
  createFeatureReducerFactory,
  createReducerFactory,
  omit,
} from './utils';

export abstract class ReducerObservable extends Observable<
  ActionReducer<any, any>
> {}
export abstract class ReducerManagerDispatcher extends ActionsSubject {}
export const UPDATE = '@ngrx/store/update-reducers' as const;

/**
 * Composes a BehaviorSubject internally instead of extending it, for the
 * same reason as ActionsSubject: extending would pull in the full RxJS
 * Observable/Subject operator surface (pipe, lift, toPromise, ...) as part
 * of ReducerManager's own public contract, when the actual contract is
 * "track the combined reducer, let it be observed, react to
 * feature (un)registration." Consumers that need the Observable view go
 * through the separate `ReducerObservable` DI token (see
 * REDUCER_MANAGER_PROVIDERS below), which already existed before this
 * change and continues to resolve to a real Observable.
 */
@Injectable()
export class ReducerManager implements OnDestroy {
  private readonly reducer$: BehaviorSubject<ActionReducer<any, any>>;

  get currentReducers(): ActionReducerMap<any, any> {
    return this.reducers;
  }

  constructor(
    private dispatcher: ReducerManagerDispatcher,
    @Inject(INITIAL_STATE) private initialState: any,
    @Inject(INITIAL_REDUCERS) private reducers: ActionReducerMap<any, any>,
    @Inject(REDUCER_FACTORY)
    private reducerFactory: ActionReducerFactory<any, any>
  ) {
    this.reducer$ = new BehaviorSubject(reducerFactory(reducers, initialState));
  }

  asObservable(): Observable<ActionReducer<any, any>> {
    return this.reducer$.asObservable();
  }

  error(err: any): void {
    this.reducer$.error(err);
  }

  addFeature(feature: StoreFeature<any, any>) {
    this.addFeatures([feature]);
  }

  addFeatures(features: StoreFeature<any, any>[]) {
    const reducers = features.reduce(
      (
        reducerDict,
        { reducers, reducerFactory, metaReducers, initialState, key }
      ) => {
        const reducer =
          typeof reducers === 'function'
            ? createFeatureReducerFactory(metaReducers)(reducers, initialState)
            : createReducerFactory(reducerFactory, metaReducers)(
                reducers,
                initialState
              );

        reducerDict[key] = reducer;
        return reducerDict;
      },
      {} as { [key: string]: ActionReducer<any, any> }
    );

    this.addReducers(reducers);
  }

  removeFeature(feature: StoreFeature<any, any>) {
    this.removeFeatures([feature]);
  }

  removeFeatures(features: StoreFeature<any, any>[]) {
    this.removeReducers(features.map((p) => p.key));
  }

  addReducer(key: string, reducer: ActionReducer<any, any>) {
    this.addReducers({ [key]: reducer });
  }

  addReducers(reducers: { [key: string]: ActionReducer<any, any> }) {
    this.reducers = { ...this.reducers, ...reducers };
    this.updateReducers(Object.keys(reducers));
  }

  removeReducer(featureKey: string) {
    this.removeReducers([featureKey]);
  }

  removeReducers(featureKeys: string[]) {
    featureKeys.forEach((key) => {
      this.reducers = omit(this.reducers, key) /*TODO(#823)*/ as any;
    });
    this.updateReducers(featureKeys);
  }

  private updateReducers(featureKeys: string[]) {
    this.reducer$.next(this.reducerFactory(this.reducers, this.initialState));
    this.dispatcher.next(<Action>{
      type: UPDATE,
      features: featureKeys,
    });
  }

  ngOnDestroy() {
    this.reducer$.complete();
  }
}

export const REDUCER_MANAGER_PROVIDERS: Provider[] = [
  ReducerManager,
  {
    provide: ReducerObservable,
    useFactory: (reducerManager: ReducerManager) =>
      reducerManager.asObservable(),
    deps: [ReducerManager],
  },
  { provide: ReducerManagerDispatcher, useExisting: ActionsSubject },
];
