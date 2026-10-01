import ts from 'typescript';
import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  commitChanges,
  visitTSSourceFiles,
  createReplaceChange,
  ReplaceChange,
} from '../../../schematics-core';

const OLD_KEY = 'resubscribeOnError';
const NEW_KEY = 'useEffectsErrorHandler';

function renameErrorHandlerConfig(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const changes: ReplaceChange[] = replaceEffectConfigKeys(
        sourceFile,
        (message) =>
          ctx.logger.warn(`[@ngrx/effects] ${sourceFile.fileName}: ${message}`)
      );

      commitChanges(tree, sourceFile.fileName, changes);

      if (changes.length) {
        ctx.logger.info(
          `[@ngrx/effects] Updated Effects configuration, see the migration guide (https://ngrx.io/guide/migration/v9#effects) for more info`
        );
      }
    });
  };
}

function replaceEffectConfigKeys(
  sourceFile: ts.SourceFile,
  warn: (message: string) => void
): ReplaceChange[] {
  const changes: ReplaceChange[] = [];
  const names = findLocalNames(sourceFile);

  visit(sourceFile, (node) => {
    // createEffect(source, { resubscribeOnError: false })
    if (
      ts.isCallExpression(node) &&
      isImported(node.expression, names.createEffect, 'createEffect', names)
    ) {
      const [, config] = node.arguments;
      if (config) {
        renameConfigKey(config);
      }
    }

    // @Effect({ resubscribeOnError: false })
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      isImported(node.expression.expression, names.effect, 'Effect', names)
    ) {
      const [config] = node.expression.arguments;
      if (config) {
        renameConfigKey(config);
      }
    }
  });

  return changes;

  // Only the config object's own key: the value can be a variable or
  // property that is itself named `resubscribeOnError`.
  function renameConfigKey(config: ts.Expression) {
    if (!ts.isObjectLiteralExpression(config)) {
      if (sourceFile.text.includes(OLD_KEY)) {
        warn(
          `the effect config '${config.getText(sourceFile)}' is not an object literal; rename ${OLD_KEY} to ${NEW_KEY} in it`
        );
      }
      return;
    }
    for (const property of config.properties) {
      if (ts.isPropertyAssignment(property)) {
        if (
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name)) &&
          property.name.text === OLD_KEY
        ) {
          changes.push(
            createReplaceChange(
              sourceFile,
              property.name,
              property.name.getText(sourceFile),
              NEW_KEY
            )
          );
        }
      } else if (
        ts.isShorthandPropertyAssignment(property) &&
        property.name.text === OLD_KEY
      ) {
        // `{ resubscribeOnError }` reads a variable of that name.
        changes.push(
          createReplaceChange(
            sourceFile,
            property.name,
            OLD_KEY,
            `${NEW_KEY}: ${OLD_KEY}`
          )
        );
      }
    }
  }
}

interface LocalNames {
  createEffect: string[];
  effect: string[];
  namespaces: string[];
}

// The names `createEffect` and `Effect` are imported under from
// '@ngrx/effects', so aliases and namespace imports count too.
function findLocalNames(sourceFile: ts.SourceFile): LocalNames {
  const names: LocalNames = { createEffect: [], effect: [], namespaces: [] };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@ngrx/effects'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      names.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (importedName === 'createEffect') {
          names.createEffect.push(element.name.text);
        } else if (importedName === 'Effect') {
          names.effect.push(element.name.text);
        }
      }
    }
  }
  return names;
}

function isImported(
  expression: ts.Expression,
  localNames: string[],
  importedName: string,
  names: LocalNames
): boolean {
  return (
    (ts.isIdentifier(expression) && localNames.includes(expression.text)) ||
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      names.namespaces.includes(expression.expression.text) &&
      expression.name.text === importedName)
  );
}

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

export default function (): Rule {
  return chain([renameErrorHandlerConfig()]);
}
