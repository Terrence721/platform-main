import {
  ChangeType,
  createEmptyEntityCollection,
  createEntityDefinition,
  EntityActionFactory,
  EntityCollection,
  EntityCollectionReducerMethods,
  EntityOp,
} from '../..';
import { isPersistSkipped } from '../../src/reducers/entity-collection-reducer-methods';

interface Hero {
  id: number;
  name: string;
}

describe('EntityCollectionReducerMethods', () => {
  const definition = createEntityDefinition<Hero, object>({
    entityName: 'Hero',
  });
  const methods = new EntityCollectionReducerMethods<Hero>('Hero', definition)
    .methods;
  const entityActionFactory = new EntityActionFactory();

  /** Hero 1 was added but never saved; hero 2 is saved. */
  function collection(): EntityCollection<Hero> {
    const heroes = definition.entityAdapter.addMany(
      [
        { id: 1, name: 'Unsaved' },
        { id: 2, name: 'Saved' },
      ],
      createEmptyEntityCollection<Hero>('Hero')
    );
    return { ...heroes, changeState: { 1: { changeType: ChangeType.Added } } };
  }

  /** Freeze an action as NgRx's default runtime checks do. */
  function freeze<T extends { payload: object }>(action: T): T {
    Object.freeze(action.payload);
    return Object.freeze(action);
  }

  describe('deleting entities that were never saved', () => {
    it('SAVE_DELETE_ONE removes the entity and skips the server call', () => {
      const action = entityActionFactory.create<number>(
        'Hero',
        EntityOp.SAVE_DELETE_ONE,
        1
      );
      const result = methods[EntityOp.SAVE_DELETE_ONE](collection(), action);
      expect(result.ids).toEqual([2]);
      expect(result.changeState[1]).toBeUndefined();
      expect(action.payload.skip).toBe(true);
      expect(isPersistSkipped(action)).toBe(true);
    });

    it('SAVE_DELETE_ONE with a frozen action does not throw and still skips', () => {
      const action = freeze(
        entityActionFactory.create<number>('Hero', EntityOp.SAVE_DELETE_ONE, 1)
      );
      const result = methods[EntityOp.SAVE_DELETE_ONE](collection(), action);
      expect(result.ids).toEqual([2]);
      expect(isPersistSkipped(action)).toBe(true);
    });

    it('SAVE_DELETE_MANY skips the server call when every entity was never saved', () => {
      const action = freeze(
        entityActionFactory.create<number[]>(
          'Hero',
          EntityOp.SAVE_DELETE_MANY,
          [1]
        )
      );
      methods[EntityOp.SAVE_DELETE_MANY](collection(), action);
      expect(isPersistSkipped(action)).toBe(true);
    });

    it('SAVE_DELETE_MANY still calls the server when saved entities are in the batch', () => {
      const action = entityActionFactory.create<number[]>(
        'Hero',
        EntityOp.SAVE_DELETE_MANY,
        [1, 2],
        { isOptimistic: true }
      );
      const result = methods[EntityOp.SAVE_DELETE_MANY](collection(), action);
      expect(result.ids).toEqual([]);
      expect(isPersistSkipped(action)).toBe(false);
    });
  });
});
