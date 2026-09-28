import {
  ChangeSet,
  ChangeSetOperation,
  changeSetItemFactory as cif,
  excludeEmptyChangeSetItems,
} from '../../';

describe('changeSetItemFactory', () => {
  const hero = { id: 1, name: 'Hero 1' };
  const villains = [
    { id: 2, name: 'Villain 2' },
    { id: 3, name: 'Villain 3' },
  ];

  it('should create an Add item with array of entities from single entity', () => {
    const heroItem = cif.add('Hero', hero);
    expect(heroItem.op).toBe(ChangeSetOperation.Add);
    expect(heroItem.entityName).toBe('Hero');
    expect(heroItem.entities).toEqual([hero]);
  });

  it('should create a Delete item from an array entity keys', () => {
    const ids = villains.map((v) => v.id);
    const heroItem = cif.delete('Villain', ids);
    expect(heroItem.op).toBe(ChangeSetOperation.Delete);
    expect(heroItem.entityName).toBe('Villain');
    expect(heroItem.entities).toEqual(ids);
  });

  it('should create an Add item with empty array when given no entities', () => {
    const heroItem = cif.add('Hero', null);
    expect(heroItem.op).toBe(ChangeSetOperation.Add);
    expect(heroItem.entityName).toBe('Hero');
    expect(heroItem.entities).toEqual([]);
  });

  it('should create a Delete item from a single key, including 0', () => {
    expect(cif.delete('Hero', 0).entities).toEqual([0]);
    expect(cif.delete('Hero', 'a').entities).toEqual(['a']);
    expect(cif.delete('Hero', null as any).entities).toEqual([]);
  });

  it('should create an Update item from a single update', () => {
    const update = { id: 1, changes: { name: 'Hero 1a' } };
    const heroItem = cif.update('Hero', update);
    expect(heroItem.op).toBe(ChangeSetOperation.Update);
    expect(heroItem.entities).toEqual([update]);
  });

  it('should create an Update item for an entity whose key is not `id`', () => {
    interface Sidekick {
      sidekickId: number;
      name: string;
    }
    const heroItem = cif.update<Sidekick>('Sidekick', {
      id: 1,
      changes: { name: 'Robin' },
    });
    expect(heroItem.entities).toEqual([{ id: 1, changes: { name: 'Robin' } }]);
  });

  it('should create an Upsert item with array of entities from single entity', () => {
    const heroItem = cif.upsert('Hero', hero);
    expect(heroItem.op).toBe(ChangeSetOperation.Upsert);
    expect(heroItem.entities).toEqual([hero]);
  });

  it('should keep an array of updates or upserts as given', () => {
    const updates = villains.map((v) => ({ id: v.id, changes: v }));
    expect(cif.update('Villain', updates).entities).toBe(updates);
    expect(cif.upsert('Villain', villains).entities).toBe(villains);
  });

  it('should create Update and Upsert items with empty arrays when given nothing', () => {
    expect(cif.update('Hero', null as any).entities).toEqual([]);
    expect(cif.upsert('Hero', null).entities).toEqual([]);
  });
});

describe('excludeEmptyChangeSetItems', () => {
  it('should drop null and empty items and keep the rest in order', () => {
    const add = cif.add('Hero', { id: 1 });
    const del = cif.delete('Villain', 0);
    const changeSet: ChangeSet = {
      changes: [add, null as any, cif.upsert('Hero', []), del],
      tag: 'Save',
      extras: { batch: 1 },
    };

    expect(excludeEmptyChangeSetItems(changeSet)).toEqual({
      changes: [add, del],
      tag: 'Save',
      extras: { batch: 1 },
    });
  });

  it('should return an empty change set for a missing one', () => {
    expect(excludeEmptyChangeSetItems(undefined as any)).toEqual({
      changes: [],
    });
  });
});
