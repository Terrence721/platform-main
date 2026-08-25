import { ModuleWithProviders, NgModule } from '@angular/core';
import { BaseRouterStoreState } from './serializers/base';
import { SerializedRouterStateSnapshot } from './serializers/full_serializer';
import { StoreRouterConfig } from './router_store_config';
import { provideRouterStore } from './provide_router_store';

/**
 * Connects RouterModule with StoreModule.
 *
 * During the navigation, before any guards or resolvers run, the router will dispatch
 * a ROUTER_NAVIGATION action, which has the following signature:
 *
 * ```
 * export type RouterNavigationPayload = {
 *   routerState: SerializedRouterStateSnapshot,
 *   event: RoutesRecognized
 * }
 * ```
 *
 * Either a reducer or an effect can be invoked in response to this action.
 * A reducer that throws in response to this action does *not* cancel navigation -
 * the error becomes an uncaught exception rather than a caught navigation failure,
 * so `router.navigateByUrl(...)`'s returned promise never settles. (Confirmed via
 * `integration.spec.ts`'s `should support preventing navigation`, which is
 * `test.skip`'d for exactly this reason - the test times out if un-skipped.)
 *
 * If navigation gets canceled because of a guard, a ROUTER_CANCEL action will be
 * dispatched. If navigation results in an error (e.g. a guard or resolver throws),
 * a ROUTER_ERROR action will be dispatched.
 *
 * Both ROUTER_CANCEL and ROUTER_ERROR contain the store state before the navigation
 * which can be used to restore the consistency of the store.
 *
 * Usage:
 *
 * ```typescript
 * @NgModule({
 *   declarations: [AppCmp, SimpleCmp],
 *   imports: [
 *     BrowserModule,
 *     StoreModule.forRoot(mapOfReducers),
 *     RouterModule.forRoot([
 *       { path: '', component: SimpleCmp },
 *       { path: 'next', component: SimpleCmp }
 *     ]),
 *     StoreRouterConnectingModule.forRoot()
 *   ],
 *   bootstrap: [AppCmp]
 * })
 * export class AppModule {
 * }
 * ```
 */
@NgModule({})
export class StoreRouterConnectingModule {
  static forRoot<
    T extends BaseRouterStoreState = SerializedRouterStateSnapshot,
  >(
    config: StoreRouterConfig<T> = {}
  ): ModuleWithProviders<StoreRouterConnectingModule> {
    return {
      ngModule: StoreRouterConnectingModule,
      providers: [provideRouterStore(config)],
    };
  }
}
