import * as ts from 'typescript';
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
  url,
} from '@angular-devkit/schematics';
import {
  InsertChange,
  addImportToModule,
  buildRelativePath,
  findModuleFromOptions,
  getProjectPath,
  insertImport,
  parseName,
  stringUtils,
  getPrefix,
} from '../../../schematics-core';
import { Schema as EffectOptions } from './schema';

/**
 * The folder the effects file goes in, relative to the path: `flat` decides
 * whether it gets its own folder, and `group` puts it within `effects`.
 */
function effectsFolder(options: EffectOptions, folderName: string): string {
  return stringUtils.group(
    options.flat ? '' : folderName,
    options.group ? 'effects' : ''
  );
}

function addImportToNgModule(options: EffectOptions): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    if (!modulePath) {
      return host;
    }

    if (!host.exists(modulePath)) {
      throw new Error(`Specified module path ${modulePath} does not exist`);
    }

    const text = host.read(modulePath);
    if (text === null) {
      throw new SchematicsException(`File ${modulePath} does not exist.`);
    }
    const sourceText = text.toString('utf-8');

    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    // Set by the default rule before this runs ('' only with --root --minimal).
    const name = options.name ?? '';
    const effectsName = `${stringUtils.classify(`${name}Effects`)}`;

    const effectsModuleImport = insertImport(
      source,
      modulePath,
      'EffectsModule',
      '@ngrx/effects'
    );

    // The same folder the template is written to (`if-flat`), or the import
    // points at a file that does not exist.
    const effectsPath = [
      options.path,
      effectsFolder(options, stringUtils.dasherize(name)),
      `${stringUtils.dasherize(name)}.effects`,
    ]
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^(?!\/)/, '/');
    const relativePath = buildRelativePath(modulePath, effectsPath);
    const effectsImport = insertImport(
      source,
      modulePath,
      effectsName,
      relativePath
    );

    const effectsSetup =
      options.root && options.minimal ? `[]` : `[${effectsName}]`;
    const [effectsNgModuleImport] = addImportToModule(
      source,
      modulePath,
      `EffectsModule.for${options.root ? 'Root' : 'Feature'}(${effectsSetup})`,
      relativePath
    );

    let changes = [effectsModuleImport, effectsNgModuleImport];

    if (!options.root || (options.root && !options.minimal)) {
      changes = changes.concat([effectsImport]);
    }

    const recorder = host.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);

    return host;
  };
}

function getEffectStart(name: string, effectPrefix: string): string {
  const effectName = stringUtils.classify(name);
  const effectMethodPrefix = stringUtils.camelize(effectPrefix);

  return (
    `${effectMethodPrefix}${effectName}s$ = createEffect(() => {` +
    '\n    return this.actions$.pipe(\n'
  );
}

export default function (options: EffectOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = getProjectPath(host, options);
    // Only `--root --minimal` works without a name: it registers
    // `EffectsModule.forRoot([])` and creates no file. Anything else would
    // write nameless `.effects.ts` files.
    if (!options.name && !(options.root && options.minimal)) {
      throw new SchematicsException(
        'A name is required, except with --root --minimal.'
      );
    }
    const parsedPath = parseName(options.path, options.name || '');
    options.name = parsedPath.name;
    options.path = parsedPath.path;
    options.prefix = getPrefix(options);

    if (options.module) {
      options.module = findModuleFromOptions(host, {
        ...options,
        name: options.name,
      });
    }

    const templateSource = apply(url('./files'), [
      options.skipTests
        ? filter((path) => !path.endsWith('.spec.ts.template'))
        : noop(),
      options.root && options.minimal ? filter((_) => false) : noop(),
      applyTemplates({
        ...stringUtils,
        'if-flat': (s: string) => effectsFolder(options, s),
        effectMethod: 'createEffect',
        effectStart: getEffectStart(options.name, options.prefix),
        effectEnd: '  );\n' + '  });',
        ...(options as object),
      } as any),
      move(parsedPath.path),
    ]);

    return chain([
      branchAndMerge(
        chain([addImportToNgModule(options), mergeWith(templateSource)])
      ),
    ])(host, context);
  };
}
