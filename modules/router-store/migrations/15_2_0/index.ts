import ts from 'typescript';
import { Path } from '@angular-devkit/core';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  createReplaceChange,
  replaceImport,
  Change,
} from '../../../schematics-core';

const OLD_NAME = 'getSelectors';
const NEW_NAME = 'getRouterSelectors';

function renameSelector() {
  return (tree: Tree) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      // Only the imported name is replaced, so `type` modifiers and aliases
      // are kept; an aliased import keeps its local name in the code.
      const changes: Change[] = replaceImport(
        sourceFile,
        sourceFile.fileName as Path,
        '@ngrx/router-store',
        OLD_NAME,
        NEW_NAME
      );

      const { importedUnderOwnName, namespaces } = findImports(sourceFile);
      if (importedUnderOwnName || namespaces.length) {
        visit(sourceFile, (node) => {
          if (
            ts.isIdentifier(node) &&
            node.text === OLD_NAME &&
            isSelectorReference(node, importedUnderOwnName, namespaces)
          ) {
            changes.push(
              createReplaceChange(sourceFile, node, OLD_NAME, NEW_NAME)
            );
          }
        });
      }

      if (changes.length) {
        commitChanges(tree, sourceFile.fileName, changes);
      }
    });
  };
}

function findImports(sourceFile: ts.SourceFile) {
  let importedUnderOwnName = false;
  const namespaces: string[] = [];
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
      namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      importedUnderOwnName ||= bindings.elements.some(
        (element) => !element.propertyName && element.name.text === OLD_NAME
      );
    }
  }
  return { importedUnderOwnName, namespaces };
}

// A use of the imported getSelectors, wherever it is (a call, `typeof`, a
// reference): a bare reference when it is imported under its own name, or
// `ns.getSelectors` through a namespace import. Object keys and properties
// of other objects (`store.getSelectors`) are left alone.
function isSelectorReference(
  node: ts.Identifier,
  importedUnderOwnName: boolean,
  namespaces: string[]
): boolean {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent)) {
    return false;
  }
  if (
    (ts.isQualifiedName(parent) && parent.right === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node)
  ) {
    const left = ts.isQualifiedName(parent) ? parent.left : parent.expression;
    return ts.isIdentifier(left) && namespaces.includes(left.text);
  }
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  return importedUnderOwnName;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

export default function (): Rule {
  return chain([renameSelector()]);
}
