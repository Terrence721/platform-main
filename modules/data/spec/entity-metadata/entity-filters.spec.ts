import { PropsFilterFnFactory } from '../..';

class Hero {
  id!: number;
  name!: string;
  saying?: string;
}

describe('EntityFilterFn - PropsFilter', () => {
  it('can match entity on full text of a target prop', () => {
    const entity1: Hero = { id: 42, name: 'Foo' };
    const entity2: Hero = { id: 21, name: 'Bar' };
    const entities: Hero[] = [entity1, entity2];
    const filter = PropsFilterFnFactory<Hero>(['name']);
    expect(filter(entities, 'Foo')).toEqual([entity1]);
  });

  it('can match entity on regex of a target prop', () => {
    const entity1: Hero = { id: 42, name: 'Foo' };
    const entity2: Hero = { id: 21, name: 'Bar' };
    const entities: Hero[] = [entity1, entity2];
    const filter = PropsFilterFnFactory<Hero>(['name']);
    expect(filter(entities, /fo/i)).toEqual([entity1]);
  });

  it('can match entity on regex of two target props', () => {
    const entity1: Hero = { id: 42, name: 'Foo' };
    const entity2: Hero = { id: 21, name: 'Bar', saying: 'Foo is not Bar' };
    const entities: Hero[] = [entity1, entity2];
    const filter = PropsFilterFnFactory<Hero>(['name', 'saying']);
    expect(filter(entities, /fo/i)).toEqual([entity1, entity2]);
  });

  it('returns empty array when no matches', () => {
    const entity1: Hero = { id: 42, name: 'Foo' };
    const entity2: Hero = { id: 21, name: 'Bar' };
    const entities: Hero[] = [entity1, entity2];
    const filter = PropsFilterFnFactory<Hero>(['name']);
    expect(filter(entities, 'Baz')).toEqual([]);
  });

  it('returns empty array for empty input entities array', () => {
    const entities: Hero[] = [];
    const filter = PropsFilterFnFactory<Hero>(['name']);
    expect(filter(entities, 'Foo')).toEqual([]);
  });

  it('returns empty array for null input entities array', () => {
    const filter = PropsFilterFnFactory<Hero>(['name']);
    expect(filter(null as any, 'Foo')).toEqual([]);
  });

  describe('edge cases', () => {
    const alpha: Hero = { id: 1, name: 'Alpha' };
    const alfred: Hero = { id: 2, name: 'Alfred' };
    const alice: Hero = { id: 3, name: 'Alice' };
    const nameless = { id: 4 } as Hero;
    const heroes = [alpha, alfred, alice, nameless];
    const filter = PropsFilterFnFactory<Hero>(['name']);

    it('matches every entity with a global or sticky RegExp', () => {
      const global = /al/gi;
      expect(filter(heroes, global)).toEqual([alpha, alfred, alice]);
      expect(global.lastIndex).toBe(0); // the caller's RegExp is untouched
      expect(filter(heroes, /al/iy)).toEqual([alpha, alfred, alice]);
    });

    it('keeps a sticky RegExp anchored at the start of each value', () => {
      // /ph/y must match at position 0, which no name does
      expect(filter(heroes, /ph/y)).toEqual([]);
    });

    it('matches a string that is not a valid RegExp literally, instead of throwing', () => {
      const bracketed: Hero = { id: 5, name: 'Beta (b)' };
      expect(filter([...heroes, bracketed], 'a (')).toEqual([bracketed]);
    });

    it('does not match a missing prop against the text "undefined" or "null"', () => {
      const nulled = { id: 6, name: null } as unknown as Hero;
      expect(filter([...heroes, nulled], 'undef')).toEqual([]);
      expect(filter([...heroes, nulled], 'null')).toEqual([]);
    });
  });
});
