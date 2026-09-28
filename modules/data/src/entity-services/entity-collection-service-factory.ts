import { Injectable } from '@angular/core';
import { EntityCollectionServiceBase } from './entity-collection-service-base';
import { EntityCollectionServiceElementsFactory } from './entity-collection-service-elements-factory';
import { EntitySelectors$ } from '../selectors/entity-selectors$';

/**
 * Creates EntityCollectionService instances for
 * a cached collection of T entities in the ngrx store.
 */
@Injectable()
export class EntityCollectionServiceFactory {
  constructor(
    /** Creates the core elements of the EntityCollectionService for an entity type. */
    public entityCollectionServiceElementsFactory: EntityCollectionServiceElementsFactory
  ) {}

  /**
   * Create an EntityCollectionService for an entity type
   * @param entityName - name of the entity type
   * @returns the service; its `selectors$` are typed as `S$`, so selectors$
   * for `additionalCollectionState` properties keep their types
   * @throws if the entity type has no registered EntityDefinition
   */
  create<T, S$ extends EntitySelectors$<T> = EntitySelectors$<T>>(
    entityName: string
  ): EntityCollectionServiceBase<T, S$> {
    return new EntityCollectionServiceBase<T, S$>(
      entityName,
      this.entityCollectionServiceElementsFactory
    );
  }
}
