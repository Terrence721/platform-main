import { InjectionToken } from '@angular/core';
import { MetaReducer } from '@ngrx/store';
import { EntityCache } from './entity-cache';

/** Default name of the EntityCache: its key in the store's root state. */
export const ENTITY_CACHE_NAME = 'entityCache';

/**
 * Optional: a custom name for the EntityCache, its key in the store's root
 * state. Not provided by @ngrx/data, so its value is used in any provider
 * order; without it the name is ENTITY_CACHE_NAME. Inject it with
 * `{ optional: true }` and fall back to ENTITY_CACHE_NAME.
 */
export const ENTITY_CACHE_NAME_TOKEN = new InjectionToken<string>(
  '@ngrx/data Entity Cache Name'
);

/**
 * Meta-reducers applied to the EntityCache reducer. An entry may also be an
 * InjectionToken of a meta-reducer, which is injected.
 * Set by `entityCacheMetaReducers` in the EntityData config.
 */
export const ENTITY_CACHE_META_REDUCERS = new InjectionToken<
  Array<MetaReducer<any, any> | InjectionToken<MetaReducer<any, any>>>
>('@ngrx/data Entity Cache Meta Reducers');

/**
 * Meta-reducers applied to every entity collection's reducer.
 * Set by `entityCollectionMetaReducers` in the EntityData config.
 */
export const ENTITY_COLLECTION_META_REDUCERS = new InjectionToken<
  MetaReducer<any, any>[]
>('@ngrx/data Entity Collection Meta Reducers');

/**
 * Initial EntityCache state, or a function that returns it.
 * Set by `initialEntityCacheState` in the EntityData config.
 */
export const INITIAL_ENTITY_CACHE_STATE = new InjectionToken<
  EntityCache | (() => EntityCache)
>('@ngrx/data Initial Entity Cache State');
