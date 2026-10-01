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
  ReplaceChange,
  visitTSSourceFiles,
} from '../../../schematics-core';

export function migrateProvideEffects(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const names = findLocalNames(sourceFile);
      if (!names.provideEffects.length && !names.namespaces.length) {
        return;
      }

      const changes: ReplaceChange[] = [];
      visitProvideEffects(sourceFile, names, (node) => {
        // v14 took a single array of effects; v15 takes them as rest
        // arguments.
        const [effects] = node.arguments;
        if (!effects || node.arguments.length !== 1) {
          return;
        }

        if (ts.isArrayLiteralExpression(effects)) {
          // Only the brackets go, so comments and line breaks between the
          // effects are kept.
          const inner = sourceFile.text.slice(
            effects.getStart(sourceFile) + 1,
            effects.getEnd() - 1
          );
          changes.push(
            createReplaceChange(
              sourceFile,
              effects,
              effects.getText(sourceFile),
              inner
            )
          );
        } else if (!ts.isSpreadElement(effects)) {
          // An array held elsewhere (`provideEffects(EFFECTS)`): the only
          // thing v14 accepted here was an array, so spread it.
          changes.push(
            createReplaceChange(
              sourceFile,
              effects,
              effects.getText(sourceFile),
              `...${effects.getText(sourceFile)}`
            )
          );
        }
      });

      commitChanges(tree, sourceFile.fileName, changes);

      if (changes.length) {
        ctx.logger.info(`[@ngrx/effects] Updated provideEffects usage`);
      }
    });
  };
}

interface LocalNames {
  provideEffects: string[];
  namespaces: string[];
}

// The names provideEffects is imported under from '@ngrx/effects', so
// aliases and namespace imports count too.
function findLocalNames(sourceFile: ts.SourceFile): LocalNames {
  const names: LocalNames = { provideEffects: [], namespaces: [] };
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
        if ((element.propertyName ?? element.name).text === 'provideEffects') {
          names.provideEffects.push(element.name.text);
        }
      }
    }
  }
  return names;
}

function visitProvideEffects(
  node: ts.Node,
  names: LocalNames,
  visitor: (node: ts.CallExpression) => void
) {
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (
      (ts.isIdentifier(callee) && names.provideEffects.includes(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        names.namespaces.includes(callee.expression.text) &&
        callee.name.text === 'provideEffects')
    ) {
      visitor(node);
    }
  }

  ts.forEachChild(node, (childNode) =>
    visitProvideEffects(childNode, names, visitor)
  );
}

export default function (): Rule {
  return chain([migrateProvideEffects()]);
}
