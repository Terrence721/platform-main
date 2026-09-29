import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { Comparer, IdSelector } from '@ngrx/entity';

import { EntityDispatcherDefaultOptions } from '../dispatchers/entity-dispatcher-default-options';
import { defaultSelectId } from '../utils/utilities';
import { EntityCollection } from '../reducers/entity-collection';
import { EntityMetadata } from './entity-metadata';

export interface EntityDefinition<T = any> {
  entityName: string;
  entityAdapter: EntityAdapter<T>;
  entityDispatcherOptions?: Partial<EntityDispatcherDefaultOptions>;
  initialState: EntityCollection<T>;
  metadata: EntityMetadata<T>;
  noChangeTracking: boolean;
  selectId: IdSelector<T>;
  sortComparer: false | Comparer<T>;
}

/** Names whose selector or selector$ the collection already has. */
const reservedSelectorNames = [
  'collection',
  'count',
  'entityActions',
  'entityCache',
  'entityMap',
  'errors',
  'filteredEntities',
  'keys',
];

export function createEntityDefinition<T, S extends object>(
  entityMetadata: EntityMetadata<T, S>
): EntityDefinition<T> {
  if (!entityMetadata.entityName) {
    throw new Error('Missing required entityName');
  }
  const entityName = entityMetadata.entityName.trim();
  const sortComparer = entityMetadata.sortComparer || false;
  // A normalized copy: the caller's metadata object is not modified, so it
  // can be shared or frozen.
  const metadata: EntityMetadata<T, S> = {
    ...entityMetadata,
    entityName,
    sortComparer,
  };
  const selectId = metadata.selectId || (defaultSelectId as IdSelector<T>);

  const entityAdapter = createEntityAdapter<T>({
    selectId,
    sortComparer,
  });

  const entityDispatcherOptions: Partial<EntityDispatcherDefaultOptions> =
    metadata.entityDispatcherOptions || {};

  const collectionState: EntityCollection<T> = entityAdapter.getInitialState({
    entityName,
    filter: '',
    loaded: false,
    loading: false,
    changeState: {},
  });
  const additionalCollectionState = metadata.additionalCollectionState || {};
  // An extra property named like a built-in one would replace its value and
  // its selector, corrupting the collection. The other names below are not
  // state, but an extra property's selector(s$) would clash with the built-in
  // select<Name> / <name>$ (e.g. `count` would replace `selectCount`).
  const reserved = Object.keys(additionalCollectionState).filter(
    (key) =>
      Object.prototype.hasOwnProperty.call(collectionState, key) ||
      reservedSelectorNames.includes(key)
  );
  if (reserved.length) {
    throw new Error(
      `additionalCollectionState for "${entityName}" uses reserved name(s): ${reserved.join(', ')}`
    );
  }
  const initialState: EntityCollection<T> = {
    ...collectionState,
    ...additionalCollectionState,
  };

  const noChangeTracking = metadata.noChangeTracking === true; // false by default

  return {
    entityName,
    entityAdapter,
    entityDispatcherOptions,
    initialState,
    metadata,
    noChangeTracking,
    selectId,
    sortComparer,
  };
}
