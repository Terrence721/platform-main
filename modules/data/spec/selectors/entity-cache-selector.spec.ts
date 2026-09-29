import { TestBed } from '@angular/core/testing';
import {
  createEntityCacheSelector,
  ENTITY_CACHE_NAME_TOKEN,
  ENTITY_CACHE_SELECTOR_TOKEN,
  EntityCache,
  entityCacheSelectorProvider,
} from '../..';

describe('EntityCacheSelector', () => {
  const cache: EntityCache = {};

  it('selects the cache under the default name', () => {
    expect(createEntityCacheSelector()({ entityCache: cache })).toBe(cache);
  });

  it('selects the cache under a custom name', () => {
    expect(createEntityCacheSelector('myCache')({ myCache: cache })).toBe(
      cache
    );
  });

  it('is provided for the default name when there is no ENTITY_CACHE_NAME_TOKEN', () => {
    TestBed.configureTestingModule({
      providers: [entityCacheSelectorProvider],
    });
    const selector = TestBed.inject(ENTITY_CACHE_SELECTOR_TOKEN);
    expect(selector({ entityCache: cache })).toBe(cache);
  });

  it('is provided for the name in ENTITY_CACHE_NAME_TOKEN', () => {
    TestBed.configureTestingModule({
      providers: [
        entityCacheSelectorProvider,
        { provide: ENTITY_CACHE_NAME_TOKEN, useValue: 'myCache' },
      ],
    });
    const selector = TestBed.inject(ENTITY_CACHE_SELECTOR_TOKEN);
    expect(selector({ myCache: cache })).toBe(cache);
  });
});
