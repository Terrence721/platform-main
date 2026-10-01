import ts from 'typescript';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  InsertChange,
} from '../../../schematics-core';

// createSelector<State, S1, S2, Result>(s1, s2, projector) becomes
// createSelector<State, [S1, S2], Result>(...): the slice types go into a
// tuple.
function updateCreateSelectorGenerics(): Rule {
  return (tree: Tree) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const names = findLocalNames(sourceFile);
      if (!names.functions.length && !names.namespaces.length) return;

      const changes: InsertChange[] = [];
      ts.forEachChild(sourceFile, crawl);
      return commitChanges(tree, sourceFile.fileName, changes);

      function crawl(node: ts.Node) {
        ts.forEachChild(node, crawl);

        if (!ts.isCallExpression(node)) return;

        const { typeArguments } = node;
        if (!typeArguments || typeArguments.length < 3) return;
        if (!isCreateSelector(node.expression, names)) return;

        // A selector with props has one more generic than it has slices
        // plus the result; it is left as it is.
        const isSelectorWithProps =
          node.arguments.length === typeArguments.length - 2;
        if (isSelectorWithProps) return;

        // Only brackets are inserted around the slice types, so their
        // spacing, line breaks and comments are kept.
        const firstSlice = typeArguments[1];
        const lastSlice = typeArguments[typeArguments.length - 2];
        changes.push(
          new InsertChange(
            sourceFile.fileName,
            firstSlice.getStart(sourceFile),
            '['
          ),
          new InsertChange(sourceFile.fileName, lastSlice.getEnd(), ']')
        );
      }
    });
  };
}

interface LocalNames {
  functions: string[];
  namespaces: string[];
}

// The names createSelector is imported under from '@ngrx/store', so aliases
// and namespace imports count too.
function findLocalNames(sourceFile: ts.SourceFile): LocalNames {
  const names: LocalNames = { functions: [], namespaces: [] };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@ngrx/store'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      names.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === 'createSelector') {
          names.functions.push(element.name.text);
        }
      }
    }
  }
  return names;
}

function isCreateSelector(callee: ts.Expression, names: LocalNames): boolean {
  return (
    (ts.isIdentifier(callee) && names.functions.includes(callee.text)) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      names.namespaces.includes(callee.expression.text) &&
      callee.name.text === 'createSelector')
  );
}

export default function (): Rule {
  return chain([updateCreateSelectorGenerics()]);
}
