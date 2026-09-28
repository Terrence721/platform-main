import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import {
  ENTITY_CACHE_NAME,
  EntityCache,
  EntityDataModuleConfig,
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
});
