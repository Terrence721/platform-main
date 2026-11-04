import { findPropertyInAstObject } from './json-utils';

describe('json-utils', () => {
  describe('findPropertyInAstObject', () => {
    it('returns the value of a matching property', () => {
      const node = {
        properties: [
          { key: { value: 'one' }, value: 1 },
          { key: { value: 'two' }, value: 2 },
        ],
      };

      expect(findPropertyInAstObject(node, 'two')).toBe(2);
    });

    it('returns the last matching property when several share a key', () => {
      const node = {
        properties: [
          { key: { value: 'foo' }, value: 'first' },
          { key: { value: 'foo' }, value: 'second' },
        ],
      };

      expect(findPropertyInAstObject(node, 'foo')).toBe('second');
    });

    it('returns null when the property is missing', () => {
      const node = { properties: [{ key: { value: 'foo' }, value: 1 }] };

      expect(findPropertyInAstObject(node, 'bar')).toBeNull();
    });

    it('returns null when there are no properties', () => {
      expect(findPropertyInAstObject({ properties: [] }, 'foo')).toBeNull();
    });
  });
});
