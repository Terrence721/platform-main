import ts from 'typescript';
import {
  Rule,
  chain,
  Tree,
  SchematicContext,
  SchematicsException,
} from '@angular-devkit/schematics';
import {
  Change,
  RemoveChange,
  InsertChange,
  visitTSSourceFiles,
  commitChanges,
} from '../../../schematics-core';

const STORE_FREEZE_PACKAGE = 'ngrx-store-freeze';

interface MigrationState {
  // storeFreeze was removed somewhere, so runtime checks replace it.
  removed: boolean;
  // A use could not be removed, so its import and the package stay.
  leftover: boolean;
}

function replaceWithRuntimeChecks(state: MigrationState): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) =>
      removeUsages(sourceFile, tree, ctx, state)
    );
    // only add runtime checks when ngrx-store-freeze was used
    if (state.removed) {
      visitTSSourceFiles(tree, (sourceFile) =>
        insertRuntimeChecks(sourceFile, tree)
      );
    }
  };
}

function removeNgRxStoreFreezePackage(state: MigrationState): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    if (state.leftover) {
      ctx.logger.warn(
        `[@ngrx/store] ${STORE_FREEZE_PACKAGE} is still used, so it stays in package.json; remove it once the remaining uses are gone`
      );
      return tree;
    }

    const pkgPath = '/package.json';
    const buffer = tree.read(pkgPath);
    if (buffer === null) {
      throw new SchematicsException('Could not read package.json');
    }
    const content = buffer.toString();
    const pkg = JSON.parse(content);

    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new SchematicsException('Error reading package.json');
    }

    let changed = false;
    for (const category of ['dependencies', 'devDependencies']) {
      if (pkg[category] && pkg[category][STORE_FREEZE_PACKAGE]) {
        delete pkg[category][STORE_FREEZE_PACKAGE];
        changed = true;
      }
    }

    // Left alone when nothing changed; otherwise written back with the
    // file's own indentation, line endings and final line break.
    if (changed) {
      const indent = /\n([ \t]+)"/.exec(content)?.[1] ?? 2;
      const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
      const finalLineBreak = /\n$/.test(content) ? lineBreak : '';
      tree.overwrite(
        pkgPath,
        JSON.stringify(pkg, null, indent).replace(/\n/g, lineBreak) +
          finalLineBreak
      );
    }
    return tree;
  };
}

export default function (): Rule {
  const state: MigrationState = { removed: false, leftover: false };
  // Uses first, so the package is only removed when none is left.
  return chain([
    replaceWithRuntimeChecks(state),
    removeNgRxStoreFreezePackage(state),
  ]);
}

// Spec files are migrated too: their ngrx-store-freeze imports would break
// once the package is removed.
function removeUsages(
  sourceFile: ts.SourceFile,
  tree: Tree,
  ctx: SchematicContext,
  state: MigrationState
) {
  const imports = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter(
      ({ moduleSpecifier }) =>
        ts.isStringLiteral(moduleSpecifier) &&
        moduleSpecifier.text === STORE_FREEZE_PACKAGE
    );
  if (imports.length === 0) {
    return;
  }

  // The names storeFreeze is imported under, so `storeFreeze as freeze`
  // counts too.
  const localNames = imports.flatMap((declaration) => {
    const bindings = declaration.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings)
      ? bindings.elements
          .filter(
            (element) =>
              (element.propertyName ?? element.name).text === 'storeFreeze'
          )
          .map((element) => element.name.text)
      : [];
  });

  const { changes: usageRemovals, leftovers } = findStoreFreezeUsagesToRemove(
    sourceFile,
    localNames
  );

  if (leftovers.length) {
    // Removing the import would leave these uses undefined.
    state.leftover = true;
    ctx.logger.warn(
      `[@ngrx/store] ${sourceFile.fileName}: remove storeFreeze from '${leftovers.join("', '")}' by hand; runtime checks replace it`
    );
    if (usageRemovals.length) {
      state.removed = true;
      commitChanges(tree, sourceFile.fileName, usageRemovals);
    }
    return;
  }

  const importRemovals = imports.map(
    (i) =>
      new RemoveChange(sourceFile.fileName, i.getStart(sourceFile), i.getEnd())
  );
  state.removed = true;
  commitChanges(tree, sourceFile.fileName, [
    ...importRemovals,
    ...usageRemovals,
  ]);
}

