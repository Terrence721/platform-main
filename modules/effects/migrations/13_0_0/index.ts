import ts from 'typescript';
import { Path } from '@angular-devkit/core';
import {
  Tree,
  Rule,
  chain,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  Change,
  InsertChange,
  RemoveChange,
  replaceImport,
  commitChanges,
  visitTSSourceFiles,
} from '../../../schematics-core';

interface EffectsImports {
  // Local names of `Effect`; the bare name when the file does not import it.
  effect: string[];
  // Local name `createEffect` is already imported under, if any.
  createEffect?: string;
  namespaces: string[];
  // The named-imports list holding `Effect`, if any.
  bindings?: ts.NamedImports;
  effectSpecifier?: ts.ImportSpecifier;
}

export function migrateToCreators(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const imports = findEffectsImports(sourceFile);

      const effects = sourceFile.statements
        .filter(ts.isClassDeclaration)
        .flatMap((clas) => clas.members.filter(ts.isPropertyDeclaration))
        .filter((property) =>
          (ts.getDecorators(property) ?? []).some((decorator) =>
            isEffectDecorator(decorator, imports)
          )
        );

      // An effect without an initializer (assigned in the constructor)
      // cannot be wrapped: it keeps its decorator, and so its import.
      const notMigrated = effects.filter((effect) => !effect.initializer);
      for (const effect of notMigrated) {
        ctx.logger.warn(
          `[@ngrx/effects] ${sourceFile.fileName}: '${effect.name.getText(sourceFile)}' has no initializer; wrap its value in createEffect() by hand`
        );
      }

      const createEffectsChanges = replaceEffectDecorators(
        sourceFile,
        effects.filter((effect) => effect.initializer),
        imports,
        notMigrated.length > 0
      );

      const importChanges: Change[] = notMigrated.length
        ? addCreateEffectImport(sourceFile, imports, createEffectsChanges)
        : replaceImport(
            sourceFile,
            sourceFile.fileName as Path,
            '@ngrx/effects',
            'Effect',
            'createEffect'
          );

      commitChanges(tree, sourceFile.fileName, [
        ...importChanges,
        ...createEffectsChanges,
      ]);
    });
  };
}

function findEffectsImports(sourceFile: ts.SourceFile): EffectsImports {
  const imports: EffectsImports = { effect: [], namespaces: [] };
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
      imports.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (importedName === 'Effect') {
          imports.effect.push(element.name.text);
          imports.bindings = bindings;
          imports.effectSpecifier = element;
        } else if (importedName === 'createEffect') {
          imports.createEffect = element.name.text;
        }
      }
    }
  }
  if (!imports.effect.length) {
    imports.effect.push('Effect');
  }
  return imports;
}

function replaceEffectDecorators(
  sourceFile: ts.SourceFile,
  effects: ts.PropertyDeclaration[],
  imports: EffectsImports,
  keepsEffectImport: boolean
) {
  const changes: Change[] = [];

  for (const effect of effects) {
    const decorators = (ts.getDecorators(effect) ?? []).filter((decorator) =>
      isEffectDecorator(decorator, imports)
    );
    const [decorator] = decorators;
    const initializer = effect.initializer;
    if (!decorator || !initializer) {
      continue;
    }

    // Only a real createEffect() call counts as already migrated, not any
    // initializer whose text mentions the word.
    if (!isCreateEffectCall(initializer, imports)) {
      const effectArguments = getDispatchProperties(sourceFile, decorator);
      const end = effectArguments ? `, ${effectArguments})` : ')';
      changes.push(
        new InsertChange(
          sourceFile.fileName,
          initializer.pos,
          ` ${createEffectName(decorator, imports, keepsEffectImport)}(() =>`
        ),
        new InsertChange(sourceFile.fileName, initializer.end, end)
      );
    }

    for (const effectDecorator of decorators) {
      changes.push(
        new RemoveChange(
          sourceFile.fileName,
          effectDecorator.expression.pos - 1, // also get the @ sign
          effectDecorator.expression.end
        )
      );
    }
  }

  return changes;
}

// `@Effect()`, under its imported name, or `@ns.Effect()`.
function isEffectDecorator(
  decorator: ts.Decorator,
  imports: EffectsImports
): boolean {
  if (!ts.isCallExpression(decorator.expression)) {
    return false;
  }
  const callee = decorator.expression.expression;
  return (
    (ts.isIdentifier(callee) && imports.effect.includes(callee.text)) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      imports.namespaces.includes(callee.expression.text) &&
      callee.name.text === 'Effect')
  );
}

function isCreateEffectCall(
  initializer: ts.Expression,
  imports: EffectsImports
): boolean {
  if (!ts.isCallExpression(initializer)) {
    return false;
  }
  const callee = initializer.expression;
  return (
    (ts.isIdentifier(callee) &&
      (callee.text === 'createEffect' ||
        callee.text === imports.createEffect)) ||
    (ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'createEffect')
  );
}

// The name the wrapping call uses: `ns.createEffect` through a namespace,
// an existing createEffect import, or the decorator's own alias, which
// replaceImport turns into `createEffect as <alias>` (unless `Effect` stays
// imported, when `createEffect` is added under its own name).
function createEffectName(
  decorator: ts.Decorator,
  imports: EffectsImports,
  keepsEffectImport: boolean
): string {
  const callee = (decorator.expression as ts.CallExpression).expression;
  if (ts.isPropertyAccessExpression(callee)) {
    return `${callee.expression.getText()}.createEffect`;
  }
  if (imports.createEffect) {
    return imports.createEffect;
  }
  return imports.effectSpecifier?.propertyName && !keepsEffectImport
    ? imports.effectSpecifier.name.text
    : 'createEffect';
}

// When some effects keep `@Effect`, `Effect` stays imported and
// `createEffect` is added beside it for the migrated ones.
function addCreateEffectImport(
  sourceFile: ts.SourceFile,
  imports: EffectsImports,
  migrations: Change[]
): Change[] {
  const wraps = migrations.some((change) => change instanceof InsertChange);
  if (!wraps || imports.createEffect || !imports.effectSpecifier) {
    return [];
  }
  return [
    new InsertChange(
      sourceFile.fileName,
      imports.effectSpecifier.getEnd(),
      ', createEffect'
    ),
  ];
}

function getDispatchProperties(
  sourceFile: ts.SourceFile,
  decorator: ts.Decorator
) {
  if (!ts.isCallExpression(decorator.expression)) {
    return '';
  }

  // just copy the effect properties
  return sourceFile.text
    .substring(
      decorator.expression.arguments.pos,
      decorator.expression.arguments.end
    )
    .trim();
}

export default function (): Rule {
  return chain([migrateToCreators()]);
}
