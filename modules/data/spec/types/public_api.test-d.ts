import { EnvironmentProviders, ModuleWithProviders } from '@angular/core';
import { Dictionary, Update } from '@ngrx/entity';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162).
import * as data from '@ngrx/data';
import {
  ChangeSetItem,
  ChangeSetOperation,
  DefaultDataService,
  EntityAction,
  EntityCache,
  EntityCollection,
  EntityCollectionDataService,
  EntityCollectionService,
  EntityCollectionServiceBase,
  EntityCollectionServiceElementsFactory,
  EntityCollectionServiceFactory,
  EntityDataModule,
  EntityDataModuleConfig,
  EntityDispatcher,
  EntityMetadataMap,
  EntityOp,
  EntityServices,
  makeErrorOp,
  makeSuccessOp,
  MergeStrategy,
  provideEntityData,
  withEffects,
} from '@ngrx/data';

interface Hero {
  id: number;
  name: string;
}
declare const heroes: EntityCollectionService<Hero>;
declare const factory: EntityCollectionServiceFactory;
declare const services: EntityServices;

describe('@ngrx/data public types', () => {
  it('exports every runtime value, and only those', () => {
    // Interfaces and type aliases are not values; they are checked below
    // where they are used.
    expectTypeOf<keyof typeof data>().toEqualTypeOf<
      | 'ChangeSetItemFactory'
      | 'changeSetItemFactory'
      | 'ChangeSetOperation'
      | 'ChangeType'
      | 'ClearCollections'
      | 'CorrelationIdGenerator'
      | 'createEmptyEntityCollection'
      | 'createEntityCacheSelector'
      | 'createEntityDefinition'
      | 'DataServiceError'
      | 'DefaultDataService'
      | 'DefaultDataServiceConfig'
      | 'DefaultDataServiceFactory'
      | 'DefaultHttpUrlGenerator'
      | 'DefaultLogger'
      | 'DefaultPersistenceResultHandler'
      | 'DefaultPluralizer'
      | 'defaultSelectId'
      | 'EntityActionFactory'
      | 'EntityActionGuard'
      | 'EntityCacheAction'
      | 'EntityCacheDataService'
      | 'EntityCacheDispatcher'
      | 'EntityCacheEffects'
      | 'EntityCacheReducerFactory'
      | 'entityCacheSelectorProvider'
      | 'EntityChangeTrackerBase'
      | 'EntityCollectionCreator'
      | 'EntityCollectionReducerFactory'
      | 'EntityCollectionReducerMethods'
      | 'EntityCollectionReducerMethodsFactory'
      | 'EntityCollectionReducerRegistry'
      | 'EntityCollectionServiceBase'
      | 'EntityCollectionServiceElementsFactory'
      | 'EntityCollectionServiceFactory'
      | 'EntityDataModule'
      | 'EntityDataModuleWithoutEffects'
      | 'EntityDataService'
      | 'EntityDefinitionService'
      | 'EntityDispatcherBase'
      | 'EntityDispatcherDefaultOptions'
      | 'EntityDispatcherFactory'
      | 'EntityEffects'
      | 'EntityHttpResourceUrls'
      | 'EntityOp'
      | 'EntitySelectors$Factory'
      | 'EntitySelectorsFactory'
      | 'EntityServices'
      | 'EntityServicesBase'
      | 'EntityServicesElements'
      | 'ENTITY_CACHE_META_REDUCERS'
      | 'ENTITY_CACHE_NAME'
      | 'ENTITY_CACHE_NAME_TOKEN'
      | 'ENTITY_CACHE_SELECTOR_TOKEN'
      | 'ENTITY_COLLECTION_META_REDUCERS'
      | 'ENTITY_EFFECTS_SCHEDULER'
      | 'ENTITY_METADATA_TOKEN'
      | 'excludeEmptyChangeSetItems'
      | 'flattenArgs'
      | 'getGuid'
      | 'getGuidComb'
      | 'guidComparer'
      | 'HttpUrlGenerator'
      | 'INITIAL_ENTITY_CACHE_STATE'
      | 'LoadCollections'
      | 'Logger'
      | 'makeErrorOp'
      | 'makeSuccessOp'
      | 'MergeQuerySet'
      | 'MergeStrategy'
      | 'normalizeRoot'
      | 'ofEntityOp'
      | 'ofEntityType'
      | 'OP_ERROR'
      | 'OP_SUCCESS'
      | 'PersistenceCanceled'
      | 'PersistenceResultHandler'
      | 'persistOps'
      | 'Pluralizer'
      | 'PLURAL_NAMES_TOKEN'
      | 'PropsFilterFnFactory'
      | 'provideEntityData'
      | 'SaveEntities'
      | 'SaveEntitiesCancel'
      | 'SaveEntitiesCanceled'
      | 'SaveEntitiesError'
      | 'SaveEntitiesSuccess'
      | 'SetEntityCache'
      | 'toUpdateFactory'
      | 'withEffects'
    >();
  });

  describe('EntityCollectionService', () => {
    it('the server commands return terminating Observables of the result', () => {
      expectTypeOf(heroes.add).returns.toEqualTypeOf<Observable<Hero>>();
      expectTypeOf(heroes.delete).returns.toEqualTypeOf<
        Observable<number | string>
      >();
      expectTypeOf(heroes.getAll).returns.toEqualTypeOf<Observable<Hero[]>>();
      expectTypeOf(heroes.getByKey).returns.toEqualTypeOf<Observable<Hero>>();
      expectTypeOf(heroes.getWithQuery).returns.toEqualTypeOf<
        Observable<Hero[]>
      >();
      expectTypeOf(heroes.load).returns.toEqualTypeOf<Observable<Hero[]>>();
      expectTypeOf(heroes.loadWithQuery).returns.toEqualTypeOf<
        Observable<Hero[]>
      >();
      expectTypeOf(heroes.update).returns.toEqualTypeOf<Observable<Hero>>();
      expectTypeOf(heroes.upsert).returns.toEqualTypeOf<Observable<Hero>>();
      expectTypeOf(heroes.update).parameter(0).toEqualTypeOf<Partial<Hero>>();
    });

    it('the cache commands return nothing', () => {
      expectTypeOf(heroes.addAllToCache).returns.toBeVoid();
      expectTypeOf(heroes.addOneToCache).returns.toBeVoid();
      expectTypeOf(heroes.clearCache).returns.toBeVoid();
      expectTypeOf(heroes.setFilter).returns.toBeVoid();
      expectTypeOf(heroes.updateOneInCache)
        .parameter(0)
        .toEqualTypeOf<Partial<Hero>>();
    });

    it('the selectors$ are Observables of the collection’s state', () => {
      expectTypeOf(heroes.entities$).toEqualTypeOf<Observable<Hero[]>>();
      expectTypeOf(heroes.filteredEntities$).toEqualTypeOf<
        Observable<Hero[]>
      >();
      expectTypeOf(heroes.entityMap$).toEqualTypeOf<
        Observable<Dictionary<Hero>>
      >();
      expectTypeOf(heroes.keys$).toEqualTypeOf<
        Observable<string[] | number[]>
      >();
      expectTypeOf(heroes.count$).toEqualTypeOf<Observable<number>>();
      expectTypeOf(heroes.loading$).toEqualTypeOf<Observable<boolean>>();
      expectTypeOf(heroes.loaded$).toEqualTypeOf<Observable<boolean>>();
      expectTypeOf(heroes.errors$).toEqualTypeOf<Observable<EntityAction>>();
    });

    it('its dispatcher works on the root store, not the cache (#571)', () => {
      expectTypeOf<EntityDispatcher<Hero>['store']>().toEqualTypeOf<
        Store<object>
      >();
      expectTypeOf(heroes.dispatcher).toEqualTypeOf<EntityDispatcher<Hero>>();
    });
  });

  describe('creating collection services', () => {
    it('the factory and EntityServices create typed services', () => {
      expectTypeOf(factory.create<Hero>('Hero')).toEqualTypeOf<
        EntityCollectionServiceBase<Hero>
      >();
      expectTypeOf(factory.create<Hero>('Hero')).toExtend<
        EntityCollectionService<Hero>
      >();
      expectTypeOf(
        services.getEntityCollectionService<Hero>('Hero')
      ).toEqualTypeOf<EntityCollectionService<Hero>>();
    });

    it('a service class extends EntityCollectionServiceBase', () => {
      class HeroService extends EntityCollectionServiceBase<Hero> {
        constructor(elements: EntityCollectionServiceElementsFactory) {
          super('Hero', elements);
        }
      }
      expectTypeOf<HeroService>().toExtend<EntityCollectionService<Hero>>();
    });
  });

  describe('configuration', () => {
    it('the metadata map takes per-entity options', () => {
      const metadata: EntityMetadataMap = {
        Hero: { selectId: (hero: Hero) => hero.id },
        Villain: {},
      };
      expectTypeOf<EntityDataModuleConfig['entityMetadata']>().toEqualTypeOf<
        EntityMetadataMap | undefined
      >();
      expectTypeOf(
        provideEntityData({ entityMetadata: metadata }, withEffects())
      ).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(
        EntityDataModule.forRoot({ entityMetadata: metadata })
      ).toEqualTypeOf<ModuleWithProviders<EntityDataModule>>();
    });

    it('the data service sends and returns entities', () => {
      expectTypeOf<DefaultDataService<Hero>>().toExtend<
        EntityCollectionDataService<Hero>
      >();
      expectTypeOf<EntityCollectionDataService<Hero>['update']>()
        .parameter(0)
        .toEqualTypeOf<Update<Hero>>();
    });
  });

  describe('state and actions', () => {
    it('the cache maps entity names to collections', () => {
      expectTypeOf<EntityCache[string]>().toEqualTypeOf<
        EntityCollection<any>
      >();
      expectTypeOf<EntityCollection<Hero>['entities']>().toEqualTypeOf<
        Dictionary<Hero>
      >();
    });

    it('an entity action carries its entity name and operation', () => {
      expectTypeOf<
        EntityAction<Hero>['payload']['entityOp']
      >().toEqualTypeOf<EntityOp>();
      expectTypeOf<EntityAction<Hero>['payload']['data']>().toEqualTypeOf<
        Hero | undefined
      >();
      expectTypeOf(makeSuccessOp).returns.toEqualTypeOf<EntityOp>();
      expectTypeOf(makeErrorOp).returns.toEqualTypeOf<EntityOp>();
    });

    it('a change set item is one of the four operations', () => {
      expectTypeOf<ChangeSetItem['op']>().toEqualTypeOf<ChangeSetOperation>();
      expectTypeOf<`${MergeStrategy}`>().toBeString();
    });
  });
});
