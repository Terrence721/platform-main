import ts from 'typescript';
import { Path } from '@angular-devkit/core';
import { Rule, chain, Tree } from '@angular-devkit/schematics';
import {
  Change,
  createReplaceChange,
  replaceImport,
  visitTSSourceFiles,
  commitChanges,
} from '../../../schematics-core';

const OLD_NAME = 'META_REDUCERS';
const NEW_NAME = 'USER_PROVIDED_META_REDUCERS';

// v8 made META_REDUCERS the token NgRx combines internally; an app's own
// meta-reducers go through USER_PROVIDED_META_REDUCERS.
function updateMetaReducersToken(): Rule {
  return (tree: Tree) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      // Only a META_REDUCERS imported from '@ngrx/store' (single or double
      // quotes); `type` modifiers and aliases are kept, and an aliased import
      // keeps its local name in the code.
      const changes: Change[] = replaceImport(
        sourceFile,
        sourceFile.fileName as Path,
        '@ngrx/store',
        OLD_NAME,
        NEW_NAME
      );

      const { importedUnderOwnName, namespaces } = findImports(sourceFile);
      if (importedUnderOwnName || namespaces.length) {
        visit(sourceFile, (node) => {
          if (
            ts.isIdentifier(node) &&
            node.text === OLD_NAME &&
            isTokenReference(node, importedUnderOwnName, namespaces)
          ) {
            changes.push(
              createReplaceChange(sourceFile, node, OLD_NAME, NEW_NAME)
            );
          }
        });
      }

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

export default function (): Rule {
  return chain([updateMetaReducersToken()]);
}

function findImports(sourceFile: ts.SourceFile) {
  let importedUnderOwnName = false;
  const namespaces: string[] = [];
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
      namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      importedUnderOwnName ||= bindings.elements.some(
        (element) => !element.propertyName && element.name.text === OLD_NAME
      );
    }
  }
  return { importedUnderOwnName, namespaces };
}

// A use of the imported token, wherever it is (`provide:`, `inject()`,
// `@Inject()`, ...): a bare reference when it is imported under its own name,
// or `ns.META_REDUCERS` through a namespace import. Object keys and
// properties of other objects are left alone.
function isTokenReference(
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
