import * as ts from 'typescript';
import { addReducerToActionReducerMap } from './ngrx-utils';

function parse(source: string) {
  return ts.createSourceFile(
    'reducers/index.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
}

describe('ngrx-utils', () => {
  describe('addReducerToActionReducerMap', () => {
    it('finds the ActionReducerMap-typed declaration when it is declared first', () => {
      const source = parse(`
        export const reducers: ActionReducerMap<State> = {};
        export const metaReducers: MetaReducer<State>[] = [];
      `);

      const change = addReducerToActionReducerMap(source, 'reducers/index.ts', {
        name: 'foo',
        plural: false,
      });

      expect(change.constructor.name).toBe('InsertChange');
    });

    it('does not throw when a non-type-reference declaration (e.g. an array type) appears before the ActionReducerMap one', () => {
      // Real, reachable shape: any hand-edited or differently-ordered
      // reducers file can have metaReducers (an array type, not a simple
      // type reference) declared before reducers.
      const source = parse(`
        export const metaReducers: MetaReducer<State>[] = [];
        export const reducers: ActionReducerMap<State> = {};
      `);

      expect(() =>
        addReducerToActionReducerMap(source, 'reducers/index.ts', {
          name: 'foo',
          plural: false,
        })
      ).not.toThrow();

      const change = addReducerToActionReducerMap(source, 'reducers/index.ts', {
        name: 'foo',
        plural: false,
      });
      expect(change.constructor.name).toBe('InsertChange');
    });

    it('returns a NoopChange when no ActionReducerMap-typed declaration exists', () => {
      const source = parse(`
        export const metaReducers: MetaReducer<State>[] = [];
      `);

      const change = addReducerToActionReducerMap(source, 'reducers/index.ts', {
        name: 'foo',
        plural: false,
      });

      expect(change.constructor.name).toBe('NoopChange');
    });
  });
});
