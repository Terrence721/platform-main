import {
  EnvironmentProviders,
  InjectionToken,
  ModuleWithProviders,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  RoutesRecognized,
  RouterStateSnapshot,
} from '@angular/router';
import { Action, ActionReducer, MemoizedSelector, Selector } from '@ngrx/store';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). getRouterSelectors and
// RouterStateSelectors have their own ts-snippet spec.
import {
  BaseRouterStoreState,
  createRouterSelector,
  DEFAULT_ROUTER_FEATURENAME,
  FullRouterStateSerializer,
  MinimalActivatedRouteSnapshot,
  MinimalRouterStateSerializer,
  MinimalRouterStateSnapshot,
  NavigationActionTiming,
  provideRouterStore,
  ROUTER_CANCEL,
  ROUTER_CONFIG,
  ROUTER_ERROR,
  ROUTER_NAVIGATED,
  ROUTER_NAVIGATION,
  ROUTER_REQUEST,
  RouterAction,
  routerCancelAction,
  RouterCancelAction,
  RouterCancelPayload,
  routerErrorAction,
  RouterErrorAction,
  RouterErrorPayload,
  routerNavigatedAction,
  RouterNavigatedAction,
  RouterNavigatedPayload,
  routerNavigationAction,
  RouterNavigationAction,
  RouterNavigationPayload,
  routerReducer,
  RouterReducerState,
  routerRequestAction,
  RouterRequestAction,
  RouterRequestPayload,
  RouterState,
  RouterStateSerializer,
  SerializedRouterStateSnapshot,
  StateKeyOrSelector,
  StoreRouterConfig,
  StoreRouterConnectingModule,
} from '@ngrx/router-store';

