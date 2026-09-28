import {
  EntityActionOptions,
  EntityCollectionServiceBase,
  EntityCollectionServiceElementsFactory,
} from '../..';

interface Hero {
  id: number;
  name: string;
}

describe('EntityCollectionServiceBase', () => {
  let calls: Record<string, unknown[]>;
  let service: EntityCollectionServiceBase<Hero>;
  const options: EntityActionOptions = { tag: 'test-tag' };

  beforeEach(() => {
    calls = {};
    // A dispatcher that records the arguments of every method called on it.
    const dispatcher = new Proxy(
      {},
      {
        get:
          (_target, method: string) =>
          (...args: unknown[]) => {
            calls[method] = args;
          },
      }
    );
    const factory = {
      create: () => ({ dispatcher, selectors: {}, selectors$: {} }),
    } as unknown as EntityCollectionServiceElementsFactory;
    service = new EntityCollectionServiceBase<Hero>('Hero', factory);
  });

  it('passes options through to the dispatcher for the cache commands', () => {
    service.clearCache(options);
    service.setFilter('B', options);
    service.setLoaded(true, options);
    service.setLoading(false, options);

    expect(calls['clearCache']).toEqual([options]);
    expect(calls['setFilter']).toEqual(['B', options]);
    expect(calls['setLoaded']).toEqual([true, options]);
    expect(calls['setLoading']).toEqual([false, options]);
  });

  it('adds a partial entity without options (pessimistic add, server-assigned key)', () => {
    // Compiles only because a partial entity is allowed without options,
    // as it is on the dispatcher.
    service.add({ name: 'New Hero' });
    expect(calls['add']).toEqual([{ name: 'New Hero' }, undefined]);
  });
});
