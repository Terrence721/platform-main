import { MemoizedSelector } from '@ngrx/store';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, so a missing or mistyped public export fails here
// (#162). The adapter, EntityState and EntitySelectors have their own specs.
import {
  Comparer,
  createEntityAdapter,
  Dictionary,
  DictionaryNum,
  EntityAdapter,
  EntityMap,
  EntityMapOne,
  EntityState,
  IdSelector,
  MemoizedEntitySelectors,
  Predicate,
  Update,
} from '@ngrx/entity';

interface Book {
  id: string;
  title: string;
}

describe('@ngrx/entity public types', () => {
  it('Comparer, Predicate and EntityMap are functions of entities', () => {
    expectTypeOf<Comparer<Book>>().toEqualTypeOf<
      (a: Book, b: Book) => number
    >();
    expectTypeOf<Predicate<Book>>().toEqualTypeOf<(entity: Book) => boolean>();
    expectTypeOf<EntityMap<Book>>().toEqualTypeOf<(entity: Book) => Book>();
  });

  it('IdSelector returns a string or a number id', () => {
    expectTypeOf<IdSelector<Book>>().toEqualTypeOf<
      ((model: Book) => string) | ((model: Book) => number)
    >();
  });

  it('Update and EntityMapOne take a string or a number id', () => {
    expectTypeOf<Update<Book>>().toEqualTypeOf<
      | { id: string; changes: Partial<Book> }
      | { id: number; changes: Partial<Book> }
    >();
    expectTypeOf<EntityMapOne<Book>>().toEqualTypeOf<
      | { id: number; map: EntityMap<Book> }
      | { id: string; map: EntityMap<Book> }
    >();
    // @ts-expect-error an update needs an id
    const update: Update<Book> = { changes: { title: 'x' } };
    void update;
  });

  it('the dictionaries may miss an id', () => {
    expectTypeOf<Dictionary<Book>[string]>().toEqualTypeOf<Book | undefined>();
    expectTypeOf<DictionaryNum<Book>[number]>().toEqualTypeOf<
      Book | undefined
    >();
    expectTypeOf<EntityState<Book>['entities']>().toEqualTypeOf<
      Dictionary<Book>
    >();
  });

  it('MemoizedEntitySelectors are memoized selectors of the outer state', () => {
    type Selectors = MemoizedEntitySelectors<
      Book,
      { books: EntityState<Book> }
    >;
    expectTypeOf<Selectors['selectAll']>().toExtend<
      MemoizedSelector<{ books: EntityState<Book> }, Book[]>
    >();
    expectTypeOf<Selectors['selectTotal']>().toExtend<
      MemoizedSelector<{ books: EntityState<Book> }, number>
    >();
    const adapter = createEntityAdapter<Book>();
    expectTypeOf(
      adapter.getSelectors((state: { books: EntityState<Book> }) => state.books)
    ).toEqualTypeOf<Selectors>();
  });

  it('an adapter has every state method, and only those', () => {
    const adapter = createEntityAdapter<Book>();
    expectTypeOf(adapter).toEqualTypeOf<EntityAdapter<Book, string>>();
    expectTypeOf<keyof typeof adapter>().toEqualTypeOf<
      | 'selectId'
      | 'sortComparer'
      | 'getInitialState'
      | 'getSelectors'
      | 'addOne'
      | 'addMany'
      | 'setAll'
      | 'setOne'
      | 'setMany'
      | 'removeOne'
      | 'removeMany'
      | 'removeAll'
      | 'updateOne'
      | 'updateMany'
      | 'upsertOne'
      | 'upsertMany'
      | 'mapOne'
      | 'map'
    >();
  });

  it('the state methods return the state type they are given', () => {
    const adapter = createEntityAdapter<Book>();
    type State = EntityState<Book> & { selected: string | null };
    const state = adapter.getInitialState<State>({ selected: null });
    expectTypeOf(state).toEqualTypeOf<State>();
    expectTypeOf(
      adapter.addOne({ id: '1', title: 'x' }, state)
    ).toEqualTypeOf<State>();
    expectTypeOf(
      adapter.removeMany((book) => !book.title, state)
    ).toEqualTypeOf<State>();
    expectTypeOf(
      adapter.mapOne({ id: '1', map: (book) => book }, state)
    ).toEqualTypeOf<State>();
    expectTypeOf(adapter.removeAll(state)).toEqualTypeOf<State>();
  });
});
