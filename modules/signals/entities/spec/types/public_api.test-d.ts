import { Signal } from '@angular/core';
import { PartialStateUpdater } from '@ngrx/signals';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). withEntities and entityConfig have their
// own specs next to this one.
import {
  addEntities,
  addEntity,
  EntityChanges,
  EntityId,
  EntityMap,
  EntityProps,
  EntityState,
  NamedEntityProps,
  NamedEntityState,
  prependEntities,
  prependEntity,
  removeAllEntities,
  removeEntities,
  removeEntity,
  setAllEntities,
  setEntities,
  setEntity,
  updateAllEntities,
  updateEntities,
  updateEntity,
  upsertEntities,
  upsertEntity,
} from '@ngrx/signals/entities';

interface Todo {
  id: number;
  text: string;
}
const todo: Todo = { id: 1, text: 'a' };

describe('@ngrx/signals/entities public types', () => {
  it('the state keeps the ids and a map by id', () => {
    expectTypeOf<EntityState<Todo>>().toEqualTypeOf<{
      entityMap: EntityMap<Todo>;
      ids: EntityId[];
    }>();
    // A lookup of a missing id is typed as the entity, though it is undefined.
    expectTypeOf<EntityMap<Todo>>().toEqualTypeOf<Record<EntityId, Todo>>();
    expectTypeOf<EntityProps<Todo>>().toEqualTypeOf<{
      entities: Signal<Todo[]>;
    }>();
  });

  it('a named collection prefixes every key', () => {
    expectTypeOf<NamedEntityState<Todo, 'todo'>>().toEqualTypeOf<{
      todoEntityMap: EntityMap<Todo>;
      todoIds: EntityId[];
    }>();
    expectTypeOf<NamedEntityProps<Todo, 'todo'>>().toEqualTypeOf<{
      todoEntities: Signal<Todo[]>;
    }>();
  });

  it('changes are a partial entity or a function of the entity', () => {
    expectTypeOf<EntityChanges<Todo>>().toEqualTypeOf<
      Partial<Todo> | ((entity: Todo) => Partial<Todo>)
    >();
  });

  it('the add, set and upsert updaters update the entity state', () => {
    type Updater = PartialStateUpdater<EntityState<Todo>>;
    expectTypeOf(addEntity(todo)).toEqualTypeOf<Updater>();
    expectTypeOf(addEntities([todo])).toEqualTypeOf<Updater>();
    expectTypeOf(prependEntity(todo)).toEqualTypeOf<Updater>();
    expectTypeOf(prependEntities([todo])).toEqualTypeOf<Updater>();
    expectTypeOf(setEntity(todo)).toEqualTypeOf<Updater>();
    expectTypeOf(setEntities([todo])).toEqualTypeOf<Updater>();
    expectTypeOf(setAllEntities([todo])).toEqualTypeOf<Updater>();
    expectTypeOf(upsertEntity(todo)).toEqualTypeOf<Updater>();
    expectTypeOf(upsertEntities([todo])).toEqualTypeOf<Updater>();
  });

  it('with a collection, the updaters update the named state', () => {
    expectTypeOf(addEntity(todo, { collection: 'todo' })).toEqualTypeOf<
      PartialStateUpdater<NamedEntityState<Todo, 'todo'>>
    >();
    expectTypeOf(
      setAllEntities([{ key: 'a' }], {
        collection: 'item',
        selectId: (item) => item.key,
      })
    ).toEqualTypeOf<
      PartialStateUpdater<NamedEntityState<{ key: string }, 'item'>>
    >();
  });

  it('an entity without an id needs selectId', () => {
    // @ts-expect-error no id property, no selectId
    addEntity({ key: 'a' });
    expectTypeOf(
      addEntity({ key: 'a' }, { selectId: (item) => item.key })
    ).toEqualTypeOf<PartialStateUpdater<EntityState<{ key: string }>>>();
  });

  it('the update and remove updaters take ids, a predicate or nothing', () => {
    expectTypeOf(
      updateEntity<Todo>({ id: 1, changes: { text: 'b' } })
    ).toEqualTypeOf<PartialStateUpdater<EntityState<Todo>>>();
    expectTypeOf(
      updateEntities<Todo>({
        predicate: (t) => t.id > 0,
        changes: (t) => ({ text: t.text + '!' }),
      })
    ).toEqualTypeOf<PartialStateUpdater<EntityState<Todo>>>();
    expectTypeOf(updateAllEntities<Todo>({ text: 'c' })).toEqualTypeOf<
      PartialStateUpdater<EntityState<Todo>>
    >();
    expectTypeOf(removeEntity(1)).toEqualTypeOf<
      PartialStateUpdater<EntityState<any>>
    >();
    expectTypeOf(removeEntities([1, 2])).toEqualTypeOf<
      PartialStateUpdater<EntityState<any>>
    >();
    expectTypeOf(removeEntities<Todo>((t) => t.id > 1)).toEqualTypeOf<
      PartialStateUpdater<EntityState<Todo>>
    >();
    expectTypeOf(removeAllEntities()).toEqualTypeOf<
      PartialStateUpdater<EntityState<any>>
    >();
  });
});
