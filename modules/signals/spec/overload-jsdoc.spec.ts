import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

// TypeScript publishes the JSDoc of each overload signature and never the JSDoc
// of the implementation signature (callers cannot see that one), so an
// overloaded public function has to carry its documentation on every overload
// to reach the built typings and the editor tooltip.
const overloadedFunctions = [
  ['signal-store.ts', 'signalStore'],
  ['signal-store-feature.ts', 'signalStoreFeature'],
  ['with-hooks.ts', 'withHooks'],
  ['with-state.ts', 'withState'],
] as const;

describe('overloaded public functions', () => {
  it.each(overloadedFunctions)(
    '%s: every %s overload carries the JSDoc',
    (file, name) => {
      const text = readFileSync(join(__dirname, '../src', file), 'utf8');
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true
      );
      const overloads = source.statements.filter(
        (statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) &&
          statement.name?.text === name &&
          !statement.body
      );

      const undocumented = overloads
        .filter((overload) => {
          const docs = (
            ts.getLeadingCommentRanges(text, overload.getFullStart()) ?? []
          ).filter((range) => text.slice(range.pos, range.pos + 3) === '/**');

          return !docs.some((range) =>
            text.slice(range.pos, range.end).includes('@description')
          );
        })
        .map(
          (overload) =>
            `line ${source.getLineAndCharacterOfPosition(overload.getStart()).line + 1}`
        );

      expect(overloads.length).toBeGreaterThan(1);
      expect(undocumented).toEqual([]);
    }
  );
});
