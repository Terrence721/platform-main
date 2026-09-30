import {
  Change,
  commitChanges,
  createRemoveChange,
  createReplaceChange,
  visitTSSourceFiles,
} from '../../../schematics-core';
import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import ts from 'typescript';

const EVENTS_PKG = '@ngrx/signals/events';
const OLD_NAME = 'withEffects';
const NEW_NAME = 'withEventHandlers';

export default function migrateWithEventHandlers(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const changes: Change[] = [];
      const namespaceImports = new Set<string>();
      // The local name `withEffects` was imported under, when not aliased,
      // and the name its uses are renamed to.
      let directImport:
        { specifier: ts.ImportSpecifier; newName: string } | undefined;

      for (const statement of sourceFile.statements) {
        if (!isFromEventsPackage(statement)) {
          continue;
        }

        if (ts.isExportDeclaration(statement)) {
          // `export { withEffects } from '@ngrx/signals/events'`: the old
          // name no longer exists; keep the file's public name.
          renameExportSpecifiers(sourceFile, statement, changes);
          continue;
        }

        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          namespaceImports.add(bindings.name.text);
        }
        if (!bindings || !ts.isNamedImports(bindings)) {
          continue;
        }

        // `withEventHandlers` already imported: reuse it, never import twice.
        const existing = bindings.elements.find(
          (spec) => (spec.propertyName ?? spec.name).text === NEW_NAME
        );

        for (const spec of bindings.elements) {
          const importedName = spec.propertyName ?? spec.name;
          if (importedName.text !== OLD_NAME) {
            continue;
          }

          if (spec.propertyName) {
            // `withEffects as x`: renaming the import keeps every use valid.
            changes.push(
              createReplaceChange(sourceFile, importedName, OLD_NAME, NEW_NAME)
            );
          } else if (existing) {
            changes.push(removeSpecifier(sourceFile, bindings, spec));
            directImport = { specifier: spec, newName: existing.name.text };
          } else {
            changes.push(
              createReplaceChange(sourceFile, importedName, OLD_NAME, NEW_NAME)
            );
            directImport = { specifier: spec, newName: NEW_NAME };
          }
        }
      }

      if (directImport) {
        renameReferences(sourceFile, directImport, changes);
      }

      if (namespaceImports.size > 0) {
        visit(sourceFile, (node) => {
          if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            namespaceImports.has(node.expression.text) &&
            node.name.text === OLD_NAME
          ) {
            changes.push(
              createReplaceChange(sourceFile, node.name, OLD_NAME, NEW_NAME)
            );
          }
        });
      }

      if (changes.length) {
        commitChanges(tree, sourceFile.fileName, changes);
        ctx.logger.info(
          `[@ngrx/signals] Renamed '${OLD_NAME}' to '${NEW_NAME}' in ${sourceFile.fileName}`
        );
      }
    });
  };
}

function isFromEventsPackage(
  statement: ts.Statement
): statement is ts.ImportDeclaration | ts.ExportDeclaration {
  return (
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
    !!statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === EVENTS_PKG
  );
}

function renameExportSpecifiers(
  sourceFile: ts.SourceFile,
  declaration: ts.ExportDeclaration,
  changes: Change[]
) {
  const clause = declaration.exportClause;
  if (!clause || !ts.isNamedExports(clause)) {
    return;
  }
  for (const spec of clause.elements) {
    const exportedFrom = spec.propertyName ?? spec.name;
    if (exportedFrom.text !== OLD_NAME) {
      continue;
    }
    changes.push(
      spec.propertyName
        ? createReplaceChange(sourceFile, spec.propertyName, OLD_NAME, NEW_NAME)
        : createReplaceChange(
            sourceFile,
            spec.name,
            OLD_NAME,
            `${NEW_NAME} as ${OLD_NAME}`
          )
    );
  }
}

// Every use of the imported `withEffects`: calls, plain references,
// `typeof`, shorthand properties and local exports. Property names and
// declarations that shadow the import (a parameter or local variable of the
// same name) are left alone.
function renameReferences(
  sourceFile: ts.SourceFile,
  { specifier, newName }: { specifier: ts.ImportSpecifier; newName: string },
  changes: Change[]
) {
  visit(sourceFile, (node) => {
    if (
      !ts.isIdentifier(node) ||
      node.text !== OLD_NAME ||
      node === specifier.name ||
      isPropertyName(node) ||
      isDeclarationName(node) ||
      isShadowed(node)
    ) {
      return;
    }

    const parent = node.parent;
    if (ts.isShorthandPropertyAssignment(parent)) {
      // `{ withEffects }` keeps its key.
      changes.push(
        createReplaceChange(
          sourceFile,
          node,
          OLD_NAME,
          `${OLD_NAME}: ${newName}`
        )
      );
    } else if (ts.isExportSpecifier(parent) && !parent.propertyName) {
      // `export { withEffects }` keeps the file's public name.
      changes.push(
        createReplaceChange(
          sourceFile,
          node,
          OLD_NAME,
          `${newName} as ${OLD_NAME}`
        )
      );
    } else {
      changes.push(createReplaceChange(sourceFile, node, OLD_NAME, newName));
    }
  });
}

function removeSpecifier(
  sourceFile: ts.SourceFile,
  bindings: ts.NamedImports,
  spec: ts.ImportSpecifier
): Change {
  const index = bindings.elements.indexOf(spec);
  const next = bindings.elements[index + 1];
  const previous = bindings.elements[index - 1];
  return next
    ? createRemoveChange(
        sourceFile,
        spec,
        spec.getStart(sourceFile),
        next.getStart(sourceFile)
      )
    : createRemoveChange(sourceFile, spec, previous.getEnd(), spec.getEnd());
}

// `obj.withEffects`, `ns.withEffects` in a type, `{ withEffects: ... }`, a
// class or interface member, or the public name in `export { x as withEffects }`.
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isQualifiedName(parent)) {
    return parent.right === node;
  }
  if (ts.isExportSpecifier(parent)) {
    return parent.name === node && !!parent.propertyName;
  }
  return (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent)) &&
    parent.name === node
  );
}

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    (ts.isParameter(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isFunctionDeclaration(parent)) &&
    parent.name === node
  );
}

// A parameter or local variable of the same name in an enclosing function
// or block hides the import.
function isShadowed(node: ts.Identifier): boolean {
  for (
    let scope = node.parent;
    scope && !ts.isSourceFile(scope);
    scope = scope.parent
  ) {
    if (
      ts.isFunctionLike(scope) &&
      scope.parameters.some(
        (param) => ts.isIdentifier(param.name) && param.name.text === OLD_NAME
      )
    ) {
      return true;
    }
    if (
      ts.isBlock(scope) &&
      scope.statements.some(
        (statement) =>
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === OLD_NAME
          )
      )
    ) {
      return true;
    }
  }
  return false;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}
