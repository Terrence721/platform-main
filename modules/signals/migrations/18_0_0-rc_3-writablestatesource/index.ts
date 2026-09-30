import ts from 'typescript';
import {
  Tree,
  Rule,
  chain,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  commitChanges,
  createReplaceChange,
  replaceImport,
  visitTSSourceFiles,
} from '../../../schematics-core';
import { Path } from '@angular-devkit/core';

export function migrateWritableStateSource(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    let updateCounter = 0;
    ctx.logger.info(
      `[@ngrx/signals] Migrating 'StateSignal' to 'WritableStateSource'`
    );

    visitTSSourceFiles(tree, (sourceFile) => {
      const changes = replaceImport(
        sourceFile,
        sourceFile.fileName as Path,
        '@ngrx/signals',
        'StateSignal',
        'WritableStateSource'
      );

      const { importedUnderOwnName, namespaces } =
        findSignalsImports(sourceFile);

      if (importedUnderOwnName || namespaces.length) {
        visitIdentifiers(sourceFile, (node) => {
          if (
            node.text === 'StateSignal' &&
            isStateSignalReference(node, importedUnderOwnName, namespaces)
          ) {
            changes.push(
              createReplaceChange(
                sourceFile,
                node,
                'StateSignal',
                'WritableStateSource'
              )
            );
            updateCounter++;
          }
        });
      }

      commitChanges(tree, sourceFile.fileName, changes);
    });

    if (updateCounter) {
      ctx.logger.info(
        `[@ngrx/signals] Updated ${updateCounter} references from 'StateSignal' to 'WritableStateSource'`
      );
    } else {
      ctx.logger.info(
        `[@ngrx/signals] No 'StateSignal' references found, skipping the migration`
      );
    }
  };
}

function findSignalsImports(sourceFile: ts.SourceFile) {
  let importedUnderOwnName = false;
  const namespaces: string[] = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@ngrx/signals'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      importedUnderOwnName ||= bindings.elements.some(
        (element) =>
          !element.propertyName && element.name.text === 'StateSignal'
      );
    }
  }
  return { importedUnderOwnName, namespaces };
}

// A use of the imported StateSignal: a bare reference when it is imported
// under its own name (an aliased import is renamed in the import only), or
// `ns.StateSignal` through a namespace import. Object keys and properties of
// other objects are left alone.
function isStateSignalReference(
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

function visitIdentifiers(
  node: ts.Node,
  visitor: (node: ts.Identifier) => void
) {
  if (ts.isIdentifier(node)) {
    visitor(node);
  }

  ts.forEachChild(node, (childNode) => visitIdentifiers(childNode, visitor));
}

export default function (): Rule {
  return chain([migrateWritableStateSource()]);
}
