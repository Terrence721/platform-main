import { InjectionToken, Optional, FactoryProvider } from '@angular/core';
import { createFeatureSelector, MemoizedSelector } from '@ngrx/store';
import { EntityCache } from '../reducers/entity-cache';
import {
  ENTITY_CACHE_NAME,
  ENTITY_CACHE_NAME_TOKEN,
} from '../reducers/constants';

/** The selector of the EntityCache from the store's root state. */
export const ENTITY_CACHE_SELECTOR_TOKEN = new InjectionToken<
  MemoizedSelector<Object, EntityCache>
>('@ngrx/data Entity Cache Selector');

/**
 * Provides ENTITY_CACHE_SELECTOR_TOKEN for the cache name in
 * ENTITY_CACHE_NAME_TOKEN, or ENTITY_CACHE_NAME without one.
 */
export const entityCacheSelectorProvider: FactoryProvider = {
  provide: ENTITY_CACHE_SELECTOR_TOKEN,
  useFactory: createEntityCacheSelector,
  deps: [[new Optional(), ENTITY_CACHE_NAME_TOKEN]],
};

/** Selects the EntityCache from the store's root state. */
export type EntityCacheSelector = MemoizedSelector<Object, EntityCache>;

/**
 * Creates the selector of the EntityCache: the store's root state property
 * named entityCacheName.
 * @param [entityCacheName] name of the cache in the root state;
 * ENTITY_CACHE_NAME when not given
 */
export function createEntityCacheSelector(
  entityCacheName?: string
): MemoizedSelector<Object, EntityCache> {
  entityCacheName = entityCacheName || ENTITY_CACHE_NAME;
  return createFeatureSelector<EntityCache>(entityCacheName);
}
