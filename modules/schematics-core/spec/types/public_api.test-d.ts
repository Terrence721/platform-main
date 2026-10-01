import { Path } from '@angular-devkit/core';
import { Rule, Tree } from '@angular-devkit/schematics';
import ts from 'typescript';
import { describe, expectTypeOf, it } from 'vitest';
// schematics-core is not published and has no package name: the generators
// and migrations of the other modules import its barrel by a relative path,
// as this test does. A re-export dropped or renamed from the barrel fails
// here instead of in a migration at run time (#162).
import * as core from '../../index';
import {
  Change,
  commitChanges,
  createRemoveChange,
  createReplaceChange,
  InsertChange,
  RemoveChange,
  replaceImport,
  ReplaceChange,
  stringUtils,
  updatePackage,
  visitTSSourceFiles,
} from '../../index';

describe('schematics-core barrel', () => {
  it('exports every helper, and only those', () => {
    expectTypeOf<keyof typeof core>().toEqualTypeOf<
      | 'addBootstrapToModule'
      | 'addDeclarationToModule'
      | 'addExportToModule'
      | 'addFunctionalProvidersToStandaloneBootstrap'
      | 'addImportToModule'
      | 'addPackageToPackageJson'
      | 'addProviderToComponent'
      | 'addProviderToModule'
      | 'addReducerImportToNgModule'
      | 'addReducerToActionReducerMap'
      | 'addReducerToState'
      | 'addReducerToStateInterface'
      | 'buildRelativePath'
      | 'callsProvidersFunction'
      | 'commitChanges'
      | 'containsProperty'
      | 'createChangeRecorder'
      | 'createRemoveChange'
      | 'createReplaceChange'
      | 'findBootstrapApplicationCall'
      | 'findComponentFromOptions'
      | 'findModule'
      | 'findModuleFromOptions'
      | 'findNodes'
      | 'findPropertyInAstObject'
      | 'getContentOfKeyLiteral'
      | 'getDecoratorMetadata'
      | 'getPrefix'
      | 'getProject'
      | 'getProjectMainFile'
      | 'getProjectPath'
      | 'getSourceNodes'
      | 'getWorkspace'
      | 'getWorkspacePath'
      | 'insertAfterLastOccurrence'
      | 'InsertChange'
      | 'insertImport'
      | 'isLib'
      | 'NoopChange'
      | 'omit'
      | 'parseName'
      | 'platformVersion'
      | 'RemoveChange'
      | 'ReplaceChange'
      | 'replaceImport'
      | 'stringUtils'
      | 'updatePackage'
      | 'visitCallExpression'
      | 'visitComponents'
      | 'visitDecorator'
      | 'visitImportDeclaration'
      | 'visitImportSpecifier'
      | 'visitNgModuleExports'
      | 'visitNgModuleImports'
      | 'visitNgModules'
      | 'visitTemplates'
      | 'visitTSSourceFiles'
      | 'visitTypeLiteral'
      | 'visitTypeReference'
    >();
  });

  it('the changes the migrations build are Changes', () => {
    expectTypeOf<InsertChange>().toExtend<Change>();
    expectTypeOf<RemoveChange>().toExtend<Change>();
    expectTypeOf<ReplaceChange>().toExtend<Change>();
    expectTypeOf(createReplaceChange).returns.toEqualTypeOf<ReplaceChange>();
    expectTypeOf(createRemoveChange).returns.toEqualTypeOf<RemoveChange>();
    expectTypeOf(replaceImport).returns.toEqualTypeOf<
      (ReplaceChange | RemoveChange)[]
    >();
    expectTypeOf(replaceImport).parameters.toEqualTypeOf<
      [ts.SourceFile, Path, string, string, string]
    >();
  });

  it('commitChanges applies changes to a file in the tree', () => {
    expectTypeOf(commitChanges).toEqualTypeOf<
      (tree: Tree, path: string, changes: Change[]) => boolean
    >();
  });

  it('visitTSSourceFiles visits every source file, and can collect a result', () => {
    expectTypeOf(visitTSSourceFiles<number>)
      .parameter(1)
      .toEqualTypeOf<
        (
          sourceFile: ts.SourceFile,
          tree: Tree,
          result?: number
        ) => number | undefined
      >();
    expectTypeOf(visitTSSourceFiles<number>).returns.toEqualTypeOf<
      number | undefined
    >();
  });

  it('updatePackage and the string helpers', () => {
    expectTypeOf(updatePackage).toEqualTypeOf<(name: string) => Rule>();
    expectTypeOf<keyof typeof stringUtils>().toEqualTypeOf<
      | 'dasherize'
      | 'decamelize'
      | 'camelize'
      | 'classify'
      | 'underscore'
      | 'group'
      | 'capitalize'
      | 'featurePath'
      | 'pluralize'
    >();
    expectTypeOf(stringUtils.classify).toEqualTypeOf<(str: string) => string>();
  });
});
