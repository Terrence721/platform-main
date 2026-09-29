import { InjectionToken } from '@angular/core';

import { IdSelector, Comparer } from '@ngrx/entity';

import { EntityDispatcherDefaultOptions } from '../dispatchers/entity-dispatcher-default-options';
import { EntityFilterFn } from './entity-filters';

/**
 * Entity metadata maps, registered by EntityDefinitionService at startup.
 * A multi token: provide each map with `multi: true` (as `entityMetadata` in
 * the EntityDataModule/provideEntityData config does), so several modules can
 * each contribute one; injecting it gives the array of maps. A single map
 * provided without `multi` is accepted too.
 */
export const ENTITY_METADATA_TOKEN = new InjectionToken<EntityMetadataMap[]>(
  '@ngrx/data Entity Metadata'
);

/** Metadata that describe an entity type and its collection to @ngrx/data */
export interface EntityMetadata<T = any, S extends object = object> {
  /** The entity type's name, e.g. 'Hero'; surrounding spaces are trimmed. */
  entityName: string;
  /** Overrides of the dispatcher defaults for this entity type only. */
  entityDispatcherOptions?: Partial<EntityDispatcherDefaultOptions>;
  /**
   * Filters the collection by its `filter` pattern for the
   * `filteredEntities` selector; without one, that selector returns all
   * entities.
   */
  filterFn?: EntityFilterFn<T>;
  /** True to turn off change tracking for this collection (default false). */
  noChangeTracking?: boolean;
  /** Returns an entity's primary key; defaults to its `id` property. */
  selectId?: IdSelector<T>;
  /** Keeps the collection sorted; false (the default) leaves it unsorted. */
  sortComparer?: false | Comparer<T>;
  /**
   * Extra properties for the collection's state, with their initial values.
   * Each gets a selector named after it (`foo` -> `selectFoo`, `foo$`). A
   * name that the collection already uses is rejected: its state (`ids`,
   * `entities`, `entityName`, `filter`, `loaded`, `loading`, `changeState`)
   * or its selectors (`collection`, `count`, `entityActions`, `entityCache`,
   * `entityMap`, `errors`, `filteredEntities`, `keys`).
   */
  additionalCollectionState?: S;
}

/** Map entity-type name to its EntityMetadata */
export interface EntityMetadataMap {
  [entityName: string]: Partial<EntityMetadata<any>>;
}
