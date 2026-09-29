import {
  CorrelationIdGenerator,
  defaultSelectId,
  flattenArgs,
  toUpdateFactory,
} from '../../';

describe('Utilities (utils)', () => {
  describe('defaultSelectId', () => {
    it("returns the entity's id, including falsy ids", () => {
      expect(defaultSelectId({ id: 42 })).toBe(42);
      expect(defaultSelectId({ id: 0 })).toBe(0);
    });

    it('returns undefined for no entity or no id', () => {
      expect(defaultSelectId(null)).toBeUndefined();
      expect(defaultSelectId(undefined)).toBeUndefined();
      expect(defaultSelectId({ name: 'A' })).toBeUndefined();
    });
  });

  describe('flattenArgs', () => {
    it('returns the arguments as given', () => {
      expect(flattenArgs(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('flattens a leading array', () => {
      expect(flattenArgs([['a', 'b'], 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array for no arguments', () => {
      expect(flattenArgs()).toEqual([]);
      expect(flattenArgs([])).toEqual([]);
    });
  });

  describe('toUpdateFactory', () => {
    it('makes an Update keyed by the default id', () => {
      const toUpdate = toUpdateFactory<{ id: number; name: string }>();
      expect(toUpdate({ id: 1, name: 'A' })).toEqual({
        id: 1,
        changes: { id: 1, name: 'A' },
      });
    });

    it('uses the given selectId, including a key of 0', () => {
      const toUpdate = toUpdateFactory<{ key: number }>((e) => e.key);
      expect(toUpdate({ key: 0 })).toEqual({ id: 0, changes: { key: 0 } });
    });

    it('throws when the entity has no key', () => {
      const toUpdate = toUpdateFactory<{ id: number; name: string }>();
      expect(() => toUpdate({ name: 'A' })).toThrowError(
        'Primary key may not be null/undefined.'
      );
    });
  });

  describe('CorrelationIdGenerator', () => {
    const prefix = 'CRID';

    it('generates a non-zero integer id', () => {
      const generator = new CorrelationIdGenerator();
      const id = generator.next();
      expect(id).toBe(prefix + 1);
    });

    it('generates successive integer ids', () => {
      const generator = new CorrelationIdGenerator();
      const id1 = generator.next();
      const id2 = generator.next();
      expect(id1).toBe(prefix + 1);
      expect(id2).toBe(prefix + 2);
    });

    it('new instance of the service has its own ids', () => {
      const generator1 = new CorrelationIdGenerator();
      const generator2 = new CorrelationIdGenerator();
      const id1 = generator1.next();
      const id2 = generator1.next();
      const id3 = generator2.next();
      expect(id1).toBe(prefix + 1);
      expect(id2).toBe(prefix + 2);
      expect(id3).toBe(prefix + 1);
    });
  });
});
