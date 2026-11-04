import ts from 'typescript';
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

import {
  findNodes,
  getSourceNodes,
  insertAfterLastOccurrence,
  getContentOfKeyLiteral,
  containsProperty,
} from './ast-utils';

describe('findNodes', () => {
  it('finds nodes of the requested syntax kind', () => {
    const sourceFile = parse('const a = 1; const b = 2;');

    expect(
      findNodes(sourceFile, ts.SyntaxKind.VariableDeclaration)
    ).toHaveLength(2);
    expect(
      findNodes(sourceFile, ts.SyntaxKind.VariableDeclaration, 1)
    ).toHaveLength(1);
  });
});

describe('getSourceNodes', () => {
  it('returns the source file and all of its child nodes', () => {
    const sourceFile = parse('const value = 1;');

    const nodes = getSourceNodes(sourceFile);

    expect(nodes[0]).toBe(sourceFile);
    expect(nodes.length).toBeGreaterThan(1);
  });
});

describe('insertAfterLastOccurrence', () => {
  it('returns an insert change positioned after the last node', () => {
    const sourceFile = parse('items(a, b);');
    const nodes = findNodes(sourceFile, ts.SyntaxKind.Identifier);
    const change = insertAfterLastOccurrence(
      nodes,
      ' /* inserted */',
      '/test.ts',
      0
    );

    expect(change).toBeInstanceOf(InsertChange);
    expect((change as InsertChange).toAdd).toBe(' /* inserted */');
  });
});

describe('getContentOfKeyLiteral', () => {
  it('returns identifier text and string literal values', () => {
    const sourceFile = parse('const demo = { foo: "bar" };');

    const identifiers = findNodes(sourceFile, ts.SyntaxKind.Identifier);
    const property = identifiers.find(
      (node) => node.getText(sourceFile) === 'foo'
    );
    const stringLiteral = findNodes(sourceFile, ts.SyntaxKind.StringLiteral)[0];

    expect(getContentOfKeyLiteral(sourceFile, property!)).toBe('foo');
    expect(getContentOfKeyLiteral(sourceFile, stringLiteral)).toBe('bar');
  });
});

describe('containsProperty', () => {
  it('detects whether an object literal has a property', () => {
    const sourceFile = parse('const obj = { present: true };');
    const objectLiteral = findNodes(
      sourceFile,
      ts.SyntaxKind.ObjectLiteralExpression
    )[0] as ts.ObjectLiteralExpression;

    expect(containsProperty(objectLiteral, 'present')).toBe(true);
    expect(containsProperty(objectLiteral, 'missing')).toBe(false);
  });
});
