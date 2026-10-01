import ts from 'typescript';
import {
  Tree,
  Rule,
  chain,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  addPackageToPackageJson,
  Change,
  commitChanges,
  createReplaceChange,
  InsertChange,
  visitTSSourceFiles,
} from '../../../schematics-core';
import { createRemoveChange } from '../../../schematics-core/utility/change';

export function migrateConcatLatestFromImport(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    addPackageToPackageJson(tree, 'dependencies', '@ngrx/operators', '^18.0.0');

    visitTSSourceFiles(tree, (sourceFile) => {
      const importDeclarations = new Array<ts.ImportDeclaration>();

      getImportDeclarations(sourceFile, importDeclarations);

      const effectsImportsAndDeclarations = importDeclarations
        .map((effectsImportDeclaration) => {
          const effectsImports = getEffectsNamedBinding(
            effectsImportDeclaration
          );
          if (effectsImports) {
            if (effectsImports.elements.some(isConcatLatestFrom)) {
              return { effectsImports, effectsImportDeclaration };
            }
            return undefined;
          } else {
            return undefined;
          }
        })
        .filter(Boolean);

      if (effectsImportsAndDeclarations.length === 0) {
        // `import * as fx` with `fx.concatLatestFrom` cannot be rewritten
        // reliably; say so rather than leave it to fail after the upgrade.
        const namespaceUse = importDeclarations.some((node) => {
          const bindings = node.importClause?.namedBindings;
          return (
            isFrom(node, '@ngrx/effects') &&
            bindings &&
            ts.isNamespaceImport(bindings) &&
            sourceFile.text.includes(`${bindings.name.text}.concatLatestFrom`)
          );
        });
        if (namespaceUse) {
          ctx.logger.warn(
            `[@ngrx/effects] ${sourceFile.fileName} uses concatLatestFrom through a namespace import; import it from '@ngrx/operators' instead`
          );
        }
        return;
      } else if (effectsImportsAndDeclarations.length > 1) {
        ctx.logger.info(
          '[@ngrx/effects] Skipping because of multiple `concatLatestFrom` imports'
        );
        return;
      }

      const [effectsImportsAndDeclaration] = effectsImportsAndDeclarations;
      if (!effectsImportsAndDeclaration) {
        return;
      }

      const { effectsImports, effectsImportDeclaration } =
        effectsImportsAndDeclaration;

      const operatorsImportDeclaration = importDeclarations.find((node) =>
        isFrom(node, '@ngrx/operators')
      );

      // Specifiers are kept as written, so `X as Y` and `type X` survive,
      // and an aliased `concatLatestFrom as clf` keeps its local name.
      const concatLatestFromElement =
        effectsImports.elements.find(isConcatLatestFrom);
      if (!concatLatestFromElement) {
        return;
      }
      const concatLatestFromImport = concatLatestFromElement.getText();
      const otherEffectsImports = effectsImports.elements
        .filter((element) => !isConcatLatestFrom(element))
        .map((element) => element.getText())
        .join(', ');

      // The line break after the import, so removing it leaves no blank line
      // and the new import goes on its own line (also at the end of a file
      // with no final line break, and with Windows line endings).
      const text = sourceFile.getFullText();
      const importEnd = effectsImportDeclaration.getEnd();
      const lineBreak = text.startsWith('\r\n', importEnd)
        ? '\r\n'
        : text.startsWith('\n', importEnd)
          ? '\n'
          : '';
      const afterImportLine = importEnd + lineBreak.length;

      const changes: Change[] = [];
      // Remove `concatLatestFrom` from @ngrx/effects and leave the other imports
      if (otherEffectsImports) {
        changes.push(
          createReplaceChange(
            sourceFile,
            effectsImportDeclaration,
            effectsImportDeclaration.getText(),
            `import { ${otherEffectsImports} } from '@ngrx/effects';`
          )
        );
      }
      // Remove complete @ngrx/effects import because it contains only `concatLatestFrom`
      else {
        changes.push(
          createRemoveChange(
            sourceFile,
            effectsImportDeclaration,
            effectsImportDeclaration.getStart(),
            afterImportLine
          )
        );
      }

      let importAppendedInExistingDeclaration = false;
      if (operatorsImportDeclaration?.importClause?.namedBindings) {
        const bindings = operatorsImportDeclaration.importClause.namedBindings;
        if (ts.isNamedImports(bindings)) {
          // Add import to existing @ngrx/operators
          const updatedImports = [
            ...bindings.elements.map((element) => element.getText()),
            concatLatestFromImport,
          ];
          const newOperatorsImport = `import { ${updatedImports.join(
            ', '
          )} } from '@ngrx/operators';`;
          changes.push(
            createReplaceChange(
              sourceFile,
              operatorsImportDeclaration,
              operatorsImportDeclaration.getText(),
              newOperatorsImport
            )
          );
          importAppendedInExistingDeclaration = true;
        }
      }

      if (!importAppendedInExistingDeclaration) {
        // Add new @ngrx/operators import line
        const newOperatorsImport = `import { ${concatLatestFromImport} } from '@ngrx/operators';`;
        // After the import's line; with no line break after it (the last
        // line of the file), the new import starts a line of its own when
        // the old import stays.
        const lineBefore = !lineBreak && otherEffectsImports ? '\n' : '';
        changes.push(
          new InsertChange(
            sourceFile.fileName,
            afterImportLine,
            `${lineBefore}${newOperatorsImport}${lineBreak}`
          )
        );
      }

      commitChanges(tree, sourceFile.fileName, changes);

      if (changes.length) {
        ctx.logger.info(
          `[@ngrx/effects] Updated concatLatestFrom to import from '@ngrx/operators'`
        );
      }
    });
  };
}

function getImportDeclarations(
  node: ts.Node,
  imports: ts.ImportDeclaration[]
): void {
  if (ts.isImportDeclaration(node)) {
    imports.push(node);
  }

  ts.forEachChild(node, (childNode) =>
    getImportDeclarations(childNode, imports)
  );
}

function getEffectsNamedBinding(
  node: ts.ImportDeclaration
): ts.NamedImports | null {
  const namedBindings = node?.importClause?.namedBindings;
  if (
    isFrom(node, '@ngrx/effects') &&
    namedBindings &&
    ts.isNamedImports(namedBindings)
  ) {
    return namedBindings;
  }

  return null;
}

// By the imported name, so `concatLatestFrom as clf` counts too.
function isConcatLatestFrom(element: ts.ImportSpecifier): boolean {
  return (
    (element.propertyName ?? element.name).getText() === 'concatLatestFrom'
  );
}

function isFrom(node: ts.ImportDeclaration, moduleName: string): boolean {
  return (
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName
  );
}

export default function (): Rule {
  return chain([migrateConcatLatestFromImport()]);
}
