import ts from 'typescript';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  RemoveChange,
  commitChanges,
} from '../../../schematics-core';

// createFeature no longer takes the root state as a type argument:
// createFeature<AppState>({ name, reducer }) becomes createFeature({ ... }),
// with the type arguments inferred.
function updateCreateFeature(): Rule {
  return (tree: Tree) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const names = findLocalNames(sourceFile);
      if (!names.functions.length && !names.namespaces.length) return;

      const changes: RemoveChange[] = [];
      ts.forEachChild(sourceFile, crawl);
      return commitChanges(tree, sourceFile.fileName, changes);

      function crawl(node: ts.Node) {
        ts.forEachChild(node, crawl);

        if (!ts.isCallExpression(node)) return;
        if (!node.typeArguments?.length) return;
        if (!isCreateFeature(node.expression, names)) return;

        // Everything between the function name and `(`, so `<AppState>` goes
        // however it is spaced or broken over lines.
        changes.push(
          new RemoveChange(
            sourceFile.fileName,
            node.expression.getEnd(),
            node.arguments.pos - 1
          )
        );
      }
    });
  };
}

interface LocalNames {
  functions: string[];
  namespaces: string[];
}

// The names createFeature is imported under from '@ngrx/store', so aliases
// and namespace imports count too (and createFeatureSelector does not).
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
        if ((element.propertyName ?? element.name).text === 'createFeature') {
          names.functions.push(element.name.text);
        }
      }
    }
  }
  return names;
}

function isCreateFeature(callee: ts.Expression, names: LocalNames): boolean {
  return (
    (ts.isIdentifier(callee) && names.functions.includes(callee.text)) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      names.namespaces.includes(callee.expression.text) &&
      callee.name.text === 'createFeature')
  );
}

export default function (): Rule {
  return chain([updateCreateFeature()]);
}
