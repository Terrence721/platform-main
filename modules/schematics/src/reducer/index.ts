import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
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
} from '@angular-devkit/schematics';
import {
  getProjectPath,
  findModuleFromOptions,
  stringUtils,
  addReducerToState,
  addReducerImportToNgModule,
  parseName,
  getProject,
  getPrefix,
} from '../../../schematics-core';
import { Schema as ReducerOptions } from './schema';

/**
 * The folder the reducer file goes in, relative to the path: `flat` decides
 * whether it gets its own folder, and `group` puts it within `reducers`.
 */
function reducerFolder(options: ReducerOptions, folderName: string): string {
  return stringUtils.group(
    options.flat ? '' : folderName,
    options.group ? 'reducers' : ''
  );
}

/**
 * The NgModule to register the reducer in: the one given with `--module`, or
 * else the nearest one. A standalone app has no NgModule; the reducer is still
 * created, and registering it (`provideState`) is left to the app.
 */
function findModuleToRegisterIn(host: Tree, options: ReducerOptions) {
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

export default function (options: ReducerOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProject(host, options);
    options.path = getProjectPath(host, options);
    options.prefix = getPrefix(options);

    const parsedPath = parseName(options.path, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

    options.module = findModuleToRegisterIn(host, options);

    // The registrations must import the reducer from the folder the template
    // writes it to, which is not the layout `schematics-core` assumes.
    const reducerPath = [
      options.path,
      reducerFolder(options, stringUtils.dasherize(options.name)),
      `${stringUtils.dasherize(options.name)}.reducer`,
    ]
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^(?!\/)/, '/');

    const templateOptions = {
      ...stringUtils,
      'if-flat': (s: string) => reducerFolder(options, s),
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
      branchAndMerge(chain([addReducerToState({ ...options, reducerPath })])),
      branchAndMerge(
        chain([
          addReducerImportToNgModule({ ...options, reducerPath }),
          mergeWith(templateSource),
        ])
      ),
    ])(host, context);
  };
}
