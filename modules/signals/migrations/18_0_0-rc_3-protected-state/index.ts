import {
  Change,
  createReplaceChange,
  visitTSSourceFiles,
  commitChanges,
  InsertChange,
} from '../../../schematics-core';
import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import ts from 'typescript';
import { visitImportDeclaration } from '../../../schematics-core/utility/visitors';

export default function migrateProtectedState(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const signalStoreImportedName = findImportedName(sourceFile);
      if (!signalStoreImportedName) {
        return;
      }

      const changes: Change[] = [];
      visitCallExpression(sourceFile, signalStoreImportedName, (node) => {
        if (node.arguments.length > 0) {
          const config = node.arguments[0];
          if (ts.isObjectLiteralExpression(config)) {
            // signalStore({ providedIn: 'root' }) or signalStore({})
            const { properties } = config;
            // An explicit protectedState is kept: adding one would be a
            // duplicate property.
            const hasProtectedState = properties.some(
              (property) =>
                property.name &&
                (ts.isIdentifier(property.name) ||
                  ts.isStringLiteral(property.name)) &&
                property.name.text === 'protectedState'
            );

            if (!hasProtectedState) {
              const last = properties[properties.length - 1];
              changes.push(
                last
                  ? new InsertChange(
                      sourceFile.fileName,
                      last.getEnd(),
                      ', protectedState: false'
                    )
                  : createReplaceChange(
                      sourceFile,
                      config,
                      config.getText(),
                      '{ protectedState: false }'
                    )
              );
            }
          } else {
            // signalStore(withState({}))
            const firstFeature = node.arguments[0];
            changes.push(
              createReplaceChange(
                sourceFile,
                firstFeature,
                firstFeature.getText(),
                `{ protectedState: false }, ${firstFeature.getText()}`
              )
            );
          }
        } else {
          // signalStore()
          changes.push(
            createReplaceChange(
              sourceFile,
              node,
              node.getText(),
              `${signalStoreImportedName}({ protectedState: false })`
            )
          );
        }
      });

      if (changes.length) {
        commitChanges(tree, sourceFile.fileName, changes);
        ctx.logger.info(
          `[@ngrx/signals] Disable protected state in ${sourceFile.fileName}`
        );
      }
    });
  };
}

function visitCallExpression(
  node: ts.Node,
  name: string,
  callback: (callExpression: ts.CallExpression) => void
) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  ) {
    callback(node);
  }

  ts.forEachChild(node, (child) => {
    visitCallExpression(child, name, callback);
  });
}

function findImportedName(source: ts.SourceFile) {
  let importedName = '';
  visitImportDeclaration(source, (importDeclaration) => {
    // signalStore comes from '@ngrx/signals' itself, not its entry points.
    if (
      ts.isStringLiteral(importDeclaration.moduleSpecifier) &&
      importDeclaration.moduleSpecifier.text === '@ngrx/signals'
    ) {
      if (importedName) {
        return;
      }

      const namedBindings = importDeclaration.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        const foundImportedName = namedBindings.elements
          .map((importSpecifier) => {
            if (
              importSpecifier.propertyName &&
              importSpecifier.propertyName.text === 'signalStore'
            ) {
              return importSpecifier.name.text;
            } else if (importSpecifier.name.text === 'signalStore') {
              return 'signalStore';
            }
            return undefined;
          })
          .find(Boolean);

        if (foundImportedName) {
          importedName = foundImportedName;
          return;
        }
      }
    }
  });

  return importedName;
}
