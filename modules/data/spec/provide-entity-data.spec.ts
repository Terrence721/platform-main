import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';

import {
  DefaultDataServiceFactory,
  DefaultHttpUrlGenerator,
  DefaultPersistenceResultHandler,
  DefaultPluralizer,
  ENTITY_CACHE_META_REDUCERS,
  ENTITY_COLLECTION_META_REDUCERS,
  ENTITY_METADATA_TOKEN,
  EntityActionFactory,
  EntityCacheDataService,
  EntityCacheEffects,
  EntityDataModuleConfig,
  EntityDataService,
  EntityEffects,
  EntityOp,
  HttpUrlGenerator,
  INITIAL_ENTITY_CACHE_STATE,
  PersistenceResultHandler,
  PLURAL_NAMES_TOKEN,
  Pluralizer,
  provideEntityData,
  withEffects,
} from '../';
// Not in the public API: provideEntityData and EntityDataModule build on it.
import { provideEntityDataConfig } from '../src/provide-entity-data';

describe('withEffects', () => {
  const effectsServices: Type<unknown>[] = [
    DefaultDataServiceFactory,
    EntityCacheDataService,
    EntityDataService,
    EntityCacheEffects,
    EntityEffects,
  ];

  it('should not provide the effects and data services without it', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore(),
        provideEntityData({ entityMetadata: { Hero: {} } }),
      ],
    });

    for (const service of effectsServices) {
      expect(TestBed.inject(service, null)).toBeNull();
    }
  });

  it('should provide the effects, data services and their defaults', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore(),
        provideEffects(),
        provideHttpClient(),
        provideEntityData({ entityMetadata: { Hero: {} } }, withEffects()),
      ],
    });

    for (const service of effectsServices) {
      expect(TestBed.inject(service)).toBeInstanceOf(service);
    }
    expect(TestBed.inject(HttpUrlGenerator)).toBeInstanceOf(
      DefaultHttpUrlGenerator
    );
    expect(TestBed.inject(PersistenceResultHandler)).toBeInstanceOf(
      DefaultPersistenceResultHandler
    );
    expect(TestBed.inject(Pluralizer)).toBeInstanceOf(DefaultPluralizer);
  });

  it('should register the entity effects, so a query reaches the server', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore(),
        provideEffects(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideEntityData(
          { entityMetadata: { Hero: {} }, pluralNames: { Hero: 'Heroes' } },
          withEffects()
        ),
      ],
    });
    const store = TestBed.inject(Store);
    const http = TestBed.inject(HttpTestingController);

    store.dispatch(
      TestBed.inject(EntityActionFactory).create('Hero', EntityOp.QUERY_ALL)
    );

    http.expectOne({ method: 'GET', url: 'api/heroes/' });
    http.verify();
  });
});

describe('provideEntityDataConfig', () => {
  function inject<T>(
    config: EntityDataModuleConfig,
    token: Parameters<typeof TestBed.inject<T>>[0]
  ): T | null {
    TestBed.configureTestingModule({
      providers: provideEntityDataConfig(config),
    });
    return TestBed.inject(token, null);
  }

  it('should provide the plural names and entity metadata as multi providers', () => {
    const config = {
      entityMetadata: { Hero: {} },
      pluralNames: { Hero: 'Heroes' },
    };
    TestBed.configureTestingModule({
      providers: provideEntityDataConfig(config),
    });

    expect(TestBed.inject(PLURAL_NAMES_TOKEN)).toEqual([{ Hero: 'Heroes' }]);
    expect(TestBed.inject(ENTITY_METADATA_TOKEN)).toEqual([{ Hero: {} }]);
  });

  it('should provide empty plural names and metadata by default', () => {
    TestBed.configureTestingModule({ providers: provideEntityDataConfig({}) });

    expect(TestBed.inject(PLURAL_NAMES_TOKEN)).toEqual([{}]);
    expect(TestBed.inject(ENTITY_METADATA_TOKEN)).toEqual([[]]);
  });

  it('should provide the meta-reducers and initial state only when set', () => {
    expect(inject({}, ENTITY_CACHE_META_REDUCERS)).toBeNull();
    TestBed.resetTestingModule();
    expect(inject({}, ENTITY_COLLECTION_META_REDUCERS)).toBeNull();
    TestBed.resetTestingModule();
    expect(inject({}, INITIAL_ENTITY_CACHE_STATE)).toBeNull();
  });

  it('should provide the meta-reducers and initial state it is given', () => {
    const config: EntityDataModuleConfig = {
      entityCacheMetaReducers: [(reducer) => reducer],
      entityCollectionMetaReducers: [(reducer) => reducer],
      initialEntityCacheState: {},
    };
    TestBed.configureTestingModule({
      providers: provideEntityDataConfig(config),
    });

    expect(TestBed.inject(ENTITY_CACHE_META_REDUCERS)).toBe(
      config.entityCacheMetaReducers
    );
    expect(TestBed.inject(ENTITY_COLLECTION_META_REDUCERS)).toBe(
      config.entityCollectionMetaReducers
    );
    expect(TestBed.inject(INITIAL_ENTITY_CACHE_STATE)).toBe(
      config.initialEntityCacheState
    );
  });
});
