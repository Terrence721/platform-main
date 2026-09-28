import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MetaReducer, provideStore, Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import {
  ENTITY_CACHE_META_REDUCERS,
  ENTITY_CACHE_NAME,
  ENTITY_COLLECTION_META_REDUCERS,
  EntityActionFactory,
  EntityCache,
  EntityDataModuleConfig,
  EntityOp,
  provideEntityData,
} from '../';

describe('EntityDataModuleConfig', () => {
  const heroes = {
    ids: [1],
    entities: { 1: { id: 1, name: 'A' } },
    entityName: 'Hero',
    filter: '',
    loaded: true,
    loading: false,
    changeState: {},
  };

  async function initialCache(config: EntityDataModuleConfig) {
    TestBed.configureTestingModule({
      providers: [provideStore(), provideEntityData(config)],
    });
    const store = TestBed.inject(Store<Record<string, EntityCache>>);
    return firstValueFrom(store.select((state) => state[ENTITY_CACHE_NAME]));
  }

  it('should use initialEntityCacheState as the initial entity cache', async () => {
    const cache = await initialCache({
      initialEntityCacheState: { Hero: heroes },
    });
    expect(cache).toEqual({ Hero: heroes });
  });

  it('should accept initialEntityCacheState as a function', async () => {
    const cache = await initialCache({
      initialEntityCacheState: () => ({ Hero: heroes }),
    });
    expect(cache).toEqual({ Hero: heroes });
  });

  it('should start with an empty entity cache without it', async () => {
    expect(await initialCache({})).toEqual({});
  });

  describe('meta-reducers', () => {
    let seen: Set<string>;
    const recording =
      (name: string): MetaReducer<any, any> =>
      (reducer) =>
      (state, action) => {
        seen.add(name);
        return reducer(state, action);
      };

    beforeEach(() => (seen = new Set()));

    async function addHero(providers: Array<Provider | EnvironmentProviders>) {
      TestBed.configureTestingModule({
        providers: [provideStore(), ...providers],
      });
      const store = TestBed.inject(Store);
      store.dispatch(
        TestBed.inject(EntityActionFactory).create('Hero', EntityOp.ADD_ONE, {
          id: 1,
        })
      );
      await firstValueFrom(store.select((state) => state));
    }

    it('should apply the meta-reducers given in the config', async () => {
      await addHero([
        provideEntityData({
          entityMetadata: { Hero: {} },
          entityCacheMetaReducers: [recording('cache')],
          entityCollectionMetaReducers: [recording('collection')],
        }),
      ]);
      expect([...seen]).toEqual(['cache', 'collection']);
    });

    it('should keep meta-reducer tokens provided before provideEntityData when the config has none', async () => {
      await addHero([
        { provide: ENTITY_CACHE_META_REDUCERS, useValue: [recording('cache')] },
        {
          provide: ENTITY_COLLECTION_META_REDUCERS,
          useValue: [recording('collection')],
        },
        provideEntityData({ entityMetadata: { Hero: {} } }),
      ]);
      expect([...seen]).toEqual(['cache', 'collection']);
    });
  });
});
