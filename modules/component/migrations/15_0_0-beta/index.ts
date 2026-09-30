import ts from 'typescript';
import {
  Rule,
  chain,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  createReplaceChange,
  Change,
} from '../../../schematics-core';

const reactiveComponentModuleText = 'ReactiveComponentModule';
const replacementModules = ['LetModule', 'PushModule'];

function migrateReactiveComponentModule() {
  return (tree: Tree, context: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      // Exactly '@ngrx/component': `includes` also matched
      // '@ngrx/component-store'.
      const componentImports = sourceFile.statements
        .filter(ts.isImportDeclaration)
        .filter(
          ({ moduleSpecifier }) =>
            ts.isStringLiteral(moduleSpecifier) &&
            moduleSpecifier.text === '@ngrx/component'
        );

      warnAboutNamespaceUse(sourceFile, componentImports, context);

      const specifiers = componentImports.flatMap((declaration) => {
        const bindings = declaration.importClause?.namedBindings;
        return bindings && ts.isNamedImports(bindings)
          ? bindings.elements.map((element) => ({ bindings, element }))
          : [];
      });

      // By the imported name, so `ReactiveComponentModule as RCM` counts too.
      const target = specifiers.find(
        ({ element }) => importedName(element) === reactiveComponentModuleText
      );
      if (!target) {
        return;
      }
      const localName = target.element.name.text;

      // LetModule and PushModule under the names the file already imports
      // them by, and the ones still to import (never twice).
      const moduleNames = replacementModules.map(
        (module) =>
          specifiers.find(({ element }) => importedName(element) === module)
            ?.element.name.text ?? module
      );
      const missingModules = replacementModules.filter(
        (module) =>
          !specifiers.some(({ element }) => importedName(element) === module)
      );

      const changes: Change[] = [];
      let otherUsages = 0;

      // In any array (NgModule, Component, TestBed, a shared constant, ...)
      // the module is replaced by both; any other use is left and counted.
      const visit = (node: ts.Node) => {
        if (
          ts.isIdentifier(node) &&
          node.text === localName &&
          node !== target.element.name &&
          !isPropertyName(node)
        ) {
          if (ts.isArrayLiteralExpression(node.parent)) {
            changes.push(
              createReplaceChange(
                sourceFile,
                node,
                node.text,
                moduleNames.join(', ')
              )
            );
          } else {
            otherUsages++;
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sourceFile, visit);

      // Keep ReactiveComponentModule while something else still uses it.
      const elements = target.bindings.elements.flatMap((element) =>
        element !== target.element
          ? [element.getText(sourceFile)]
          : otherUsages
            ? [element.getText(sourceFile), ...missingModules]
            : missingModules
      );
      changes.push(
        createReplaceChange(
          sourceFile,
          target.bindings,
          target.bindings.getText(sourceFile),
          `{ ${elements.join(', ')} }`
        )
      );

      if (otherUsages) {
        context.logger.warn(
          `[@ngrx/component] ${sourceFile.fileName} still uses ${reactiveComponentModuleText} outside an imports array; replace it with LetModule and PushModule`
        );
      }

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

function importedName(element: ts.ImportSpecifier): string {
  return (element.propertyName ?? element.name).text;
}

// `x.ReactiveComponentModule` or `{ ReactiveComponentModule: ... }` name
// something else.
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    ((ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent)) &&
      parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.propertyName === node)
  );
}

// `import * as c from '@ngrx/component'` with `c.ReactiveComponentModule`
// cannot be rewritten reliably; say so rather than leave it to fail.
function warnAboutNamespaceUse(
  sourceFile: ts.SourceFile,
  componentImports: ts.ImportDeclaration[],
  context: SchematicContext
) {
  const namespaceUse = componentImports.some((declaration) => {
    const bindings = declaration.importClause?.namedBindings;
    return (
      bindings &&
      ts.isNamespaceImport(bindings) &&
      sourceFile.text.includes(
        `${bindings.name.text}.${reactiveComponentModuleText}`
      )
    );
  });
  if (namespaceUse) {
    context.logger.warn(
      `[@ngrx/component] ${sourceFile.fileName} uses ${reactiveComponentModuleText} through a namespace import; replace it with LetModule and PushModule`
    );
  }
}

export default function (): Rule {
  return chain([migrateReactiveComponentModule()]);
}