function insertRuntimeChecks(sourceFile: ts.SourceFile, tree: Tree) {
  const changes = findRuntimeChecksToInsert(sourceFile);
  return commitChanges(tree, sourceFile.fileName, changes);
}

// storeFreeze is removed from the arrays it sits in (only that element and
// its comma, so the rest keeps its formatting and comments); any other use
// is reported as a leftover.
function findStoreFreezeUsagesToRemove(
  sourceFile: ts.SourceFile,
  localNames: string[]
) {
  const changes: Change[] = [];
  const leftovers: string[] = [];
  ts.forEachChild(sourceFile, crawl);
  return { changes, leftovers };

  function crawl(node: ts.Node) {
    if (
      ts.isIdentifier(node) &&
      localNames.includes(node.text) &&
      !ts.isImportSpecifier(node.parent)
    ) {
      const array = node.parent;
      if (ts.isArrayLiteralExpression(array)) {
        changes.push(removeElement(sourceFile, array, node));
      } else {
        leftovers.push(node.parent.getText(sourceFile));
      }
    }
    ts.forEachChild(node, crawl);
  }
}

function removeElement(
  sourceFile: ts.SourceFile,
  array: ts.ArrayLiteralExpression,
  element: ts.Expression
): RemoveChange {
  const index = array.elements.indexOf(element);
  const next = array.elements[index + 1];
  const previous = array.elements[index - 1];
  const [start, end] = next
    ? [element.getStart(sourceFile), next.getStart(sourceFile)]
    : previous
      ? [previous.getEnd(), element.getEnd()]
      : [element.getStart(sourceFile), element.getEnd()];
  return new RemoveChange(sourceFile.fileName, start, end);
}

function findRuntimeChecksToInsert(sourceFile: ts.SourceFile) {
  const changes: InsertChange[] = [];
  ts.forEachChild(sourceFile, crawl);
  return changes;

  function crawl(node: ts.Node) {
    ts.forEachChild(node, crawl);

    if (!ts.isCallExpression(node)) return;

    const expression = node.expression;
    if (!(
      ts.isPropertyAccessExpression(expression) &&
      expression.expression.getText(sourceFile) === 'StoreModule' &&
      expression.name.getText(sourceFile) === 'forRoot'
    )) {
      return;
    }

    const runtimeChecks = `runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true }`;

    // covers StoreModule.forRoot(ROOT_REDUCERS)
    if (node.arguments.length === 1) {
      changes.push(
        new InsertChange(
          sourceFile.fileName,
          node.arguments[0].getEnd(),
          `, { ${runtimeChecks}}`
        )
      );
    } else if (node.arguments.length === 2) {
      const storeConfig = node.arguments[1];
      if (ts.isObjectLiteralExpression(storeConfig)) {
        // An explicit runtimeChecks is kept: adding one would be a duplicate
        // property.
        const hasRuntimeChecks = storeConfig.properties.some(
          (property) =>
            property.name &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'runtimeChecks'
        );
        if (hasRuntimeChecks) {
          return;
        }

        // covers StoreModule.forRoot(ROOT_REDUCERS, {})
        if (storeConfig.properties.length === 0) {
          changes.push(
            new InsertChange(
              sourceFile.fileName,
              storeConfig.getEnd() - 1,
              `${runtimeChecks} `
            )
          );
        } else {
          // covers StoreModule.forRoot(ROOT_REDUCERS, { metaReducers })
          const lastProperty =
            storeConfig.properties[storeConfig.properties.length - 1];

          changes.push(
            new InsertChange(
              sourceFile.fileName,
              lastProperty.getEnd(),
              `, ${runtimeChecks}`
            )
          );
        }
      }
    }
  }
}
