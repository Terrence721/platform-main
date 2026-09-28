import { EntityCollection } from './entity-collection';

/**
 * The @ngrx/data state: every cached entity collection, keyed by entity name.
 * Stored in the store's root state under the cache name (`entityCache` by
 * default).
 *
 * A collection is only there once an action for its entity type has been
 * reduced (or the initial cache state included it), so a name can be missing
 * even though the type says otherwise: check before reading a collection from
 * the cache directly.
 */
export interface EntityCache {
  // Must be `any` since we don't know what type of collections we will have
  [name: string]: EntityCollection<any>;
}
