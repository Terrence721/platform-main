import {
  addEntityMutably,
  cloneEntityState,
  getEntityIdSelector,
  getEntityStateKeys,
  setEntityMutably,
} from '../src/helpers';
import { DidMutate } from '../src/models';

describe('getEntityIdSelector', () => {
  it('defaults to reading an entity id', () => {
    const selectId = getEntityIdSelector();

    expect(selectId({ id: 7 })).toBe(7);
  });

  it('uses the configured selectId when provided', () => {
    const selectId = getEntityIdSelector({
      selectId: (entity: { _id: string }) => entity._id,
    });

    expect(selectId({ _id: 'abc' })).toBe('abc');
  });
});

describe('getEntityStateKeys', () => {
  it('uses the default keys when there is no collection', () => {
    expect(getEntityStateKeys()).toEqual({
      entityMapKey: 'entityMap',
      idsKey: 'ids',
      entitiesKey: 'entities',
    });
  });

  it('prefixes the keys with the collection name', () => {
    expect(getEntityStateKeys({ collection: 'todo' })).toEqual({
      entityMapKey: 'todoEntityMap',
      idsKey: 'todoIds',
      entitiesKey: 'todoEntities',
    });
  });
});

describe('cloneEntityState', () => {
  it('shallow-clones the entity map and ids', () => {
    const state = { entityMap: { 1: { name: 'a' } }, ids: [1], extra: true };
    const keys = { entityMapKey: 'entityMap', idsKey: 'ids' };

    const clone = cloneEntityState(state, keys);

    state.entityMap[1].name = 'changed';
    state.ids.push(2);

    expect(clone.entityMap).toEqual({ 1: { name: 'changed' } });
    expect(clone.ids).toEqual([1]);
  });
});

describe('addEntityMutably', () => {
  it('adds a new entity and reports Both', () => {
    const state: { entityMap: Record<number, { id: number }>; ids: number[] } =
      {
        entityMap: {},
        ids: [],
      };

    expect(addEntityMutably(state, { id: 1 }, (entity) => entity.id)).toBe(
      DidMutate.Both
    );
    expect(state).toEqual({ entityMap: { 1: { id: 1 } }, ids: [1] });
  });

  it('does not add a duplicate entity', () => {
    const state: { entityMap: Record<number, { id: number }>; ids: number[] } =
      {
        entityMap: { 1: { id: 1 } },
        ids: [1],
      };

    expect(addEntityMutably(state, { id: 1 }, (entity) => entity.id)).toBe(
      DidMutate.None
    );
    expect(state).toEqual({ entityMap: { 1: { id: 1 } }, ids: [1] });
  });

  it('prepends when asked', () => {
    const state: { entityMap: Record<number, { id: number }>; ids: number[] } =
      {
        entityMap: { 1: { id: 1 } },
        ids: [1],
      };

    addEntityMutably(state, { id: 2 }, (entity) => entity.id, true);

    expect(state.ids).toEqual([2, 1]);
  });
});

describe('setEntityMutably', () => {
  it('updates an existing entity and reports Entities', () => {
    const state: {
      entityMap: Record<number, { id: number; name: string }>;
      ids: number[];
    } = {
      entityMap: { 1: { id: 1, name: 'old' } },
      ids: [1],
    };

    expect(
      setEntityMutably(state, { id: 1, name: 'new' }, (entity) => entity.id)
    ).toBe(DidMutate.Entities);
    expect(state.entityMap[1]).toEqual({ id: 1, name: 'new' });
    expect(state.ids).toEqual([1]);
  });

  it('adds a new entity and reports Both', () => {
    const state: {
      entityMap: Record<number, { id: number; name: string }>;
      ids: number[];
    } = {
      entityMap: {},
      ids: [],
    };

    expect(
      setEntityMutably(state, { id: 2, name: 'new' }, (entity) => entity.id)
    ).toBe(DidMutate.Both);
    expect(state).toEqual({
      entityMap: { 2: { id: 2, name: 'new' } },
      ids: [2],
    });
  });

  it('merges into an existing entity when replace is false', () => {
    const state: {
      entityMap: Record<number, { id: number; name: string; count?: number }>;
      ids: number[];
    } = {
      entityMap: { 1: { id: 1, name: 'old' } },
      ids: [1],
    };

    setEntityMutably(state, { id: 1, count: 3 }, (entity) => entity.id, false);

    expect(state.entityMap[1]).toEqual({ id: 1, name: 'old', count: 3 });
  });
});
