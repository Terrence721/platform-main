import { Action, ScannedActionsSubject, Store } from '@ngrx/store';
import { of } from 'rxjs';
import { vi } from 'vitest';

import {
  CorrelationIdGenerator,
  createEntityCacheSelector,
  EntityAction,
  EntityActionFactory,
  EntityCache,
  EntityDispatcherDefaultOptions,
  EntityDispatcherFactory,
} from '../../';

interface Hero {
  id: number;
  name: string;
}

describe('EntityDispatcherFactory', () => {
  let dispatched: Action[];
  let scannedActions$: ScannedActionsSubject;
  let factory: EntityDispatcherFactory;

  beforeEach(() => {
    dispatched = [];
    scannedActions$ = new ScannedActionsSubject();
    const store = {
      dispatch: vi.fn((action: Action) => dispatched.push(action)),
      select: vi.fn(() => of({})),
    } as unknown as Store<EntityCache>;
    factory = new EntityDispatcherFactory(
      new EntityActionFactory(),
      store,
      new EntityDispatcherDefaultOptions(),
      scannedActions$,
      createEntityCacheSelector(),
      new CorrelationIdGenerator()
    );
  });

  const lastIsOptimistic = () =>
    (dispatched.at(-1) as EntityAction).payload.isOptimistic;

  it('should use the injected defaults (pessimistic add, optimistic delete)', () => {
    const dispatcher = factory.create<Hero>('Hero');

    dispatcher.add({ id: 1, name: 'A' });
    expect(lastIsOptimistic()).toBe(false);
    dispatcher.delete(1);
    expect(lastIsOptimistic()).toBe(true);
  });

  it("should let an entity's options override only the defaults they name", () => {
    const dispatcher = factory.create<Hero>('Hero', undefined, {
      optimisticAdd: true,
    });

    dispatcher.add({ id: 1, name: 'A' });
    expect(lastIsOptimistic()).toBe(true);
    dispatcher.delete(1);
    expect(lastIsOptimistic()).toBe(true); // still the injected default
    dispatcher.update({ id: 1, name: 'B' });
    expect(lastIsOptimistic()).toBe(false); // still the injected default
  });

  it('should use the given id selector', () => {
    const dispatcher = factory.create<{ key: string }>('Villain', (v) => v.key);

    dispatcher.delete({ key: 'v1' });
    expect((dispatched.at(-1) as EntityAction).payload.data).toBe('v1');
  });

  it('should replay the latest reduced action to a late subscriber, until destroyed', () => {
    const action = { type: 'latest' };
    scannedActions$.next(action);

    let seen: Action | undefined;
    factory.reducedActions$.subscribe((a) => (seen = a)).unsubscribe();
    expect(seen).toBe(action);

    factory.ngOnDestroy();
    scannedActions$.next({ type: 'after destroy' });
    seen = undefined;
    factory.reducedActions$.subscribe((a) => (seen = a)).unsubscribe();
    // no longer listening: nothing was replayed from after the destroy
    expect(seen).toBeUndefined();
  });
});
