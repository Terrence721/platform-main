import {
  dasherize,
  decamelize,
  camelize,
  classify,
  underscore,
  group,
  capitalize,
  featurePath,
  pluralize,
} from './utility/strings';

export {
  findNodes,
  getSourceNodes,
  getDecoratorMetadata,
  getContentOfKeyLiteral,
  insertAfterLastOccurrence,
  insertImport,
  addBootstrapToModule,
  addDeclarationToModule,
  addExportToModule,
  addImportToModule,
  addProviderToComponent,
  addProviderToModule,
  replaceImport,
  containsProperty,
} from './utility/ast-utils';

export {
  Host,
  Change,
  NoopChange,
  InsertChange,
  RemoveChange,
  ReplaceChange,
  createReplaceChange,
  createRemoveChange,
  createChangeRecorder,
  commitChanges,
} from './utility/change';

export { AppConfig, getWorkspace, getWorkspacePath } from './utility/config';

export {
  ComponentOptions,
  findComponentFromOptions,
} from './utility/find-component';

export {
  findModule,
  findModuleFromOptions,
  buildRelativePath,
  ModuleOptions,
} from './utility/find-module';

export { findPropertyInAstObject } from './utility/json-utils';

export {
  addReducerToState,
  addReducerToStateInterface,
  addReducerImportToNgModule,
  addReducerToActionReducerMap,
  omit,
  getPrefix,
} from './utility/ngrx-utils';

export {
  WorkspaceProject,
  getProjectPath,
  getProject,
  isLib,
  getProjectMainFile,
} from './utility/project';

export const stringUtils = {
  dasherize,
  decamelize,
  camelize,
  classify,
  underscore,
  group,
  capitalize,
  featurePath,
  pluralize,
};

export { updatePackage } from './utility/update';

export { Location, parseName } from './utility/parse-name';

export { addPackageToPackageJson } from './utility/package';

export { platformVersion } from './utility/libs-version';

export {
  callsProvidersFunction,
  addFunctionalProvidersToStandaloneBootstrap,
  findBootstrapApplicationCall,
} from './utility/standalone';

export {
  visitTSSourceFiles,
  visitNgModuleImports,
  visitNgModuleExports,
  visitComponents,
  visitDecorator,
  visitNgModules,
  visitTemplates,
  visitImportDeclaration,
  visitImportSpecifier,
  visitTypeReference,
  visitTypeLiteral,
  visitCallExpression,
} from './utility/visitors';
