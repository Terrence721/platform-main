import { of } from 'rxjs';
import {
  EntityAction,
  EntityActionOptions,
  EntityCollectionService,
  EntityCollectionServiceBase,
  EntityCollectionServiceElementsFactory,
  EntityOp,
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
    service = new EntityCollectionServiceBase<Hero>(
      'Hero',
      elementsFactory(dispatcher, {})
    );
  });

  function elementsFactory(dispatcher: object, selectors$: object) {
    return {
      create: () => ({ dispatcher, selectors: {}, selectors$ }),
    } as unknown as EntityCollectionServiceElementsFactory;
  }

  it('exposes custom selectors$ on the service, without replacing its own members', () => {
    const entities$ = of([]);
    const foo$ = of('Foo');
    // Typed as apps get it from EntityServices: the interface is what offers
    // custom selectors$ on the service.
    const custom: EntityCollectionService<Hero> =
      new EntityCollectionServiceBase<Hero>(
        'Hero',
        elementsFactory(
          {},
          { entityName: 'Hero', entities$, foo$, add: 'not the add command' }
        )
      );

    expect(custom.foo$).toBe(foo$);
    expect(custom.selectors$.foo$).toBe(foo$);
    expect(custom.entities$).toBe(entities$);
    expect(custom.add).toBe(EntityCollectionServiceBase.prototype.add);
  });

  it('types createEntityAction by its data, not by the entity type', () => {
    const collectionService: EntityCollectionService<Hero> = service;
    expectTypeOf(
      collectionService.createEntityAction(EntityOp.QUERY_BY_KEY, 42)
    ).toEqualTypeOf<EntityAction<number>>();
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
