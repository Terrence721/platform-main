import { InjectionToken } from '@angular/core';
import { MetaReducer } from '@ngrx/store';
import { EntityCache } from './reducers/entity-cache';
import { EntityAction } from './actions/entity-action';
import { EntityMetadataMap } from './entity-metadata/entity-metadata';
import { EntityCollection } from './reducers/entity-collection';

/**
 * Configuration for `provideEntityData()` and `EntityDataModule.forRoot()`.
 */
export interface EntityDataModuleConfig {
  /** Metadata for each entity type, keyed by entity name. */
  entityMetadata?: EntityMetadataMap;
  /**
   * Meta-reducers for the whole entity cache. An `InjectionToken` is
   * resolved with `inject()`, so a meta-reducer can have dependencies.
   */
  entityCacheMetaReducers?: (
    MetaReducer<EntityCache> | InjectionToken<MetaReducer<EntityCache>>
  )[];
  /** Meta-reducers applied to every entity collection's reducer. */
  entityCollectionMetaReducers?: MetaReducer<EntityCollection, EntityAction>[];
  /** Initial EntityCache state, or a function that returns that state. */
  initialEntityCacheState?: EntityCache | (() => EntityCache);
  /**
   * Plural names for entity types whose plural the default pluralizer gets
   * wrong, keyed by entity name (used to build collection resource URLs).
   */
  pluralNames?: { [name: string]: string };
}