describe('@ngrx/router-store public types', () => {
  describe('actions', () => {
    it('the action types are their literals', () => {
      expectTypeOf<
        typeof ROUTER_REQUEST
      >().toEqualTypeOf<'@ngrx/router-store/request'>();
      expectTypeOf<
        typeof ROUTER_NAVIGATION
      >().toEqualTypeOf<'@ngrx/router-store/navigation'>();
      expectTypeOf<
        typeof ROUTER_NAVIGATED
      >().toEqualTypeOf<'@ngrx/router-store/navigated'>();
      expectTypeOf<
        typeof ROUTER_CANCEL
      >().toEqualTypeOf<'@ngrx/router-store/cancel'>();
      expectTypeOf<
        typeof ROUTER_ERROR
      >().toEqualTypeOf<'@ngrx/router-store/error'>();
    });

    it('each payload carries the router state and its Angular event', () => {
      expectTypeOf<RouterRequestPayload>().toEqualTypeOf<{
        routerState: SerializedRouterStateSnapshot;
        event: NavigationStart;
      }>();
      expectTypeOf<RouterNavigationPayload>().toEqualTypeOf<{
        routerState: SerializedRouterStateSnapshot;
        event: RoutesRecognized;
      }>();
      expectTypeOf<RouterNavigatedPayload>().toEqualTypeOf<{
        routerState: SerializedRouterStateSnapshot;
        event: NavigationEnd;
      }>();
      expectTypeOf<RouterCancelPayload<unknown>>().toEqualTypeOf<{
        routerState: SerializedRouterStateSnapshot;
        storeState: unknown;
        event: NavigationCancel;
      }>();
      expectTypeOf<RouterErrorPayload<unknown>>().toEqualTypeOf<{
        routerState: SerializedRouterStateSnapshot;
        storeState: unknown;
        event: NavigationError;
      }>();
    });

    it('each action pairs its type with its payload', () => {
      expectTypeOf<RouterRequestAction['type']>().toEqualTypeOf<
        typeof ROUTER_REQUEST
      >();
      expectTypeOf<
        RouterNavigationAction['payload']
      >().toEqualTypeOf<RouterNavigationPayload>();
      expectTypeOf<
        RouterNavigatedAction['payload']
      >().toEqualTypeOf<RouterNavigatedPayload>();
      expectTypeOf<RouterCancelAction<unknown>['payload']>().toEqualTypeOf<
        RouterCancelPayload<unknown>
      >();
      expectTypeOf<RouterErrorAction<unknown>['payload']>().toEqualTypeOf<
        RouterErrorPayload<unknown>
      >();
      expectTypeOf<RouterAction<unknown>['type']>().toEqualTypeOf<
        | typeof ROUTER_REQUEST
        | typeof ROUTER_NAVIGATION
        | typeof ROUTER_NAVIGATED
        | typeof ROUTER_CANCEL
        | typeof ROUTER_ERROR
      >();
    });

    it('the action creators create the matching actions', () => {
      expectTypeOf(routerRequestAction).returns.toEqualTypeOf<
        { payload: RouterRequestPayload } & Action<typeof ROUTER_REQUEST>
      >();
      expectTypeOf(routerNavigationAction).returns.toEqualTypeOf<
        { payload: RouterNavigationPayload } & Action<typeof ROUTER_NAVIGATION>
      >();
      expectTypeOf(routerNavigatedAction).returns.toEqualTypeOf<
        { payload: RouterNavigatedPayload } & Action<typeof ROUTER_NAVIGATED>
      >();
      // The store state at the time of a cancel or error is not known.
      expectTypeOf(routerCancelAction).returns.toEqualTypeOf<
        { payload: RouterCancelPayload<unknown> } & Action<typeof ROUTER_CANCEL>
      >();
      expectTypeOf(routerErrorAction).returns.toEqualTypeOf<
        { payload: RouterErrorPayload<unknown> } & Action<typeof ROUTER_ERROR>
      >();
    });
  });

  describe('state', () => {
    it('routerReducer keeps the serialized state and the navigation id', () => {
      expectTypeOf<RouterReducerState>().toEqualTypeOf<{
        state: SerializedRouterStateSnapshot;
        navigationId: number;
      }>();
      // Its result type is a free type parameter (see #1344 in its source),
      // so it fits a reducer map whatever router state the map declares. A
      // direct call infers it from the state argument instead: give it the
      // router state type explicitly.
      expectTypeOf(routerReducer).toExtend<ActionReducer<RouterReducerState>>();
      expectTypeOf(routerReducer).toExtend<
        ActionReducer<RouterReducerState<MinimalRouterStateSnapshot>>
      >();
      expectTypeOf(
        routerReducer<MinimalRouterStateSnapshot>(undefined, { type: 'x' })
      ).toEqualTypeOf<RouterReducerState<MinimalRouterStateSnapshot>>();
    });

    it('createRouterSelector selects the router feature state', () => {
      expectTypeOf(
        createRouterSelector<{ router: RouterReducerState }>()
      ).toExtend<
        MemoizedSelector<{ router: RouterReducerState }, RouterReducerState>
      >();
      expectTypeOf<
        typeof DEFAULT_ROUTER_FEATURENAME
      >().toEqualTypeOf<'router'>();
    });
  });

  describe('serializers', () => {
    it('every serialized state has a url', () => {
      expectTypeOf<BaseRouterStoreState>().toEqualTypeOf<{ url: string }>();
      expectTypeOf<SerializedRouterStateSnapshot>().toEqualTypeOf<{
        root: ActivatedRouteSnapshot;
        url: string;
      }>();
      expectTypeOf<MinimalRouterStateSnapshot>().toEqualTypeOf<{
        root: MinimalActivatedRouteSnapshot;
        url: string;
      }>();
    });

    it('a minimal route keeps the route fields and its children', () => {
      expectTypeOf<keyof MinimalActivatedRouteSnapshot>().toEqualTypeOf<
        | 'routeConfig'
        | 'url'
        | 'params'
        | 'queryParams'
        | 'fragment'
        | 'data'
        | 'outlet'
        | 'title'
        | 'firstChild'
        | 'children'
      >();
      expectTypeOf<MinimalActivatedRouteSnapshot['children']>().toEqualTypeOf<
        MinimalActivatedRouteSnapshot[]
      >();
    });

    it('the serializers serialize a router snapshot', () => {
      expectTypeOf<
        RouterStateSerializer<MinimalRouterStateSnapshot>['serialize']
      >().toEqualTypeOf<
        (routerState: RouterStateSnapshot) => MinimalRouterStateSnapshot
      >();
      expectTypeOf<FullRouterStateSerializer>().toExtend<
        RouterStateSerializer<SerializedRouterStateSnapshot>
      >();
      expectTypeOf<MinimalRouterStateSerializer>().toExtend<
        RouterStateSerializer<MinimalRouterStateSnapshot>
      >();
    });
  });

  describe('configuration', () => {
    it('the enums have their documented values', () => {
      expectTypeOf<`${NavigationActionTiming}`>().toEqualTypeOf<'1' | '2'>();
      expectTypeOf<`${RouterState}`>().toEqualTypeOf<'0' | '1'>();
    });

    it('the config takes a state key, a serializer and the timing', () => {
      expectTypeOf<StateKeyOrSelector>().toEqualTypeOf<
        string | Selector<any, RouterReducerState>
      >();
      expectTypeOf<StoreRouterConfig>()
        .toHaveProperty('serializer')
        .toEqualTypeOf<
          | (new (
              ...args: any[]
            ) => RouterStateSerializer<SerializedRouterStateSnapshot>)
          | undefined
        >();
      expectTypeOf<StoreRouterConfig>()
        .toHaveProperty('navigationActionTiming')
        .toEqualTypeOf<NavigationActionTiming | undefined>();
      expectTypeOf<StoreRouterConfig>()
        .toHaveProperty('routerState')
        .toEqualTypeOf<RouterState | undefined>();
    });

    it('the router store is provided standalone or as a module', () => {
      expectTypeOf(provideRouterStore()).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(
        provideRouterStore({ serializer: MinimalRouterStateSerializer })
      ).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(StoreRouterConnectingModule.forRoot()).toEqualTypeOf<
        ModuleWithProviders<StoreRouterConnectingModule>
      >();
      expectTypeOf(ROUTER_CONFIG).toEqualTypeOf<InjectionToken<unknown>>();
    });
  });
});
