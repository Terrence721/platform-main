import { Selector } from '@ngrx/store';
import { expectTypeOf, describe, it } from 'vitest';
// Through the package name, so a missing public export fails here (#162).
import { EntitySelectors } from '@ngrx/entity';

describe('EntitySelectors', () => {
  it('is compatible with a dictionary of selectors', () => {
    type SelectorsDictionary = Record<
      string,
      | Selector<Record<string, any>, unknown>
      | ((...args: any[]) => Selector<Record<string, any>, unknown>)
    >;
    type ExtendsSelectorsDictionary<T> = T extends SelectorsDictionary
      ? true
      : false;

    expectTypeOf<
      ExtendsSelectorsDictionary<EntitySelectors<unknown, Record<string, any>>>
    >().toEqualTypeOf<true>();
  });
});
