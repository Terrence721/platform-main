import ts from 'typescript';
import { normalize } from '@angular-devkit/core';
import { Tree, Rule, chain } from '@angular-devkit/schematics';
import {
  commitChanges,
  visitTemplates,
  ReplaceChange,
  Change,
  visitTSSourceFiles,
  visitNgModuleImports,
  visitNgModuleExports,
  addImportToModule,
  addExportToModule,
  visitComponents,
  insertImport,
  InsertChange,
} from '../../../schematics-core';

// The `async` pipe: a `|` that is not the second half of `||`, then `async`
// as a whole word, so `a || asyncValue` and `| asyncDate` are left alone.
const ASYNC_REGEXP = /(?<!\|)\|\s*async\b/g;
const NGRX_PUSH_REGEXP = /(?<!\|)\|\s*ngrxPush\b/;
// `PushModule` was removed from @ngrx/component (deprecated in v16); the
// standalone `PushPipe` goes in NgModule and component `imports` alike.
const PUSH_PIPE = 'PushPipe';
const COMPONENT_MODULE = '@ngrx/component';

const pushModuleToFind = (node: ts.Node) =>
  ts.isIdentifier(node) &&
  (node.text === PUSH_PIPE || node.text === 'PushModule');

const ngModulesToFind = (node: ts.Node) =>
  ts.isIdentifier(node) &&
  (node.text === 'CommonModule' || node.text === 'BrowserModule');

export function migrateToNgrxPush(): Rule {
  return (host: Tree) =>
    visitTemplates(host, (template) => {
      let match: RegExpMatchArray | null;
      const changes: Change[] = [];
      while ((match = ASYNC_REGEXP.exec(template.content)) !== null) {
        const m = match.toString();

        changes.push(
          new ReplaceChange(
            template.fileName,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            template.start + match.index!,
            m,
            m.replace('async', 'ngrxPush')
          )
        );
      }

      return commitChanges(host, template.fileName, changes);
    });
}

export function importPushModule(): Rule {
  return (host: Tree) => {
    visitTSSourceFiles(host, (sourceFile) => {
      let hasCommonModuleOrBrowserModule = false;
      let hasPushModule = false;

      visitNgModuleImports(sourceFile, (_, importNodes) => {
        hasCommonModuleOrBrowserModule = importNodes.some(ngModulesToFind);
        hasPushModule = importNodes.some(pushModuleToFind);
      });

      if (hasCommonModuleOrBrowserModule && !hasPushModule) {
        const changes: Change[] = addImportToModule(
          sourceFile,
          sourceFile.fileName,
          PUSH_PIPE,
          COMPONENT_MODULE
        );
        commitChanges(host, sourceFile.fileName, changes);
      }
    });
  };
}

export function exportPushModule(): Rule {
  return (host: Tree) => {
    visitTSSourceFiles(host, (sourceFile) => {
      let hasCommonModuleOrBrowserModule = false;
      let hasPushModule = false;

      visitNgModuleExports(sourceFile, (_, exportNodes) => {
        hasCommonModuleOrBrowserModule = exportNodes.some(ngModulesToFind);
        hasPushModule = exportNodes.some(pushModuleToFind);
      });

      if (hasCommonModuleOrBrowserModule && !hasPushModule) {
        const changes: Change[] = addExportToModule(
          sourceFile,
          sourceFile.fileName,
          PUSH_PIPE,
          COMPONENT_MODULE
        );
        commitChanges(host, sourceFile.fileName, changes);
      }
    });
  };
}

/**
 * A standalone component's template can only use `ngrxPush` if the component
 * imports `PushPipe` itself. A component is standalone here if it has an
 * `imports` array or `standalone: true`: a standalone component cannot use
 * `| async` without importing `AsyncPipe` or `CommonModule`.
 */
export function importPushPipeInStandaloneComponents(): Rule {
  return (host: Tree) => {
    visitTSSourceFiles(host, (sourceFile) => {
      visitComponents(sourceFile, (_, metadata) => {
        const property = (name: string) =>
          metadata.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              p.name.text === name
          );
        const imports = property('imports');
        const standalone = property('standalone');
        const isStandalone =
          (imports !== undefined &&
            standalone?.initializer.kind !== ts.SyntaxKind.FalseKeyword) ||
          standalone?.initializer.kind === ts.SyntaxKind.TrueKeyword;

        if (!isStandalone || !usesNgrxPush(host, sourceFile, property)) {
          return;
        }

        const changes: Change[] = [];
        if (imports && ts.isArrayLiteralExpression(imports.initializer)) {
          const { elements } = imports.initializer;
          if (elements.some(pushModuleToFind)) {
            return;
          }
          changes.push(
            elements.length
              ? new InsertChange(
                  sourceFile.fileName,
                  elements[elements.length - 1].getEnd(),
                  `, ${PUSH_PIPE}`
                )
              : new InsertChange(
                  sourceFile.fileName,
                  imports.initializer.getStart() + 1,
                  PUSH_PIPE
                )
          );
        } else if (!imports) {
          changes.push(
            new InsertChange(
              sourceFile.fileName,
              metadata.getStart() + 1,
              ` imports: [${PUSH_PIPE}],`
            )
          );
        } else {
          // `imports` is not an array literal (e.g. a shared constant); it is
          // left for the user rather than rewritten.
          return;
        }

        changes.push(
          insertImport(
            sourceFile,
            sourceFile.fileName,
            PUSH_PIPE,
            COMPONENT_MODULE
          )
        );
        commitChanges(host, sourceFile.fileName, changes);
      });
    });
  };
}

function usesNgrxPush(
  host: Tree,
  sourceFile: ts.SourceFile,
  property: (name: string) => ts.PropertyAssignment | undefined
): boolean {
  const template = property('template')?.initializer;
  if (template && ts.isStringLiteralLike(template)) {
    return NGRX_PUSH_REGEXP.test(template.text);
  }

  const templateUrl = property('templateUrl')?.initializer;
  if (templateUrl && ts.isStringLiteralLike(templateUrl)) {
    const directory = sourceFile.fileName.slice(
      0,
      sourceFile.fileName.lastIndexOf('/')
    );
    const content = host.read(normalize(`${directory}/${templateUrl.text}`));
    return content !== null && NGRX_PUSH_REGEXP.test(content.toString());
  }

  return false;
}

export default function (): Rule {
  return chain([
    migrateToNgrxPush(),
    importPushModule(),
    exportPushModule(),
    importPushPipeInStandaloneComponents(),
  ]);
}
