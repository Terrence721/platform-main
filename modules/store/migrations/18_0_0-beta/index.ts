import ts from 'typescript';
import {
  Tree,
  Rule,
  chain,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  Change,
  commitChanges,
  createReplaceChange,
  InsertChange,
  visitTSSourceFiles,
} from '../../../schematics-core';
import { createRemoveChange } from '../../../schematics-core/utility/change';

const storeModelsPath = '@ngrx/store/src/models';

// TypedAction (from @ngrx/store/src/models) was removed in favour of Action
// from @ngrx/store.
export function migrateStoreTypedAction(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const imports = sourceFile.statements.filter(ts.isImportDeclaration);

      // The models import that holds TypedAction, matched by its imported
      // name, so `TypedAction as TA` counts too; files without it are left
      // alone.
      const models = imports
        .filter((node) => isFrom(node, storeModelsPath))
        .map((declaration) => {
          const bindings = declaration.importClause?.namedBindings;
          const element =
            bindings && ts.isNamedImports(bindings)
              ? bindings.elements.find(
                  (spec) => importedName(spec) === 'TypedAction'
                )
              : undefined;
          return element && bindings && ts.isNamedImports(bindings)
            ? { declaration, bindings, element }
            : undefined;
        })
        .find(Boolean);
      if (!models) {
        return;
      }

      const changes: Change[] = [];
      const text = sourceFile.getFullText();
      const typeOnly =
        models.element.isTypeOnly ||
        !!models.declaration.importClause?.isTypeOnly;

      // Action under the name the file already imports it by; otherwise
      // under TypedAction's local name (`Action as TA` for an alias), so the
      // uses only need renaming when TypedAction was imported without an
      // alias.
      const storeImport = imports.find((node) => isFrom(node, '@ngrx/store'));
      const storeBindings = storeImport?.importClause?.namedBindings;
      const existingAction =
        storeBindings && ts.isNamedImports(storeBindings)
          ? storeBindings.elements.find(
              (spec) => importedName(spec) === 'Action'
            )
          : undefined;
      const localName = models.element.name.text;
      const actionName = existingAction?.name.text ?? localName;
      const actionSpecifier = `${typeOnly ? 'type ' : ''}${
        localName === 'TypedAction' ? 'Action' : `Action as ${localName}`
      }`;
      const newName = existingAction ? actionName : 'Action';
      const renameUses =
        localName === 'TypedAction' || !!existingAction
          ? { from: localName, to: newName }
          : undefined;

      // Remove TypedAction from the models import, keeping the other
      // specifiers as written (aliases and `type` included), or the whole
      // import with its line break.
      const lineBreak = lineBreakAfter(text, models.declaration.getEnd());
      const afterModelsLine = models.declaration.getEnd() + lineBreak.length;
      const otherModelImports = models.bindings.elements
        .filter((spec) => spec !== models.element)
        .map((spec) => spec.getText(sourceFile));
      if (otherModelImports.length) {
        changes.push(
          createReplaceChange(
            sourceFile,
            models.bindings,
            models.bindings.getText(sourceFile),
            `{ ${otherModelImports.join(', ')} }`
          )
        );
      } else {
        changes.push(
          createRemoveChange(
            sourceFile,
            models.declaration,
            models.declaration.getStart(sourceFile),
            afterModelsLine
          )
        );
      }

      // Import Action unless it already is.
      if (!existingAction) {
        if (storeBindings && ts.isNamedImports(storeBindings)) {
          const specifiers = [
            ...storeBindings.elements.map((spec) => spec.getText(sourceFile)),
            actionSpecifier,
          ];
          changes.push(
            createReplaceChange(
              sourceFile,
              storeBindings,
              storeBindings.getText(sourceFile),
              `{ ${specifiers.join(', ')} }`
            )
          );
        } else {
          const lineBefore = !lineBreak && otherModelImports.length ? '\n' : '';
          changes.push(
            new InsertChange(
              sourceFile.fileName,
              afterModelsLine,
              `${lineBefore}import { ${actionSpecifier} } from '@ngrx/store';${lineBreak}`
            )
          );
        }
      }

      if (renameUses && renameUses.from !== renameUses.to) {
        visit(sourceFile, (node) => {
          if (
            ts.isIdentifier(node) &&
            node.text === renameUses.from &&
            isReference(node)
          ) {
            changes.push(
              createReplaceChange(
                sourceFile,
                node,
                renameUses.from,
                renameUses.to
              )
            );
          }
        });
      }

      commitChanges(tree, sourceFile.fileName, changes);
      ctx.logger.info(
        `[@ngrx/store] ${sourceFile.fileName}: Replaced TypedAction to Action`
      );
    });
  };
}

// The line break right after a node: none (last line), LF or CRLF.
function lineBreakAfter(text: string, end: number): string {
  return text.startsWith('\r\n', end)
    ? '\r\n'
    : text.startsWith('\n', end)
      ? '\n'
      : '';
}

function importedName(spec: ts.ImportSpecifier): string {
  return (spec.propertyName ?? spec.name).text;
}

// Exact module, so '@ngrx/store-devtools' is not '@ngrx/store'.
function isFrom(node: ts.ImportDeclaration, moduleName: string): boolean {
  return (
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName
  );
}

// A use of the type, not an import specifier, an object key or a property of
// another object.
function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent)) {
    return false;
  }
  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  if (ts.isQualifiedName(parent) && parent.right === node) {
    return false;
  }
  return true;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

export default function (): Rule {
  return chain([migrateStoreTypedAction()]);
}
