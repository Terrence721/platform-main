import { Injectable, Optional } from '@angular/core';

import { EntityCollection } from './entity-collection';
import { EntityDefinitionService } from '../entity-metadata/entity-definition.service';

/**
 * Creates the starting collection for an entity type: its registered
 * definition's initial state, or an empty collection when it has none
 * (or no EntityDefinitionService is provided).
 */
@Injectable()
export class EntityCollectionCreator {
  constructor(
    @Optional() private entityDefinitionService?: EntityDefinitionService
  ) {}

  /**
   * Create the default collection for an entity type.
   * @param entityName {string} entity type name
   */
  create<T = any, S extends EntityCollection<T> = EntityCollection<T>>(
    entityName: string
  ): S {
    const def =
      this.entityDefinitionService &&
      this.entityDefinitionService.getDefinition<T>(
        entityName,
        false /*shouldThrow*/
      );

    const initialState = def && def.initialState;

    return <S>(initialState || createEmptyEntityCollection<T>(entityName));
  }
}

/**
 * An empty collection: no entities, not loaded or loading, no tracked changes
 * and no filter.
 * @param [entityName] name of the entity type
 */
export function createEmptyEntityCollection<T>(
  entityName?: string
): EntityCollection<T> {
  return {
    entityName,
    ids: [],
    entities: {},
    filter: undefined,
    loaded: false,
    loading: false,
    changeState: {},
  } as EntityCollection<T>;
}
