import * as ts from 'typescript';
import { Path } from '@angular-devkit/core';
import { replaceImport } from './ast-utils';
import { InsertChange, RemoveChange, ReplaceChange } from './change';

function parse(source: string) {
  return ts.createSourceFile(
    '/effects.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
}

function apply(source: string): string {
  const sourceFile = parse(source);
  const changes = replaceImport(
    sourceFile,
    '/effects.ts' as Path,
    '@ngrx/effects',
    'Effect',
    'createEffect'
  );

  let result = source;
  for (const change of [...changes].sort((a, b) => b.pos - a.pos)) {
    if (change instanceof RemoveChange) {
      result = result.slice(0, change.pos) + result.slice(change.end);
    } else if (change instanceof InsertChange) {
      result =
        result.slice(0, change.pos) + change.toAdd + result.slice(change.pos);
    } else if (change instanceof ReplaceChange) {
      result =
        result.slice(0, change.pos) +
        change.newText +
        result.slice(change.pos + change.oldText.length);
    }
  }

  return result;
}

describe('ast-utils', () => {
  describe('replaceImport', () => {
    it('renames the specifier in place when the new name is not already imported', () => {
      const result = apply(
        `import { Actions, Effect, ofType } from '@ngrx/effects';\n`
      );

      expect(result).toBe(
        `import { Actions, createEffect, ofType } from '@ngrx/effects';\n`
      );
    });

    it('removes the old specifier and its trailing comma when the new name is already imported and the old one is not last', () => {
      const result = apply(
        `import { Actions, Effect, createEffect, ofType } from '@ngrx/effects';\n`
      );

      expect(result).toBe(
        `import { Actions, createEffect, ofType } from '@ngrx/effects';\n`
      );
    });

    it('removes the old specifier and its preceding comma when the new name is already imported and the old one is last', () => {
      // Regression: the fix has to clean up the comma BEFORE the removed
      // specifier here, not after it - there is no "next" specifier to
      // anchor on. Previously left a dangling ", " behind.
      const result = apply(
        `import { Actions, ofType, createEffect, Effect } from '@ngrx/effects';\n`
      );

      expect(result).toBe(
        `import { Actions, ofType, createEffect } from '@ngrx/effects';\n`
      );
      expect(result).not.toContain(', }');
      expect(result).not.toContain(',}');
    });

    it('removes cleanly when the old specifier is the only other one and comes after the new name', () => {
      const result = apply(
        `import { createEffect, Effect } from '@ngrx/effects';\n`
      );

      expect(result).toBe(`import { createEffect } from '@ngrx/effects';\n`);
    });

    it('does nothing when the import is from a different module', () => {
      const source = `import { Effect } from '@ngrx/store';\n`;
      const sourceFile = parse(source);
      const changes = replaceImport(
        sourceFile,
        '/effects.ts' as Path,
        '@ngrx/effects',
        'Effect',
        'createEffect'
      );

      expect(changes).toEqual([]);
    });
  });
});
