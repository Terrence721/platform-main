import { Signal } from '@angular/core';
import { expectTypeOf } from 'vitest';
import { signalState } from '../../src';
import { IsKnownRecord } from '../../src/ts-helpers';

describe('ts-helpers types', () => {
  const SECRET = Symbol('secret');

  class Person {
    name = '';
  }

  describe('IsKnownRecord', () => {
    it('is true for objects with known keys', () => {
      expectTypeOf<IsKnownRecord<{ a: number }>>().toEqualTypeOf<true>();
      expectTypeOf<IsKnownRecord<Person>>().toEqualTypeOf<true>();
      expectTypeOf<IsKnownRecord<{ [SECRET]: number }>>().toEqualTypeOf<true>();
      expectTypeOf<
        IsKnownRecord<Partial<{ a: number }>>
      >().toEqualTypeOf<true>();
    });

    it('is false for a dictionary', () => {
      expectTypeOf<
        IsKnownRecord<Record<string, number>>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        IsKnownRecord<Record<number, number>>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        IsKnownRecord<{ a: number; [key: string]: number }>
      >().toEqualTypeOf<false>();
    });

    it('is false for a dictionary keyed by a template literal pattern', () => {
      expectTypeOf<
        IsKnownRecord<Record<`a-${string}`, number>>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        IsKnownRecord<Record<`id${number}`, number>>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        IsKnownRecord<{ known: string } & Record<`a-${string}`, string>>
      >().toEqualTypeOf<false>();
    });

    it('is false for built-in and non-object types', () => {
      expectTypeOf<IsKnownRecord<number[]>>().toEqualTypeOf<false>();
      expectTypeOf<IsKnownRecord<Map<string, number>>>().toEqualTypeOf<false>();
      expectTypeOf<IsKnownRecord<Date>>().toEqualTypeOf<false>();
      expectTypeOf<IsKnownRecord<() => void>>().toEqualTypeOf<false>();
      expectTypeOf<
        IsKnownRecord<Record<never, never>>
      >().toEqualTypeOf<false>();
      expectTypeOf<IsKnownRecord<null>>().toEqualTypeOf<false>();
    });
  });

  it('does not create deep signals for a dictionary keyed by a template literal pattern', () => {
    const state = signalState<{ dict: Record<`a-${string}`, number> }>({
      dict: {},
    });

    expectTypeOf(state.dict).toEqualTypeOf<
      Signal<Record<`a-${string}`, number>>
    >();
  });
});
