import ts from 'typescript';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  RemoveChange,
  commitChanges,
} from '../../../schematics-core';

// createFeatureSelector<State, Feature>(...) is deprecated in favour of
// createFeatureSelector<Feature>(...): the root state generic goes.
function updateCreateFeatureSelectorGenerics(): Rule {
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
        if (node.typeArguments?.length !== 2) return;
        if (!isCreateFeatureSelector(node.expression, names)) return;

        // From the first generic to the second, so `<State, Feature>`
        // becomes `<Feature>` with no space left behind.
        changes.push(
          new RemoveChange(
            sourceFile.fileName,
            node.typeArguments[0].getStart(sourceFile),
            node.typeArguments[1].getStart(sourceFile)
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

// The names createFeatureSelector is imported under from '@ngrx/store', so
// aliases and namespace imports count too.
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
        if (
          (element.propertyName ?? element.name).text ===
          'createFeatureSelector'
        ) {
          names.functions.push(element.name.text);
        }
      }
    }
  }
  return names;
}

function isCreateFeatureSelector(
  callee: ts.Expression,
  names: LocalNames
): boolean {
  return (
    (ts.isIdentifier(callee) && names.functions.includes(callee.text)) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      names.namespaces.includes(callee.expression.text) &&
      callee.name.text === 'createFeatureSelector')
  );
}

export default function (): Rule {
  return chain([updateCreateFeatureSelectorGenerics()]);
}
