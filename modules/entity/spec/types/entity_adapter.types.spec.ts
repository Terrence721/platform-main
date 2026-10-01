import { it, describe } from 'vitest';
// Through the package name, so a missing public export fails here (#162).
import { createEntityAdapter } from '@ngrx/entity';

interface EntityWithoutId {
  key: number;
}

describe('EntityAdapter Types', () => {
  it('throws when selectId returns an invalid id type', () => {
    createEntityAdapter<EntityWithoutId>({
      // @ts-expect-error Type 'boolean' is not assignable to type 'string | number'
      selectId: (entity) => entity.key > 0,
    });
  });
});
