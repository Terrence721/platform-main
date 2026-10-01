import { it, describe } from 'vitest';
// Through the package name, so a missing public export fails here (#162).
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';

interface Book {
  id: string;
  title: string;
}

interface BookState extends EntityState<Book> {
  selectedBookId: string | null;
}

const adapter: EntityAdapter<Book> = createEntityAdapter<Book>();

describe('EntityState Types', () => {
  describe('getInitialState', () => {
    it('throws when setting the initial state with unknown properties', () => {
      adapter.getInitialState<BookState>({
        selectedBookId: '1',
        // @ts-expect-error Object literal may only specify known properties, and 'otherProperty' does not exist in type 'Omit<BookState, keyof EntityState<T>>'
        otherProperty: 'value',
      });
    });
  });
});
