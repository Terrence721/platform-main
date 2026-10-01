import { expectTypeOf, describe, it } from 'vitest';
// Through the package name, so a missing public export fails here (#162).
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
    it('can set the initial state', () => {
      const initialState: BookState = adapter.getInitialState({
        selectedBookId: '1',
      });

      expectTypeOf(initialState).toEqualTypeOf<BookState>();
    });

    it('can set the initial state with additional properties', () => {
      const initialState: BookState = adapter.getInitialState({
        selectedBookId: '1',
      });

      expectTypeOf(initialState).toEqualTypeOf<BookState>();
    });

    it('can set the initial state with unknown properties when the state is untyped', () => {
      const initialState = adapter.getInitialState({
        selectedBookId: '1',
        otherProperty: 'value',
      });

      expectTypeOf(initialState).toExtend<EntityState<Book>>();
    });
  });
});
