import { TestBed } from '@angular/core/testing';
import { Store, StoreModule } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import {
  ENTITY_CACHE_NAME,
  EntityCache,
  EntityDataModuleWithoutEffects,
  EntityDataService,
  EntityEffects,
  EntityServices,
} from '../';

interface Hero {
  id: number;
  name: string;
}

describe('EntityDataModuleWithoutEffects', () => {
  const initialHeroes = {
    ids: [1],
    entities: { 1: { id: 1, name: 'A' } },
    entityName: 'Hero',
    filter: '',
    loaded: true,
    loading: false,
    changeState: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
        EntityDataModuleWithoutEffects.forRoot({
          entityMetadata: { Hero: {} },
          initialEntityCacheState: { Hero: initialHeroes },
        }),
      ],
    });
  });

  const entityCache = () =>
    firstValueFrom(
      TestBed.inject(Store<Record<string, EntityCache>>).select(
        (state) => state[ENTITY_CACHE_NAME]
      )
    );

  it('should register the entity cache with the configured initial state', async () => {
    expect(await entityCache()).toEqual({ Hero: initialHeroes });
  });

  it('should apply cache-only commands without effects or HTTP', async () => {
    const heroes =
      TestBed.inject(EntityServices).getEntityCollectionService<Hero>('Hero');

    heroes.addOneToCache({ id: 2, name: 'B' });

    const cache = await entityCache();
    expect(cache['Hero'].entities).toEqual({
      1: { id: 1, name: 'A' },
      2: { id: 2, name: 'B' },
    });
  });

  it('should not provide the effects or the HTTP data services', () => {
    expect(TestBed.inject(EntityEffects, null)).toBeNull();
    expect(TestBed.inject(EntityDataService, null)).toBeNull();
  });
});
