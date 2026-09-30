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

export function migrateTapResponseImport(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    addPackageToPackageJson(tree, 'dependencies', '@ngrx/operators', '^18.0.0');

    visitTSSourceFiles(tree, (sourceFile) => {
      const importDeclarations = new Array<ts.ImportDeclaration>();
      getImportDeclarations(sourceFile, importDeclarations);

      const componentStoreImportsAndDeclarations = importDeclarations
        .map((componentStoreImportDeclaration) => {
          const componentStoreImports = getComponentStoreNamedBinding(
            componentStoreImportDeclaration
          );
          if (componentStoreImports) {
            if (componentStoreImports.elements.some(isTapResponse)) {
              return { componentStoreImports, componentStoreImportDeclaration };
            }
            return undefined;
          } else {
            return undefined;
          }
        })
        .filter(Boolean);

      if (componentStoreImportsAndDeclarations.length === 0) {
        // `import * as cs` with `cs.tapResponse` cannot be rewritten
        // reliably; say so rather than leave it to fail after the upgrade.
        const namespaceUse = importDeclarations.some((node) => {
          const bindings = node.importClause?.namedBindings;
          return (
            isFrom(node, '@ngrx/component-store') &&
            bindings &&
            ts.isNamespaceImport(bindings) &&
            sourceFile.text.includes(`${bindings.name.text}.tapResponse`)
          );
        });
        if (namespaceUse) {
          ctx.logger.warn(
            `[@ngrx/component-store] ${sourceFile.fileName} uses tapResponse through a namespace import; import it from '@ngrx/operators' instead`
          );
        }
        return;
      } else if (componentStoreImportsAndDeclarations.length > 1) {
        ctx.logger.info(
          '[@ngrx/component-store] Skipping because of multiple `tapResponse` imports'
        );
        return;
      }

      const [componentStoreImportsAndDeclaration] =
        componentStoreImportsAndDeclarations;
      if (!componentStoreImportsAndDeclaration) {
        return;
      }
      const { componentStoreImports, componentStoreImportDeclaration } =
        componentStoreImportsAndDeclaration;

      const operatorsImportDeclaration = importDeclarations.find((node) =>
        isFrom(node, '@ngrx/operators')
      );

      // Specifiers are kept as written, so `X as Y` and `type X` survive,
      // and an aliased `tapResponse as tr` keeps its local name.
      const tapResponseElement =
        componentStoreImports.elements.find(isTapResponse);
      if (!tapResponseElement) {
        return;
      }
      const tapResponseImport = tapResponseElement.getText();
      const otherComponentStoreImports = componentStoreImports.elements
        .filter((element) => !isTapResponse(element))
        .map((element) => element.getText())
        .join(', ');

      // The line break after the import, so removing it leaves no blank line
      // and the new import goes on its own line (also at the end of a file
      // with no final line break, and with Windows line endings).
      const text = sourceFile.getFullText();
      const importEnd = componentStoreImportDeclaration.getEnd();
      const lineBreak = text.startsWith('\r\n', importEnd)
        ? '\r\n'
        : text.startsWith('\n', importEnd)
          ? '\n'
          : '';
      const afterImportLine = importEnd + lineBreak.length;

      const changes: Change[] = [];
      // Remove `tapResponse` from @ngrx/component-store and leave the other imports
      if (otherComponentStoreImports) {
        changes.push(
          createReplaceChange(
            sourceFile,
            componentStoreImportDeclaration,
            componentStoreImportDeclaration.getText(),
            `import { ${otherComponentStoreImports} } from '@ngrx/component-store';`
          )
        );
      }
      // Remove complete @ngrx/component-store import because it contains only `tapResponse`
      else {
        changes.push(
          createRemoveChange(
            sourceFile,
            componentStoreImportDeclaration,
            componentStoreImportDeclaration.getStart(),
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
            tapResponseImport,
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
        const newOperatorsImport = `import { ${tapResponseImport} } from '@ngrx/operators';`;
        // After the import's line; with no line break after it (the last
        // line of the file), the new import starts a line of its own when
        // the old import stays.
        const lineBefore = !lineBreak && otherComponentStoreImports ? '\n' : '';
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
          `[@ngrx/component-store] Updated tapResponse to import from '@ngrx/operators'`
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

function getComponentStoreNamedBinding(
  node: ts.ImportDeclaration
): ts.NamedImports | null {
  const namedBindings = node?.importClause?.namedBindings;
  if (
    isFrom(node, '@ngrx/component-store') &&
    namedBindings &&
    ts.isNamedImports(namedBindings)
  ) {
    return namedBindings;
  }

  return null;
}

// By the imported name, so `tapResponse as tr` counts too.
function isTapResponse(element: ts.ImportSpecifier): boolean {
  return (element.propertyName ?? element.name).getText() === 'tapResponse';
}

function isFrom(node: ts.ImportDeclaration, moduleName: string): boolean {
  return (
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName
  );
}

export default function (): Rule {
  return chain([migrateTapResponseImport()]);
}
