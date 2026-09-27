import {
  Rule,
  SchematicsException,
  apply,
  applyTemplates,
  branchAndMerge,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  template,
  url,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  stringUtils,
  addReducerToState,
  addReducerImportToNgModule,
  getProjectPath,
  findModuleFromOptions,
  parseName,
  getProject,
} from '../../../schematics-core';
import { Schema as EntityOptions } from './schema';

/**
 * The NgModule to register the reducer in: the one given with `--module`, or
 * else the nearest one. A standalone app has no NgModule; its files are still
 * created, and registering the feature (`provideState`) is left to the app.
 */
function findModuleToRegisterIn(host: Tree, options: EntityOptions) {
  if (options.module) {
    return findModuleFromOptions(host, options);
  }

  try {
    return findModuleFromOptions(host, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Could not find an NgModule')
    ) {
      return undefined;
    }
    throw error;
  }
}

export default function (options: EntityOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProject(host, options);
    options.path = getProjectPath(host, options);

    const parsedPath = parseName(options.path, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

    options.module = findModuleToRegisterIn(host, options);

    const templateOptions = {
      ...stringUtils,
      'if-flat': (s: string) => (options.flat ? '' : s),
      'group-actions': (name: string) =>
        stringUtils.group(name, options.group ? 'actions' : ''),
      'group-models': (name: string) =>
        stringUtils.group(name, options.group ? 'models' : ''),
      'group-reducers': (s: string) =>
        stringUtils.group(s, options.group ? 'reducers' : ''),
      ...(options as object),
    };

    const templateSource = apply(url('./files'), [
      options.skipTests
        ? filter((path) => !path.endsWith('.spec.ts.template'))
        : noop(),
      applyTemplates(templateOptions),
      move(parsedPath.path),
    ]);

    return chain([
      addReducerToState({ ...options, plural: true }),
      addReducerImportToNgModule({ ...options, plural: true }),
      branchAndMerge(mergeWith(templateSource)),
    ])(host, context);
  };
}
