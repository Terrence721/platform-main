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

// Each deprecated module and the standalone API that replaces it.
const replacements = {
  LetModule: 'LetDirective',
  PushModule: 'PushPipe',
} as const;
type ModuleName = keyof typeof replacements;
const moduleNames = Object.keys(replacements) as ModuleName[];

function migrateToStandaloneAPIs() {
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
      const findImport = (name: string) =>
        specifiers.find(({ element }) => importedName(element) === name);

      const changes: Change[] = [];
      // The new text of each named imports list that changes.
      const newImports = new Map<ts.NamedImports, string[]>();

      for (const moduleName of moduleNames) {
        // By the imported name, so `LetModule as LM` counts too.
        const target = findImport(moduleName);
        if (!target) {
          continue;
        }
        const localName = target.element.name.text;
        const replacement = replacements[moduleName];
        // The name the file already imports the replacement by, if any; it
        // is then not imported again.
        const existing = findImport(replacement);
        const replacementName = existing?.element.name.text ?? replacement;

        // In any array (NgModule, Component, TestBed, a shared constant,
        // ...) the module is replaced; any other use is left and counted,
        // for this module only.
        let otherUsages = 0;
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
                  replacementName
                )
              );
            } else {
              otherUsages++;
            }
          }
          ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);

        // Keep the module while something else still uses it.
        const elements =
          newImports.get(target.bindings) ??
          target.bindings.elements.map((element) =>
            element.getText(sourceFile)
          );
        const index = elements.indexOf(target.element.getText(sourceFile));
        const added = existing ? [] : [replacement];
        elements.splice(
          index,
          1,
          ...(otherUsages
            ? [target.element.getText(sourceFile), ...added]
            : added)
        );
        newImports.set(target.bindings, elements);

        if (otherUsages) {
          context.logger.warn(
            `[@ngrx/component] ${sourceFile.fileName} still uses ${moduleName} outside an imports array; replace it with ${replacement}`
          );
        }
      }

      for (const [bindings, elements] of newImports) {
        changes.push(
          createReplaceChange(
            sourceFile,
            bindings,
            bindings.getText(sourceFile),
            `{ ${elements.join(', ')} }`
          )
        );
      }

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

function importedName(element: ts.ImportSpecifier): string {
  return (element.propertyName ?? element.name).text;
}

// `x.LetModule` or `{ LetModule: ... }` name something else.
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    ((ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent)) &&
      parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.propertyName === node)
  );
}

// `import * as c from '@ngrx/component'` with `c.LetModule` cannot be
// rewritten reliably; say so rather than leave it to fail.
function warnAboutNamespaceUse(
  sourceFile: ts.SourceFile,
  componentImports: ts.ImportDeclaration[],
  context: SchematicContext
) {
  for (const declaration of componentImports) {
    const bindings = declaration.importClause?.namedBindings;
    if (!bindings || !ts.isNamespaceImport(bindings)) {
      continue;
    }
    for (const moduleName of moduleNames) {
      if (sourceFile.text.includes(`${bindings.name.text}.${moduleName}`)) {
        context.logger.warn(
          `[@ngrx/component] ${sourceFile.fileName} uses ${moduleName} through a namespace import; replace it with ${replacements[moduleName]}`
        );
      }
    }
  }
}

export default function (): Rule {
  return chain([migrateToStandaloneAPIs()]);
}
