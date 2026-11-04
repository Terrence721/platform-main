import { defaultSelectId, flattenArgs, toUpdateFactory } from '../..';

describe('defaultSelectId', () => {
  it('returns the entity id when present', () => {
    expect(defaultSelectId({ id: 7 })).toBe(7);
  });

  it('returns undefined for null or entities without id', () => {
    expect(defaultSelectId(null)).toBeUndefined();
    expect(defaultSelectId({})).toBeUndefined();
    expect(defaultSelectId(undefined)).toBeUndefined();
  });
});

describe('flattenArgs', () => {
  it('returns an empty array for nullish input', () => {
    expect(flattenArgs()).toEqual([]);
    expect(flattenArgs(null as any)).toEqual([]);
    expect(flattenArgs(undefined)).toEqual([]);
  });

  it('flattens a leading array argument', () => {
    expect(flattenArgs([[1, 2], 3])).toEqual([1, 2, 3]);
  });

  it('leaves already-spread arguments unchanged', () => {
    expect(flattenArgs([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe('toUpdateFactory', () => {
  it('creates an update with the selected id', () => {
    const toUpdate = toUpdateFactory<{ id: number; name: string }>();

    expect(toUpdate({ id: 1, name: 'name' })).toEqual({
      id: 1,
      changes: { id: 1, name: 'name' },
    });
  });

  it('uses a custom selectId when provided', () => {
    const toUpdate = toUpdateFactory<{ key: string; name: string }>(
      (entity) => entity.key
    );

    expect(toUpdate({ key: 'abc', name: 'name' })).toEqual({
      id: 'abc',
      changes: { key: 'abc', name: 'name' },
    });
  });

  it('throws when the primary key is null or undefined', () => {
    const toUpdate = toUpdateFactory<{ id?: number; name: string }>();

    expect(() => toUpdate({ name: 'name' })).toThrow(
      'Primary key may not be null/undefined.'
    );
  });
});
