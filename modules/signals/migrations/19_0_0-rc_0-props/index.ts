import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  Change,
  commitChanges,
  createReplaceChange,
  visitTSSourceFiles,
} from '../../../schematics-core';
import {
  visitCallExpression,
  visitImportDeclaration,
  visitImportSpecifier,
  visitTypeReference,
} from '../../../schematics-core/utility/visitors';
import ts from 'typescript';

const entityRenames: Record<string, string> = {
  EntityComputed: 'EntityProps',
  NamedEntityComputed: 'NamedEntityProps',
};

function migratedToEntityProps(sourceFile: ts.SourceFile) {
  const changes: Change[] = [];
  visitImportDeclaration(sourceFile, (importDeclaration, moduleName) => {
    if (moduleName !== '@ngrx/signals/entities') {
      return;
    }

    visitImportSpecifier(importDeclaration, (importSpecifier) => {
      // By the imported name, so `EntityComputed as EC` counts too.
      const importedName = importSpecifier.propertyName ?? importSpecifier.name;
      const newName = entityRenames[importedName.text];
      if (!newName) {
        return;
      }

      // Only the name, so a `type` modifier and an alias are kept.
      changes.push(
        createReplaceChange(
          sourceFile,
          importedName,
          importedName.text,
          newName
        )
      );

      // An aliased import keeps its local name, so its uses stay as they are.
      if (importSpecifier.propertyName) {
        return;
      }
      visitTypeReference(sourceFile, (typeReference) => {
        const { typeName } = typeReference;
        if (ts.isIdentifier(typeName) && typeName.text === importedName.text) {
          changes.push(
            createReplaceChange(sourceFile, typeName, typeName.text, newName)
          );
        }
      });
    });
  });

  return changes;
}

function migrateToPropsInSignalStoreFeatureType(
  sourceFile: ts.SourceFile
): Change[] {
  const changes: Change[] = [];
  visitTypeReference(sourceFile, (typeReference) => {
    if (typeReference.typeName.getText() !== 'SignalStoreFeature') {
      return;
    }

    // Only the top-level keys of the input and output type literals: a
    // `computed` field nested inside `state` is the user's own.
    const typeLiterals = (typeReference.typeArguments ?? []).flatMap(
      topLevelTypeLiterals
    );
    for (const typeLiteral of typeLiterals) {
      for (const propertySignature of typeLiteral.members) {
        if (
          ts.isPropertySignature(propertySignature) &&
          propertySignature.name.getText() === 'computed'
        ) {
          changes.push(
            createReplaceChange(
              sourceFile,
              propertySignature.name,
              'computed',
              'props'
            )
          );
        }
      }
    }
  });

  return changes;
}

// `{ ... }`, and each `{ ... }` of `EmptyFeatureResult & { ... }`, without
// going into their members.
function topLevelTypeLiterals(type: ts.TypeNode): ts.TypeLiteralNode[] {
  if (ts.isTypeLiteralNode(type)) {
    return [type];
  }
  if (ts.isIntersectionTypeNode(type)) {
    return type.types.flatMap(topLevelTypeLiterals);
  }
  if (ts.isParenthesizedTypeNode(type)) {
    return topLevelTypeLiterals(type.type);
  }
  return [];
}

function migrateToPropsInSignalStoreFeatureWithObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): Change[] {
  const computedKey = objectLiteral.properties
    .filter(ts.isPropertyAssignment)
    .find((property) => property.name.getText() === 'computed');
  if (computedKey) {
    return [createReplaceChange(sourceFile, computedKey, 'computed', 'props')];
  }

  return [];
}

function migrateToPropsInSignalStoreFeatureWithCallExpression(
  callExpression: ts.CallExpression,
  sourceFile: ts.SourceFile
): Change[] {
  if (callExpression.expression.getText() === 'type') {
    const typeArgument = callExpression.typeArguments?.at(0);

    if (typeArgument && ts.isTypeLiteralNode(typeArgument)) {
      const computedKey = typeArgument.members
        .filter(ts.isPropertySignature)
        .find(
          (propertySignature) => propertySignature.name.getText() === 'computed'
        );

      if (computedKey) {
        return [
          createReplaceChange(sourceFile, computedKey, 'computed', 'props'),
        ];
      }
    }
  }

  return [];
}

function migrateToPropsInSignalStoreFeatureFunction(
  sourceFile: ts.SourceFile
): Change[] {
  const changes: Change[] = [];
  visitCallExpression(sourceFile, (callExpression) => {
    if (callExpression.expression.getText() !== 'signalStoreFeature') {
      return;
    }

    const objectLiteralOrCallExpression = callExpression.arguments[0];
    if (!objectLiteralOrCallExpression) {
      return;
    }

    if (ts.isObjectLiteralExpression(objectLiteralOrCallExpression)) {
      changes.push(
        ...migrateToPropsInSignalStoreFeatureWithObjectLiteral(
          objectLiteralOrCallExpression,
          sourceFile
        )
      );
    } else if (ts.isCallExpression(objectLiteralOrCallExpression)) {
      changes.push(
        ...migrateToPropsInSignalStoreFeatureWithCallExpression(
          objectLiteralOrCallExpression,
          sourceFile
        )
      );
    }
  });

  return changes;
}

export function migrate(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const entityPropsChanges = migratedToEntityProps(sourceFile);
      const propsInSignalStoreFeatureTypeChanges =
        migrateToPropsInSignalStoreFeatureType(sourceFile);
      const propsInSignalStoreFeatureFunctionChanges =
        migrateToPropsInSignalStoreFeatureFunction(sourceFile);
      const changes = [
        ...entityPropsChanges,
        ...propsInSignalStoreFeatureTypeChanges,
        ...propsInSignalStoreFeatureFunctionChanges,
      ];

      commitChanges(tree, sourceFile.fileName, changes);

      if (entityPropsChanges.length) {
        ctx.logger.info(
          `[@ngrx/signals] Renamed '(Named)EntityComputed' to '(Named)EntityProps' in ${sourceFile.fileName}`
        );
      }
      if (propsInSignalStoreFeatureTypeChanges.length) {
        ctx.logger.info(
          `[@ngrx/signals] Renamed 'computed' to 'props' in SignalStoreFeature<> in ${sourceFile.fileName}`
        );
      }
      if (propsInSignalStoreFeatureFunctionChanges.length) {
        ctx.logger.info(
          `[@ngrx/signals] Renamed 'computed' to 'props' in signalStoreFeature() in ${sourceFile.fileName}`
        );
      }
    });
  };
}

export default function (): Rule {
  return chain([migrate()]);
}
