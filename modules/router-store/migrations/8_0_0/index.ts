import ts from 'typescript';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  InsertChange,
  visitTSSourceFiles,
  commitChanges,
} from '../../../schematics-core';

const MODULE_NAME = 'StoreRouterConnectingModule';

function updateRouterStoreImport(): Rule {
  return (tree: Tree) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const names = findLocalNames(sourceFile);
      const changes: InsertChange[] = [];

      // A bare module in any array (NgModule or Component imports, TestBed,
      // a shared constant, ...): without forRoot() it provides nothing, so
      // the router state silently stops updating.
      // `exports` lists stay bare: a module with providers cannot be exported.
      const visit = (node: ts.Node) => {
        if (ts.isArrayLiteralExpression(node) && !isExportsList(node)) {
          for (const element of node.elements) {
            if (isRouterStoreModule(element, names)) {
              changes.push(
                new InsertChange(
                  sourceFile.fileName,
                  element.getEnd(),
                  '.forRoot()'
                )
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sourceFile, visit);

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

interface LocalNames {
  module: string[];
  namespaces: string[];
}

// The names StoreRouterConnectingModule is imported under from
// '@ngrx/router-store', so aliases and namespace imports count too; the bare
// name when the file does not import it.
function findLocalNames(sourceFile: ts.SourceFile): LocalNames {
  const names: LocalNames = { module: [], namespaces: [] };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@ngrx/router-store'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      names.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === MODULE_NAME) {
          names.module.push(element.name.text);
        }
      }
    }
  }
  if (!names.module.length && !names.namespaces.length) {
    names.module.push(MODULE_NAME);
  }
  return names;
}

function isExportsList(array: ts.ArrayLiteralExpression): boolean {
  const parent = array.parent;
  return (
    ts.isPropertyAssignment(parent) &&
    ts.isIdentifier(parent.name) &&
    parent.name.text === 'exports'
  );
}

function isRouterStoreModule(
  element: ts.Expression,
  names: LocalNames
): boolean {
  return (
    (ts.isIdentifier(element) && names.module.includes(element.text)) ||
    (ts.isPropertyAccessExpression(element) &&
      ts.isIdentifier(element.expression) &&
      names.namespaces.includes(element.expression.text) &&
      element.name.text === MODULE_NAME)
  );
}

export default function (): Rule {
  return chain([updateRouterStoreImport()]);
}
