import { Rule, Tree, SchematicContext } from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  Change,
  InsertChange,
} from '../../../schematics-core';
import { visitCallExpression } from '../../../schematics-core/utility/visitors';
import ts from 'typescript';

export default function migrateTapResponse(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile: ts.SourceFile) => {
      const changes: Change[] = [];

      // Local names of tapResponse from @ngrx/operators, matched by the
      // imported name so `tapResponse as tr` counts and other imports do not.
      const tapResponseIdentifiers = new Set<string>();
      const namespaceImportsFromOperators = new Set<string>();
      const aliasedTapResponseVariables = new Set<string>();

      // Collect import origins and aliases
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.importClause?.namedBindings
        ) {
          const moduleName = node.moduleSpecifier.text;
          const bindings = node.importClause.namedBindings;

          if (ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
              const importedName = (element.propertyName ?? element.name).text;
              if (
                moduleName === '@ngrx/operators' &&
                importedName === 'tapResponse'
              ) {
                tapResponseIdentifiers.add(element.name.text);
              }
            }
          } else if (ts.isNamespaceImport(bindings)) {
            if (moduleName === '@ngrx/operators') {
              namespaceImportsFromOperators.add(bindings.name.text);
            }
          }
        }

        // Track variables assigned to known tapResponse identifiers from @ngrx/operators
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (
              ts.isIdentifier(decl.name) &&
              decl.initializer &&
              ts.isIdentifier(decl.initializer)
            ) {
              const original = decl.initializer.text;
              if (tapResponseIdentifiers.has(original)) {
                aliasedTapResponseVariables.add(decl.name.text);
              }
            }
          }
        }
      });

      // Combine aliases into the main set
      for (const alias of aliasedTapResponseVariables) {
        tapResponseIdentifiers.add(alias);
      }

      visitCallExpression(sourceFile, (node: ts.CallExpression) => {
        const { expression, arguments: args } = node;

        let isTapResponseCall = false;

        if (ts.isIdentifier(expression)) {
          if (tapResponseIdentifiers.has(expression.text)) {
            isTapResponseCall = true;
          }
        } else if (ts.isPropertyAccessExpression(expression)) {
          const namespace = expression.expression.getText();
          const fnName = expression.name.text;
          if (
            fnName === 'tapResponse' &&
            namespaceImportsFromOperators.has(namespace)
          ) {
            isTapResponseCall = true;
          }
        }

        // Two or three arguments can only be the removed signature, whatever
        // they are (arrow functions, `this.onNext`, `handleError`, ...).
        if (
          isTapResponseCall &&
          (args.length === 2 || args.length === 3) &&
          !args.some(ts.isSpreadElement)
        ) {
          // The arguments are kept as written and only wrapped, so their
          // formatting, comments and line endings survive, and a tapResponse
          // nested in a callback gets its own non-overlapping insertions.
          const text = sourceFile.getFullText();
          const multiline = text
            .slice(args.pos, args[0].getStart(sourceFile))
            .includes('\n');
          const closeParen = node.getEnd() - 1;

          const insert = (pos: number, toAdd: string) =>
            changes.push(new InsertChange(sourceFile.fileName, pos, toAdd));

          if (multiline) {
            insert(args.pos, '{');
            insert(args[0].getStart(sourceFile), 'next: ');
          } else {
            insert(args[0].getStart(sourceFile), '{ next: ');
          }
          insert(args[1].getStart(sourceFile), 'error: ');
          if (args[2]) {
            insert(args[2].getStart(sourceFile), 'complete: ');
          }
          if (multiline) {
            insert(closeParen, '}');
          } else {
            insert(args[args.length - 1].getEnd(), ' }');
          }
        }
      });

      if (changes.length) {
        commitChanges(tree, sourceFile.fileName, changes);
        context.logger.info(
          `[@ngrx/operators] Migrated deprecated tapResponse in ${sourceFile.fileName}`
        );
      }
    });
  };
}
