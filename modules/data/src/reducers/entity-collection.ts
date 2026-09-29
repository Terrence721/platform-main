import { EntityState, Dictionary } from '@ngrx/entity';

/** Types of change in a ChangeState instance */
export enum ChangeType {
  /**
   * The entity has not changed from its last known server state.
   * Not stored by the change tracker: an entity without changes has no
   * changeState entry.
   */
  Unchanged = 0,
  /** The entity was added to the collection */
  Added,
  /** The entity is scheduled for delete and was removed from the collection */
  Deleted,
  /** The entity in the collection was updated */
  Updated,
}

/**
 * Change state for an entity with unsaved changes;
 * an entry in an EntityCollection.changeState map
 */
export interface ChangeState<T> {
  changeType: ChangeType;
  originalValue?: T | undefined;
}

/**
 * Map of entity primary keys to entity ChangeStates.
 * Each entry represents an entity with unsaved changes.
 */
export type ChangeStateMap<T> = Dictionary<ChangeState<T>>;

/**
 * Data and information about a collection of entities of a single type.
 * EntityCollections are maintained in the EntityCache within the ngrx store.
 */
export interface EntityCollection<T = any> extends EntityState<T> {
  /** Name of the entity type for this collection */
  entityName: string;
  /** A map of ChangeStates, keyed by id, for entities with unsaved changes */
  changeState: ChangeStateMap<T>;
  /**
   * The user's current collection filter pattern, used by the collection's
   * filterFn. Typed as a string, although setFilter accepts any pattern
   * the filterFn understands (the default one also takes a RegExp).
   */
  filter?: string;
  /**
   * true once the collection has been filled: set by a successful
   * query-all, query-many or load, and by ADD_ALL; false again after
   * REMOVE_ALL (SET_LOADED sets it directly).
   */
  loaded: boolean;
  /**
   * true while a query or save operation is in progress. A single flag, not
   * a count: the first operation to succeed, fail or be canceled turns it off,
   * even if another is still pending.
   */
  loading: boolean;
}
