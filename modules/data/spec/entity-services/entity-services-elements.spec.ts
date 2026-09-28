import { TestBed } from '@angular/core/testing';
import { Action, StoreModule } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import {
  EntityActionFactory,
  EntityCache,
  EntityDataModuleWithoutEffects,
  EntityOp,
  EntityServicesElements,
} from '../..';

describe('EntityServicesElements', () => {
  let elements: EntityServicesElements;
  let entityActionFactory: EntityActionFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
        EntityDataModuleWithoutEffects.forRoot({
          entityMetadata: { Hero: {} },
        }),
      ],
    });
    elements = TestBed.inject(EntityServicesElements);
    entityActionFactory = TestBed.inject(EntityActionFactory);
  });

  function addHero() {
    const action = entityActionFactory.create('Hero', EntityOp.ADD_ONE, {
      id: 1,
      name: 'A',
    });
    elements.store.dispatch(action);
    return action;
  }

  it('gives the root store, with the cache under its name, and the cache itself as entityCache$', async () => {
    addHero();

    const rootState = (await firstValueFrom(
      elements.store.select((state) => state)
    )) as unknown as { entityCache: EntityCache };
    const cache = await firstValueFrom(elements.entityCache$);

    expect(Object.keys(rootState)).toEqual(['entityCache']);
    expect(cache).toBe(rootState.entityCache);
    expect(cache['Hero'].ids).toEqual([1]);
  });

  it('replays the most recent reduced action to a late subscriber', async () => {
    const action = addHero();
    const latest: Action = await firstValueFrom(elements.reducedActions$);
    expect(latest).toBe(action);
  });
});
